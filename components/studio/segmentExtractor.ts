// ===== EXTRACTOR DE SEGMENTOS POR BYTE-RANGES (Fase 6 · Paso 2) =====
// Nunca carga el archivo entero: parsea el moov, pide con slice() solo los
// bytes de la ventana, y entrega los samples como stream Annex-B H.264
// (SPS/PPS + start codes), listo para que FFmpeg.wasm lo decoda directo.
export interface SegmentResult { annexB: Uint8Array; fps: number; fetchedBytes: number; ms: number; samples: number; firstTs: number }

function loadMp4Box(): Promise<any> {
return new Promise((resolve, reject) => {
const w = window as any;
if (w.MP4Box) return resolve(w.MP4Box);
const s = document.createElement('script');
s.src = '/mp4box.all.js';
s.onload = () => (w.MP4Box ? resolve(w.MP4Box) : reject(new Error('MP4Box no expuso su global')));
s.onerror = () => reject(new Error('No se pudo cargar /mp4box.all.js'));
document.head.appendChild(s);
});
}

async function feedMoov(mp4boxFile: any, file: Blob, log: (s: string) => void): Promise<{ ok: boolean; buffers: ArrayBuffer[] }> {
const buffers: ArrayBuffer[] = [];
const push = async (start: number, end: number) => {
const buf = await file.slice(start, end).arrayBuffer();
const ab = buf as any; ab.fileStart = start;
buffers.push(buf);
mp4boxFile.appendBuffer(ab);
};
await push(0, Math.min(32 * 1024 * 1024, file.size));
if (mp4boxFile.moov) return { ok: true, buffers };
const tail = Math.min(256 * 1024 * 1024, Math.floor(file.size * 0.1));
log(`   …moov no está al inicio; probando últimos ${(tail / 1048576).toFixed(0)}MB`);
await push(Math.max(0, file.size - tail), file.size);
return { ok: !!mp4boxFile.moov, buffers };
}

// El análisis de la tabla de samples del audio se reutiliza entre ventanas.
// Sin esta caché, una forma de onda larga volvería a parsear el moov cientos
// de veces (y releería hasta 32MB por cada fragmento).
type CachedAudioMetadata = { mp4boxFile: any; info: any; asc: Uint8Array | null };
const audioMetadataCache = new WeakMap<Blob, Promise<CachedAudioMetadata | null>>();
async function getCachedAudioMetadata(file: Blob, log: (s: string) => void): Promise<CachedAudioMetadata | null> {
let pending = audioMetadataCache.get(file);
if (!pending) {
pending = (async () => {
const MP4Box = await loadMp4Box();
const mp4boxFile = MP4Box.createFile();
const { ok, buffers } = await feedMoov(mp4boxFile, file, log);
if (!ok) return null;
return { mp4boxFile, info: mp4boxFile.getInfo(), asc: findAacDescription(buffers) };
})();
audioMetadataCache.set(file, pending);
}
return pending;
}

function findAvcCDescription(buffers: ArrayBuffer[]): Uint8Array | null {
for (const buf of buffers) {
const u8 = new Uint8Array(buf);
for (let i = 8; i + 8 < u8.length; i++) {
if (u8[i] === 0x61 && u8[i + 1] === 0x76 && u8[i + 2] === 0x63 && u8[i + 3] === 0x43) {
const size = ((u8[i - 4] << 24) | (u8[i - 3] << 16) | (u8[i - 2] << 8) | (u8[i - 1]) >>> 0) >>> 0;
if (size >= 8 && size <= 4096 && i - 4 + size <= u8.length) return u8.subarray(i - 4, i - 4 + size);
}
}
}
return null;
}

function parseAvcC(box: Uint8Array): { sps: Uint8Array[]; pps: Uint8Array[]; lengthSize: number } {
// La descripción puede venir CON el header de box de 8 bytes [tamaño]['avcC'].
// Lo detectamos y lo salteamos para leer siempre desde configurationVersion.
const hasHeader = box.length > 12 && box[4] === 0x61 && box[5] === 0x76 && box[6] === 0x63 && box[7] === 0x43;
const b = hasHeader ? 8 : 0;
const lengthSize = (box[b + 4] & 0x03) + 1;   // byte 12 real = lengthSizeMinusOne
let i = b + 5;                                  // byte 13 real = numSPS
const numSPS = box[i] & 0x1f; i += 1;
const sps: Uint8Array[] = [];
for (let s = 0; s < numSPS; s++) {
const len = (box[i] << 8) | box[i + 1]; i += 2;
sps.push(box.subarray(i, i + len)); i += len;
}
const numPPS = box[i]; i += 1;
const pps: Uint8Array[] = [];
for (let p = 0; p < numPPS; p++) {
const len = (box[i] << 8) | box[i + 1]; i += 2;
pps.push(box.subarray(i, i + len)); i += len;
}
return { sps, pps, lengthSize };
}

const START_CODE = new Uint8Array([0, 0, 0, 1]);
function avccToAnnexB(datas: Uint8Array[], cfg: { sps: Uint8Array[]; pps: Uint8Array[]; lengthSize: number }): Uint8Array {
const parts: Uint8Array[] = [];
for (const s of cfg.sps) { parts.push(START_CODE, s); }
for (const p of cfg.pps) { parts.push(START_CODE, p); }
for (const data of datas) {
let off = 0;
while (off + cfg.lengthSize <= data.length) {
let nlen = 0;
for (let b = 0; b < cfg.lengthSize; b++) nlen = (nlen << 8) | data[off + b];
off += cfg.lengthSize;
if (nlen <= 0 || off + nlen > data.length) break;
parts.push(START_CODE, data.subarray(off, off + nlen));
off += nlen;
}
}
const total = parts.reduce((a, p) => a + p.length, 0);
const out = new Uint8Array(total);
let o = 0;
for (const p of parts) { out.set(p, o); o += p.length; }
return out;
}

export async function extractSegment(file: Blob, t0: number, t1: number, log: (s: string) => void = () => {}): Promise<SegmentResult | null> {
const tStart = performance.now();
const MP4Box = await loadMp4Box();
const mp4boxFile = MP4Box.createFile();
const { ok, buffers } = await feedMoov(mp4boxFile, file, log);
if (!ok) { log('⚠️ No se encontró el moov (container no soportado)'); return null; }
const info = mp4boxFile.getInfo();
const vinfo = info.videoTracks && info.videoTracks[0];
if (!vinfo) { log('⚠️ El archivo no tiene pista de video'); return null; }
const track = mp4boxFile.getTrackById(vinfo.id);
const samples: any[] = track.samples || [];
if (!samples.length) { log('⚠️ Tabla de samples vacía'); return null; }
const ts = vinfo.timescale || 1;
let i0 = samples.findIndex((s) => (s.dts + (s.duration || 0)) / ts > t0);
if (i0 < 0) i0 = 0;
while (i0 > 0 && !samples[i0].is_sync) i0--;
let i1 = samples.findIndex((s) => s.dts / ts >= t1);
if (i1 < 0) i1 = samples.length;
const wanted = samples.slice(i0, i1);
if (!wanted.length) { log('⚠️ La ventana pedida no tiene samples'); return null; }
const ranges: { s: number; e: number }[] = [];
for (const s of wanted) {
const last = ranges[ranges.length - 1];
if (last && s.offset <= last.e + 1024 * 1024) last.e = Math.max(last.e, s.offset + s.size);
else ranges.push({ s: s.offset, e: s.offset + s.size });
}
let fetchedBytes = 0;
const rangeBuffers = new Map<number, ArrayBuffer>();
for (const r of ranges) {
const buf = await file.slice(r.s, r.e).arrayBuffer();
fetchedBytes += buf.byteLength;
rangeBuffers.set(r.s, buf);
}
const byteAt = (offset: number, size: number): Uint8Array => {
for (const r of ranges) {
if (offset >= r.s && offset + size <= r.e) return new Uint8Array(rangeBuffers.get(r.s)!, offset - r.s, size);
}
throw new Error('offset fuera de rangos');
};
const entry = track.mdia.minf.stbl.stsd.entries[0];
const etype = String(entry.type);
if (etype !== 'avc1' && etype !== 'avc3') { log(`⚠️ Códec ${etype}: el extractor v1 solo entrega H.264`); return null; }
const description = findAvcCDescription(buffers);
log(`   …descripción avcC: ${description ? description.byteLength + 'B' : 'NO ENCONTRADA'}`);
if (!description) { log('⚠️ Sin avcC no hay SPS/PPS para Annex-B'); return null; }
const cfg = parseAvcC(description);
const datas = wanted.map((s) => byteAt(s.offset, s.size));
const annexB = avccToAnnexB(datas, cfg);
const totalDur = wanted.reduce((a, s) => a + (s.duration || 0), 0) / ts;
const fps = totalDur > 0 ? wanted.length / totalDur : 30;
log(`✅ Extracción: ${(fetchedBytes / 1048576).toFixed(1)}MB leídos de ${(file.size / 1073741824).toFixed(2)}GB · ${wanted.length} samples · ${Math.round(performance.now() - tStart)}ms`);
log(`✅ Stream Annex-B H.264: ${(annexB.byteLength / 1048576).toFixed(1)}MB · ~${fps.toFixed(2)}fps (sin recodificar, sin mp4-muxer)`);
return { annexB, fps, fetchedBytes, ms: performance.now() - tStart, samples: wanted.length, firstTs: wanted[0].dts / ts };
}

// Longitudes de descriptor ISO 14496-1 (pueden usar bytes de extensión 0x80)
function readDescrLen(u8: Uint8Array, p: number): { len: number; next: number } {
let len = 0; let n = 0; let b = 0;
do { b = u8[p + n]; len = (len << 7) | (b & 0x7f); n++; } while ((b & 0x80) && n < 4);
return { len, next: p + n };
}
// Busca el box 'esds' en el moov y devuelve el AudioSpecificConfig REAL
// (DecoderSpecificInfo, tag 0x05): el que matchea con los frames AAC del mdat.
function findAacDescription(buffers: ArrayBuffer[]): Uint8Array | null {
for (const buf of buffers) {
const u8 = new Uint8Array(buf);
for (let i = 0; i + 16 < u8.length; i++) {
if (u8[i] !== 0x65 || u8[i + 1] !== 0x73 || u8[i + 2] !== 0x64 || u8[i + 3] !== 0x73) continue; // 'esds'
// i..i+3 = type · i+4..i+7 = version/flags · i+8 = tag ES_Descriptor (0x03)
let p = i + 8;
if (u8[p] !== 0x03) continue;
const es = readDescrLen(u8, p + 1);
p = es.next + 3;                       // + ES_ID(2) + streamPriority(1)
if (u8[p] !== 0x04) continue;          // DecoderConfigDescriptor
const dc = readDescrLen(u8, p + 1);
p = dc.next + 13;                      // + OTI(1)+streamType(1)+buffer(3)+maxBr(4)+avgBr(4)
if (u8[p] !== 0x05) continue;          // DecoderSpecificInfo = el ASC buscado
const asc = readDescrLen(u8, p + 1);
if (asc.len <= 0 || asc.len > 64 || asc.next + asc.len > u8.length) continue;
return u8.slice(asc.next, asc.next + asc.len);
}
}
return null;
}


// ===== AUDIO POR BYTE-RANGES: frames AAC crudos → MP4 chiquito (v3 canónica) =====
// Orden garantizado: ASC primero → sr/ch después → muxer al final.
// El ASC real del fuente es la ÚNICA verdad (el box mp4a puede mentir:
// Blade Runner decía 44.1k/estéreo; el ASC dice 48k/5.1).
export interface AudioSegmentDebug { codec: string; sr: number; ch: number; aot: number; freqIdx: number; chanCfg: number; ascHex: string; firstFrameHex: string; firstOffset: number; firstSize: number; adtsProbe: Uint8Array }
export interface AudioSegmentResult { mp4: Uint8Array; fetchedBytes: number; ms: number; firstTs: number; debug?: AudioSegmentDebug }
const ASC_FREQ_TABLE = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
function parseASC(asc: Uint8Array): { aot: number; freqIdx: number; freq: number; chanCfg: number } {
const bits: number[] = [];
for (const b of asc) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
let p = 0;
const rd = (n: number) => { let v = 0; for (let i = 0; i < n && p < bits.length; i++) v = (v << 1) | bits[p++]; return v; };
let aot = rd(5);
if (aot === 31) aot = 32 + rd(6);
const freqIdx = rd(4);
const freq = freqIdx === 15 ? rd(24) : (ASC_FREQ_TABLE[freqIdx] ?? 0);
const chanCfg = rd(4);
return { aot, freqIdx, freq, chanCfg };
}
function adtsHeader(frameLen: number, aot: number, freqIdx: number, chanCfg: number): Uint8Array {
const len = frameLen + 7;
const h = new Uint8Array(7);
h[0] = 0xFF; h[1] = 0xF1;
h[2] = (((aot - 1) & 0x03) << 6) | ((freqIdx & 0x0F) << 2) | ((chanCfg >> 2) & 0x01);
h[3] = ((chanCfg & 0x03) << 6) | ((len >> 11) & 0x03);
h[4] = (len >> 3) & 0xFF;
h[5] = ((len & 0x07) << 5) | 0x1F;
h[6] = 0xFC;
return h;
}

export async function extractAudioSegment(file: Blob, t0: number, t1: number, log: (s: string) => void = () => {}): Promise<AudioSegmentResult | null> {
const tStart = performance.now();
const metadata = await getCachedAudioMetadata(file, log);
if (!metadata) { log('⚠️ Audio: no se encontró el moov'); return null; }
const { mp4boxFile, info } = metadata;
const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
const ainfo = info.audioTracks && info.audioTracks[0];
if (!ainfo) { log('⚠️ Audio: el archivo no tiene pista de audio'); return null; }
if (!/mp4a\.40\.2/.test(String(ainfo.codec || ''))) { log(`⚠️ Audio: códec ${ainfo.codec} no soportado (v1 solo AAC-LC)`); return null; }
const track = mp4boxFile.getTrackById(ainfo.id);
const samples: any[] = track.samples || [];
if (!samples.length) { log('⚠️ Audio: tabla de samples vacía'); return null; }
const ts = ainfo.timescale || 1;
let i0 = samples.findIndex((s) => (s.dts + (s.duration || 0)) / ts > t0);
if (i0 < 0) i0 = 0;
let i1 = samples.findIndex((s) => s.dts / ts >= t1);
if (i1 < 0) i1 = samples.length;
const wanted = samples.slice(i0, i1);
if (!wanted.length) { log('⚠️ Audio: la ventana pedida no tiene samples'); return null; }
const ranges: { s: number; e: number }[] = [];
for (const s of wanted) {
const last = ranges[ranges.length - 1];
if (last && s.offset <= last.e + 1024 * 1024) last.e = Math.max(last.e, s.offset + s.size);
else ranges.push({ s: s.offset, e: s.offset + s.size });
}
let fetchedBytes = 0;
const rangeBuffers = new Map<number, ArrayBuffer>();
for (const r of ranges) {
const buf = await file.slice(r.s, r.e).arrayBuffer();
fetchedBytes += buf.byteLength;
rangeBuffers.set(r.s, buf);
}
const byteAt = (offset: number, size: number): Uint8Array => {
for (const r of ranges) {
if (offset >= r.s && offset + size <= r.e) return new Uint8Array(rangeBuffers.get(r.s)!, offset - r.s, size);
}
throw new Error('offset fuera de rangos');
};
// ===== ORDEN CANÓNICO: ASC → sr/ch → muxer =====
const asc = metadata.asc;
if (!asc) { log('⚠️ Audio: no se encontró el esds/ASC del fuente'); return null; }
const verdad = parseASC(asc);
const sr = verdad.freq > 0 ? verdad.freq : (ainfo.sample_rate || 44100);
const ch = verdad.chanCfg >= 1 && verdad.chanCfg <= 8 ? verdad.chanCfg : (ainfo.channel_count || 2);
log(`   …ASC del fuente: ${asc.length}B · config REAL: ${sr}Hz · ${ch}ch · AOT ${verdad.aot}`);
const hex = (u: Uint8Array) => Array.from(u).map((b) => b.toString(16).padStart(2, '0')).join(' ');
const first = wanted[0];
const firstBytes = byteAt(first.offset, first.size);
// Oráculo: primeros 5 frames en ADTS (verificación independiente del contenedor)
const probeParts: Uint8Array[] = [];
for (const s of wanted.slice(0, 5)) {
const fr = byteAt(s.offset, s.size);
probeParts.push(adtsHeader(fr.length, verdad.aot >= 1 && verdad.aot <= 4 ? verdad.aot : 2, verdad.freqIdx > 12 ? 4 : verdad.freqIdx, verdad.chanCfg || 2), fr);
}
let probeLen = 0; probeParts.forEach((x) => { probeLen += x.length; });
const adtsProbe = new Uint8Array(probeLen);
{ let o = 0; for (const x of probeParts) { adtsProbe.set(x, o); o += x.length; } }
const debug: AudioSegmentDebug = { codec: String(ainfo.codec || '?'), sr, ch, aot: verdad.aot, freqIdx: verdad.freqIdx, chanCfg: verdad.chanCfg, ascHex: hex(asc), firstFrameHex: hex(firstBytes.slice(0, 16)), firstOffset: first.offset, firstSize: first.size, adtsProbe };
const muxer = new Muxer({
target: new ArrayBufferTarget(),
audio: { codec: 'aac', numberOfChannels: ch, sampleRate: sr, description: asc, firstTimestampBehavior: 'offset' } as any,
fastStart: 'in-memory',
});
const dts0 = wanted[0].dts;
const frameUs = (1024 / sr) * 1e6;
for (const s of wanted) {
const tsUs = Math.max(0, ((s.dts - dts0) / ts) * 1e6);
(muxer as any).addAudioChunkRaw(byteAt(s.offset, s.size), 'key', tsUs, frameUs);
}
muxer.finalize();
const mp4 = new Uint8Array((muxer.target as any).buffer);
log(`✅ Audio extraído: ${(fetchedBytes / 1048576).toFixed(1)}MB leídos · ${wanted.length} frames AAC · ~${(wanted.length * 1024 / sr).toFixed(1)}s en MP4 de ${(mp4.byteLength / 1048576).toFixed(1)}MB`);
return { mp4, fetchedBytes, ms: performance.now() - tStart, firstTs: wanted[0].dts / ts, debug };
}