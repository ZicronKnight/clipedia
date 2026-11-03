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