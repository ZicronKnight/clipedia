'use client';
import React, { useRef, useState } from 'react';
import { extractSegment, extractAudioSegment } from '@/components/studio/segmentExtractor';
import { computeChunkBoundaries } from '@/components/studio/chunkedExport';
// ===== LABORATORIO FASE 6: mide TU máquina antes de decidir arquitectura =====
// Tres experimentos honestos: velocidad OPFS, lectura por rodajas, y el techo
// real de MEMFS de ffmpeg.wasm con buffers crecientes.
export default function LabPipeline() {
const fileRef = useRef<File | null>(null);
const [log, setLog] = useState<string[]>(['🔬 Laboratorio listo. Elegí un video pesado (ideal: tu archivo de 7GB).']);
const [busy, setBusy] = useState(false);
const addLog = (s: string) => setLog((prev) => [...prev, s]);
const ramMB = () => { const m = (performance as any).memory; return m ? ` · RAM JS: ${Math.round(m.usedJSHeapSize / 1048576)}MB` : ''; };
async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
const f = e.target.files?.[0] || null;
fileRef.current = f;
if (f) addLog(`📄 Cargado: ${f.name} (${(f.size / 1073741824).toFixed(2)}GB)`);
e.target.value = '';
}
async function testOpfs() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
if (!('storage' in navigator) || !(navigator as any).storage?.getDirectory) throw new Error('OPFS no disponible en este navegador');
const t0 = performance.now();
const root = await (navigator as any).storage.getDirectory();
const fh = await root.getFileHandle('lab_copy.bin', { create: true });
const writable = await (fh as any).createWritable();
const CHUNK = 8 * 1024 * 1024;
let written = 0;
for (let off = 0; off < f.size; off += CHUNK) {
await writable.write(f.slice(off, off + CHUNK));
written = Math.min(off + CHUNK, f.size);
if ((written / CHUNK) % 32 === 0) addLog(`   …${Math.round((written / f.size) * 100)}% copiado${ramMB()}`);
}
await writable.close();
const secs = (performance.now() - t0) / 1000;
addLog(`✅ OPFS escritura: ${(f.size / 1048576 / secs).toFixed(1)} MB/s (${secs.toFixed(1)}s, chunks de 8MB, RAM constante)${ramMB()}`);
const t1 = performance.now();
const blob: Blob = await (fh as any).getFile();
const slice = await blob.slice(0, 64 * 1024 * 1024).arrayBuffer();
addLog(`✅ OPFS lectura por rodaja (64MB): ${((performance.now() - t1) / 1000).toFixed(2)}s → slice() NO carga el archivo entero`);
slice.byteLength; await (fh as any).remove();
} catch (e: any) { addLog(`❌ OPFS: ${e?.message || e}`); }
setBusy(false);
}
async function testMemfsCeiling() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
const w = window as any;
if (!w.FFmpegWASM) {
await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = '/ffmpeg.js'; s.onload = () => res(); s.onerror = () => rej(new Error('no se pudo cargar /ffmpeg.js')); document.head.appendChild(s); });
}
const { FFmpeg } = w.FFmpegWASM;
const ff = new FFmpeg();
const { toBlobURL } = await import('@ffmpeg/util');
await ff.load({ coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'), wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm') });
for (const mb of [128, 256, 512, 1024]) {
const bytes = Math.min(mb * 1024 * 1024, f.size);
try {
const t0 = performance.now();
const buf = await f.slice(0, bytes).arrayBuffer();
await ff.writeFile('probe.bin', new Uint8Array(buf));
addLog(`✅ MEMFS writeFile ${mb}MB ok (${((performance.now() - t0) / 1000).toFixed(1)}s)${ramMB()}`);
await ff.deleteFile('probe.bin');
} catch (e: any) { addLog(`🛑 MEMFS falló en ${mb}MB → techo práctico entre ${mb / 2}MB y ${mb}MB en este equipo (${e?.message || e})`); break; }
}
try { await ff.terminate(); } catch (e) {}
} catch (e: any) { addLog(`❌ wasm: ${e?.message || e}`); }
setBusy(false);
}
async function testSliceSpeed() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
const t0 = performance.now();
const mid = Math.max(0, f.size - 100 * 1024 * 1024);
const buf = await f.slice(mid, mid + 100 * 1024 * 1024).arrayBuffer();
addLog(`✅ Slice de 100MB del FINAL del archivo: ${((performance.now() - t0) / 1000).toFixed(2)}s → acceso por byte-range sin cargar todo (${(buf.byteLength / 1048576).toFixed(0)}MB en RAM)`);
setBusy(false);
}

async function testSegmentExtract() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
const dur = await new Promise<number>((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration || 0); v.onerror = () => res(0); v.src = URL.createObjectURL(f); });
if (!dur) throw new Error('no se pudo leer la duración');
const t0 = Math.max(0, dur / 2 - 1); const t1 = Math.min(dur, t0 + 2);
addLog(`🎯 Extrayendo ventana ${t0.toFixed(1)}s–${t1.toFixed(1)}s por byte-ranges (sin tocar el resto del archivo)…`);
const res = await extractSegment(f, t0, t1, addLog);
if (!res) { addLog('❌ El extractor no produjo segmento (mirá avisos arriba)'); return; }
const w = window as any;
if (!w.FFmpegWASM) {
await new Promise<void>((res2, rej) => { const s = document.createElement('script'); s.src = '/ffmpeg.js'; s.onload = () => res2(); s.onerror = () => rej(new Error('no se pudo cargar /ffmpeg.js')); document.head.appendChild(s); });
}
const { FFmpeg } = w.FFmpegWASM;
const ff = new FFmpeg();
const { toBlobURL } = await import('@ffmpeg/util');
await ff.load({ coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'), wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm') });
await ff.writeFile('seg.h264', res.annexB);
const code = await ff.exec(['-f', 'h264', '-framerate', res.fps.toFixed(3), '-i', 'seg.h264', '-f', 'null', '-']);
addLog(code === 0 ? '✅ FFmpeg decodifica el stream Annex-B → el extractor es apto para snippets de transición' : `❌ FFmpeg no decodifica el segmento (código ${code})`);
try { await ff.deleteFile('seg.h264'); await ff.terminate(); } catch (e) {}
} catch (e: any) { addLog(`❌ Segmento: ${e?.message || e}`); }
setBusy(false);
}

async function testAudioSegment() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
const dur = await new Promise<number>((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration || 0); v.onerror = () => res(0); v.src = URL.createObjectURL(f); });
if (!dur) throw new Error('no se pudo leer la duración');
const t0 = Math.max(0, dur / 2 - 2); const t1 = Math.min(dur, t0 + 4);
addLog(`🎯 Extrayendo AUDIO ${t0.toFixed(1)}s–${t1.toFixed(1)}s por byte-ranges…`);
const res = await extractAudioSegment(f, t0, t1, addLog);
if (!res) { addLog('❌ El extractor de audio no produjo segmento'); return; }
addLog(`✅ Audio en MP4: ${(res.mp4.byteLength / 1048576).toFixed(1)}MB en ${Math.round(res.ms)}ms${ramMB()}`);
if (res.debug) {
addLog(`🔍 Fuente según mp4box: ${res.debug.codec} · ${res.debug.sr}Hz · ${res.debug.ch}ch`);
addLog(`🔍 ASC (${res.debug.ascHex})`);
addLog(`🔍 Frame#0 @${res.debug.firstOffset} (${res.debug.firstSize}B): ${res.debug.firstFrameHex}`);
const mp = res.mp4;
for (let i = 0; i + 28 < mp.length; i++) {
if (mp[i] === 0x65 && mp[i + 1] === 0x73 && mp[i + 2] === 0x64 && mp[i + 3] === 0x73) {
addLog('🔍 esds que escribió mp4-muxer: ' + Array.from(mp.slice(i + 8, i + 8 + 16)).map((b) => b.toString(16).padStart(2, '0')).join(' '));
break;
}
}
try {
const actx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
const decoded2 = await actx2.decodeAudioData(res.debug.adtsProbe.slice().buffer);
addLog(`✅ ORÁCULO ADTS: Chrome SÍ decodifica los frames crudos (${decoded2.duration.toFixed(2)}s, ${decoded2.numberOfChannels}ch) → los bytes están bien; el problema es el contenedor/esds`);
actx2.close();
} catch (e2: any) {
addLog(`❌ ORÁCULO ADTS: Chrome TAMPOCO decodifica los frames crudos → los bytes extraídos o el ASC no corresponden a estos frames`);
}
}
addLog('   Primeros bytes (ftyp esperado): ' + Array.from(res.mp4.slice(0, 12)).map((b) => b.toString(16).padStart(2, '0')).join(' '));
// VEREDICTO 1: el propio decoder del navegador sobre nuestro MP4 remuxado
try {
const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
const decoded = await actx.decodeAudioData(res.mp4.slice().buffer);
addLog(`✅ Navegador decodifica el MP4: ${decoded.duration.toFixed(2)}s · ${decoded.numberOfChannels}ch · ${decoded.sampleRate}Hz`);
actx.close();
} catch (e: any) {
addLog(`⚠️ El navegador NO decodifica el MP4 remuxado: ${e?.message || e}`);
}
// VEREDICTO 2: FFmpeg decodifica y re-codifica a WAV (prueba de decode de verdad)
const w = window as any;
if (!w.FFmpegWASM) {
await new Promise<void>((res2, rej) => { const s = document.createElement('script'); s.src = '/ffmpeg.js'; s.onload = () => res2(); s.onerror = () => rej(new Error('no se pudo cargar /ffmpeg.js')); document.head.appendChild(s); });
}
const { FFmpeg } = w.FFmpegWASM;
const ff = new FFmpeg();
const logs: string[] = [];
ff.on('log', ({ message }: any) => { logs.push(String(message)); });
const { toBlobURL } = await import('@ffmpeg/util');
await ff.load({ coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'), wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm') });
await ff.writeFile('seg.m4a', res.mp4);
const code = await ff.exec(['-i', 'seg.m4a', '-c:a', 'pcm_s16le', '-f', 'wav', '-y', 'seg.wav']);
if (code === 0) {
let wavLen = 0;
try { const wav = await ff.readFile('seg.wav') as Uint8Array; wavLen = wav.length; } catch (e) {}
addLog(wavLen > 1000 ? `✅ FFmpeg decodifica y genera WAV de ${(wavLen / 1048576).toFixed(1)}MB → extractor apto para export por chunks` : `⚠️ FFmpeg dio código 0 pero el WAV salió vacío (${wavLen}B)`);
} else {
addLog(`❌ FFmpeg código ${code}. Líneas clave:`);
logs.filter((l) => /Duration|Stream|Error|error|Invalid|codec|aac|moov|estimat/i.test(l)).slice(0, 14).forEach((l) => addLog('   · ' + l));
logs.slice(-4).forEach((l) => addLog('   · ' + l));
}
try { await ff.deleteFile('seg.m4a'); await ff.deleteFile('seg.wav'); await ff.terminate(); } catch (e) {}
} catch (e: any) { addLog(`❌ Audio: ${e?.message || e}`); }
setBusy(false);
}

async function testChunkedExport() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
const dur = await new Promise<number>((res) => {
const v = document.createElement('video'); v.preload = 'metadata';
v.onloadedmetadata = () => res(v.duration || 0); v.onerror = () => res(0);
v.src = URL.createObjectURL(f);
});
if (!dur) throw new Error('no se pudo leer la duración');

const CHUNK_DUR = 10;                 // segundos por chunk
const N_CHUNKS = 2;                   // cantidad de sorbos
const tStart = Math.max(0, dur - N_CHUNKS * CHUNK_DUR);
addLog(`🎬 Export chunked: ${N_CHUNKS} chunks × ${CHUNK_DUR}s desde t=${tStart.toFixed(1)}s (final del archivo)`);

const w = window as any;
if (!w.FFmpegWASM) {
await new Promise<void>((res2, rej) => { const s = document.createElement('script'); s.src = '/ffmpeg.js'; s.onload = () => res2(); s.onerror = () => rej(new Error('no se pudo cargar /ffmpeg.js')); document.head.appendChild(s); });
}
const { FFmpeg } = w.FFmpegWASM;
const ff = new FFmpeg();
const logs: string[] = [];
ff.on('log', ({ message }: any) => { logs.push(String(message)); });
const { toBlobURL } = await import('@ffmpeg/util');
await ff.load({ coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'), wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm') });

const chunkBlobs: Uint8Array[] = [];
let totalFetched = 0;
const tTotal = performance.now();

for (let k = 0; k < N_CHUNKS; k++) {
const t0 = tStart + k * CHUNK_DUR;
const t1 = t0 + CHUNK_DUR;
addLog(`── Chunk ${k + 1}/${N_CHUNKS}: ${t0.toFixed(1)}s–${t1.toFixed(1)}s ──`);

const segV = await extractSegment(f, t0, t1, addLog);
if (!segV) throw new Error(`extractSegment falló en chunk ${k}`);
const segA = await extractAudioSegment(f, t0, t1, addLog);
if (!segA) throw new Error(`extractAudioSegment falló en chunk ${k}`);

totalFetched += segV.fetchedBytes + segA.fetchedBytes;

await ff.writeFile('vid.h264', segV.annexB);
await ff.writeFile('aud.m4a', segA.mp4);

// CÓDIGO DE CHUNK: parámetros idénticos en cada sorbo → -c copy funciona al concatenar.
// El framerate del extractor es el real del fuente (no 30 inventado).
const code = await ff.exec([
'-framerate', String(segV.fps.toFixed(3)),
'-i', 'vid.h264',
'-i', 'aud.m4a',
'-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
'-c:a', 'aac', '-b:a', '192k', '-ac', '2',   // stereo para garantizar paridad exacta entre chunks
'-vf', 'scale=-2:720',
'-r', '30',
'-shortest',
'-movflags', '+faststart',
'-y', `chunk${k}.mp4`,
]);
if (code !== 0) throw new Error(`chunk ${k} falló (código ${code}). Últimas líneas: ${logs.slice(-4).join(' | ')}`);

const data = await ff.readFile(`chunk${k}.mp4`);
if (!data || data.length === 0) throw new Error(`chunk${k}.mp4 salió vacío`);
chunkBlobs.push(data as Uint8Array);
addLog(`   ✅ chunk${k}.mp4: ${(data.length / 1048576).toFixed(2)}MB`);

// Limpieza del FS entre chunks para no acumular en MEMFS
for (const name of ['vid.h264', 'aud.m4a', `chunk${k}.mp4`]) {
try { await ff.deleteFile(name); } catch (e) {}
}
}

// ===== CONCAT FINAL con -c copy (sin recodificar, solo pegar contenedores) =====
addLog('── Concat final con concat demuxer + -c copy ──');
for (let k = 0; k < N_CHUNKS; k++) {
await ff.writeFile(`chunk${k}.mp4`, chunkBlobs[k]);
}
const listContent = chunkBlobs.map((_, k) => `file 'chunk${k}.mp4'`).join('\n');
await ff.writeFile('list.txt', new TextEncoder().encode(listContent));

const concatCode = await ff.exec([
'-f', 'concat', '-safe', '0', '-i', 'list.txt',
'-c', 'copy',
'-movflags', '+faststart',
'-y', 'final.mp4',
]);
if (concatCode !== 0) throw new Error(`concat falló (código ${concatCode}). Últimas líneas: ${logs.slice(-4).join(' | ')}`);

const finalData = await ff.readFile('final.mp4');
if (!finalData || finalData.length === 0) throw new Error('final.mp4 salió vacío');

const totalMs = performance.now() - tTotal;
addLog(`✅ EXPORT CHUNKED EXITOSO:`);
addLog(`   · Leídos del disco: ${(totalFetched / 1048576).toFixed(1)}MB de ${(f.size / 1073741824).toFixed(2)}GB (${(100 * totalFetched / f.size).toFixed(3)}%)`);
addLog(`   · ${N_CHUNKS} chunks codificados + concat -c copy`);
addLog(`   · final.mp4: ${(finalData.length / 1048576).toFixed(2)}MB en ${Math.round(totalMs)}ms`);
addLog(`   · Descargando final.mp4 para verificación manual...`);

const blob = new Blob([finalData], { type: 'video/mp4' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'chunked_final.mp4';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 5000);

addLog('🎉 Abrí "chunked_final.mp4" con cualquier reproductor. Si reproduce 20s seguidos sin glitches en el empalme, el prototipo validó la arquitectura.');

try {
for (let k = 0; k < N_CHUNKS; k++) { try { await ff.deleteFile(`chunk${k}.mp4`); } catch (e) {} }
try { await ff.deleteFile('list.txt'); } catch (e) {}
try { await ff.deleteFile('final.mp4'); } catch (e) {}
await ff.terminate();
} catch (e) {}
} catch (e: any) {
addLog(`❌ Export chunked: ${e?.message || e}`);
}
setBusy(false);
}

async function testChunkedStage1() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
const dur = await new Promise<number>((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration || 0); v.onerror = () => res(0); v.src = URL.createObjectURL(f); });
if (!dur) throw new Error('no se pudo leer la duración');
const WIN = 60; const TARGET = 10; const FPS = 30;
const t0 = Math.max(0, dur - WIN);
const total = Math.min(WIN, dur);
addLog(`🎬 ETAPA 1 · export chunked con recorte exacto: ${total.toFixed(1)}s desde t=${t0.toFixed(1)}s · chunks de ~${TARGET}s · grilla 1/${FPS}s`);
const chunks = computeChunkBoundaries(total, [], TARGET, FPS);
addLog(`📐 Bordes: ${chunks.map((c) => `${c.start.toFixed(3)}–${c.end.toFixed(3)}`).join(' | ')}`);
const w = window as any;
if (!w.FFmpegWASM) {
await new Promise<void>((res2, rej) => { const s = document.createElement('script'); s.src = '/ffmpeg.js'; s.onload = () => res2(); s.onerror = () => rej(new Error('no se pudo cargar /ffmpeg.js')); document.head.appendChild(s); });
}
const { FFmpeg } = w.FFmpegWASM;
const ff = new FFmpeg();
const logs: string[] = [];
ff.on('log', ({ message }: any) => { logs.push(String(message)); });
const { toBlobURL } = await import('@ffmpeg/util');
await ff.load({ coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'), wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm') });
const chunkBlobs: Uint8Array[] = [];
let totalFetched = 0;
const tTotal = performance.now();
for (const c of chunks) {
const absS = t0 + c.start; const absE = t0 + c.end;
const len = c.end - c.start;
const segV = await extractSegment(f, absS, absE, addLog);
if (!segV) throw new Error(`extractSegment falló en chunk ${c.index}`);
const segA = await extractAudioSegment(f, absS, absE, addLog);
if (!segA) throw new Error(`extractAudioSegment falló en chunk ${c.index}`);
totalFetched += segV.fetchedBytes + segA.fetchedBytes;
await ff.writeFile('vid.h264', segV.annexB);
await ff.writeFile('aud.m4a', segA.mp4);
// RECORTE EXACTO: el video retrocedió al keyframe previo (rollback) y el audio
// al frame previo: recortamos ambos al filo de la ventana del chunk.
const vRoll = Math.max(absS - segV.firstTs, 0);
const aRoll = Math.max(absS - segA.firstTs, 0);
const frames = Math.max(1, Math.round(len * FPS));
const fc = `[0:v]trim=start=${vRoll.toFixed(6)}:end=${(vRoll + len).toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=-2:720[v];[1:a]atrim=start=${aRoll.toFixed(6)}:end=${(aRoll + len).toFixed(6)},asetpts=PTS-STARTPTS[a]`;
const code = await ff.exec([
'-framerate', segV.fps.toFixed(3), '-i', 'vid.h264', '-i', 'aud.m4a',
'-filter_complex', fc,
'-map', '[v]', '-map', '[a]',
'-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
'-frames:v', String(frames),
'-c:a', 'aac', '-b:a', '192k', '-ac', '2',
'-r', String(FPS),
'-movflags', '+faststart',
'-y', `chunk${c.index}.mp4`,
]);
if (code !== 0) throw new Error(`chunk ${c.index} falló (código ${code}) · ${logs.slice(-3).join(' | ')}`);
const data = await ff.readFile(`chunk${c.index}.mp4`) as Uint8Array;
if (!data || data.length === 0) throw new Error(`chunk${c.index}.mp4 salió vacío`);
chunkBlobs.push(data);
addLog(`   ✅ chunk${c.index}: ${len.toFixed(3)}s · ${frames} frames exactos · ${(data.length / 1048576).toFixed(2)}MB`);
for (const name of ['vid.h264', 'aud.m4a', `chunk${c.index}.mp4`]) { try { await ff.deleteFile(name); } catch (e) {} }
}
addLog('── Concat final con concat demuxer + -c copy ──');
for (let k = 0; k < chunkBlobs.length; k++) await ff.writeFile(`chunk${k}.mp4`, chunkBlobs[k]);
await ff.writeFile('list.txt', new TextEncoder().encode(chunkBlobs.map((_, k) => `file 'chunk${k}.mp4'`).join('\n')));
const concatCode = await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-movflags', '+faststart', '-y', 'final.mp4']);
if (concatCode !== 0) throw new Error(`concat falló (código ${concatCode}) · ${logs.slice(-3).join(' | ')}`);
const finalData = await ff.readFile('final.mp4') as Uint8Array;
if (!finalData || finalData.length === 0) throw new Error('final.mp4 salió vacío');
// ===== VEREDICTO DE DERIVA: la duración final contra la esperada, en frames =====
const finalUrl = URL.createObjectURL(new Blob([finalData], { type: 'video/mp4' }));
const meta = await new Promise<{ duration: number }>((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res({ duration: v.duration || 0 }); v.onerror = () => res({ duration: 0 }); v.src = finalUrl; });
URL.revokeObjectURL(finalUrl);
const driftMs = (meta.duration - total) * 1000;
const driftFrames = driftMs / (1000 / FPS);
addLog(`✅ ETAPA 1 EXITOSA:`);
addLog(`   · ${chunks.length} chunks · ${(totalFetched / 1048576).toFixed(1)}MB leídos de ${(f.size / 1073741824).toFixed(2)}GB (${(100 * totalFetched / f.size).toFixed(2)}%)`);
addLog(`   · Esperado: ${total.toFixed(3)}s · medido: ${meta.duration.toFixed(3)}s · deriva: ${driftMs >= 0 ? '+' : ''}${driftMs.toFixed(0)}ms (${driftFrames >= 0 ? '+' : ''}${driftFrames.toFixed(2)} frames)`);
addLog(`   · final.mp4: ${(finalData.length / 1048576).toFixed(2)}MB en ${Math.round(performance.now() - tTotal)}ms`);
if (Math.abs(driftFrames) <= 1) addLog('🎯 DERIVA ≤ 1 FRAME: la grilla de bordes funciona → Etapa 1 validada.');
else addLog(`⚠️ Deriva de ${driftFrames.toFixed(2)} frames: hay que revisar el recorte por chunk.`);
addLog('🎬 Descargando etapa1_final.mp4 (60s, con audio): verificalo en el reproductor.');
const url = URL.createObjectURL(new Blob([finalData], { type: 'video/mp4' }));
const a = document.createElement('a'); a.href = url; a.download = 'etapa1_final.mp4';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 5000);
try {
for (let k = 0; k < chunkBlobs.length; k++) { try { await ff.deleteFile(`chunk${k}.mp4`); } catch (e) {} }
try { await ff.deleteFile('list.txt'); } catch (e) {}
try { await ff.deleteFile('final.mp4'); } catch (e) {}
await ff.terminate();
} catch (e) {}
} catch (e: any) {
addLog(`❌ Etapa 1: ${e?.message || e}`);
}
setBusy(false);
}

function probeDur(bytes: Uint8Array, mime: string): Promise<number> {
return new Promise((res) => {
const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
const v = document.createElement('video');
v.preload = 'metadata';
v.onloadedmetadata = () => { const d = v.duration || 0; URL.revokeObjectURL(url); res(d); };
v.onerror = () => { URL.revokeObjectURL(url); res(0); };
v.src = url;
});
}

async function testChunkedAudioFix() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
const dur = await new Promise<number>((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(v.duration || 0); v.onerror = () => res(0); v.src = URL.createObjectURL(f); });
if (!dur) throw new Error('no se pudo leer la duración');
const WIN = 60; const TARGET = 10; const FPS = 30;
// 5s de colchón antes del final: en muchos archivos la pista de video termina
// ANTES que la duración del contenedor (el audio es más largo). En producción
// esto no hace falta porque la timeline define el contenido real.
const t0 = Math.max(0, dur - WIN - 5);
const total = WIN;
addLog(`🎬 ETAPA 1b · video por chunks + AUDIO CONTINUO: ${total.toFixed(1)}s desde t=${t0.toFixed(1)}s`);
const chunks = computeChunkBoundaries(total, [], TARGET, FPS);
addLog(`📐 Bordes: ${chunks.map((c) => `${c.start.toFixed(3)}–${c.end.toFixed(3)}`).join(' | ')}`);
const w = window as any;
if (!w.FFmpegWASM) {
await new Promise<void>((res2, rej) => { const s = document.createElement('script'); s.src = '/ffmpeg.js'; s.onload = () => res2(); s.onerror = () => rej(new Error('no se pudo cargar /ffmpeg.js')); document.head.appendChild(s); });
}
const { FFmpeg } = w.FFmpegWASM;
const ff = new FFmpeg();
const logs: string[] = [];
ff.on('log', ({ message }: any) => { logs.push(String(message)); });
const { toBlobURL } = await import('@ffmpeg/util');
await ff.load({ coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'), wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm') });
const videoBlobs: Uint8Array[] = [];
let totalFetched = 0;
const tTotal = performance.now();
for (const c of chunks) {
const absS = t0 + c.start; const absE = t0 + c.end;
const len = c.end - c.start;
// LOOKAHEAD: el extractor debe traer un poquito de cola real para que el
// trim con MARGIN tenga frames de sobra. Después -frames:v recorta exacto.
const LOOKAHEAD = 0.25;
const segV = await extractSegment(f, absS, Math.min(dur, absE + LOOKAHEAD), addLog);
if (!segV) throw new Error(`extractSegment falló en chunk ${c.index}`);
totalFetched += segV.fetchedBytes;
await ff.writeFile('vid.h264', segV.annexB);
const vRoll = Math.max(absS - segV.firstTs, 0);
const frames = Math.max(1, Math.round(len * FPS));
// MARGEN DE FASE: la grilla del fuente (23.976fps) no coincide con los bordes
// del chunk; sin margen, algunos chunks capturan 239 frames fuente y fps=30 no
// llega a los 300. El margen asegura frames de sobra, y -frames:v recorta al
// largo EXACTO. Cada chunk sigue cubriendo [inicio, inicio+len) sin solaparse.
const MARGIN = 0.15;
const fc = `[0:v]trim=start=${vRoll.toFixed(6)}:end=${(vRoll + len + MARGIN).toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=-2:720[v]`;
const code = await ff.exec([
'-framerate', segV.fps.toFixed(3), '-i', 'vid.h264',
'-filter_complex', fc,
'-map', '[v]',
'-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
'-frames:v', String(frames),
'-an',
'-r', String(FPS),
'-movflags', '+faststart',
'-y', `vchunk${c.index}.mp4`,
]);
if (code !== 0) throw new Error(`vchunk ${c.index} falló (código ${code}) · ${logs.slice(-3).join(' | ')}`);
const data = await ff.readFile(`vchunk${c.index}.mp4`) as Uint8Array;
if (!data || data.length === 0) throw new Error(`vchunk${c.index}.mp4 salió vacío`);
videoBlobs.push(data);
addLog(`   ✅ vchunk${c.index}: ${len.toFixed(3)}s · ${frames} frames · ${(data.length / 1048576).toFixed(2)}MB (video puro)`);
const chunkDur = await probeDur(data, 'video/mp4');
addLog(`   🔎 vchunk${c.index} duración real: ${chunkDur.toFixed(3)}s · Δ ${(1000 * (chunkDur - len)).toFixed(0)}ms`);
try { await ff.deleteFile('vid.h264'); } catch (e) {}
try { await ff.deleteFile(`vchunk${c.index}.mp4`); } catch (e) {}
}
addLog('── Audio continuo: toda la ventana de una sola vez (copiado, sin recodificar) ──');
const audioFull = await extractAudioSegment(f, t0, t0 + total, addLog);
if (!audioFull) throw new Error('extractAudioSegment falló para la ventana completa');
totalFetched += audioFull.fetchedBytes;
addLog('── Concat de video (sin audio) con concat demuxer + -c copy ──');
for (let k = 0; k < videoBlobs.length; k++) await ff.writeFile(`vchunk${k}.mp4`, videoBlobs[k]);
await ff.writeFile('list.txt', new TextEncoder().encode(videoBlobs.map((_, k) => `file 'vchunk${k}.mp4'`).join('\n')));
const concatCode = await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-y', 'video_full.mp4']);
if (concatCode !== 0) throw new Error(`concat de video falló (código ${concatCode}) · ${logs.slice(-3).join(' | ')}`);
for (let k = 0; k < videoBlobs.length; k++) { try { await ff.deleteFile(`vchunk${k}.mp4`); } catch (e) {} }
try { await ff.deleteFile('list.txt'); } catch (e) {}
const videoFullData = await ff.readFile('video_full.mp4') as Uint8Array;
const videoFullDur = await probeDur(videoFullData, 'video/mp4');
addLog(`🔎 video_full.mp4 (concat, sin audio): ${videoFullDur.toFixed(3)}s · esperado ${total.toFixed(3)}s · Δ ${(1000 * (videoFullDur - total)).toFixed(0)}ms`);
const audioFullDur = await probeDur(audioFull.mp4, 'video/mp4');
addLog(`🔎 audio_full.m4a: ${audioFullDur.toFixed(3)}s · Δ vs video: ${(1000 * (audioFullDur - videoFullDur)).toFixed(0)}ms`);
addLog('── Merge final: video continuo + audio continuo, ambos stream copy ──');
await ff.writeFile('audio_full.m4a', audioFull.mp4);
const mergeCode = await ff.exec([
'-i', 'video_full.mp4', '-i', 'audio_full.m4a',
'-map', '0:v', '-map', '1:a',
'-c:v', 'copy', '-c:a', 'copy',
'-shortest',
'-movflags', '+faststart',
'-y', 'final.mp4',
]);
if (mergeCode !== 0) throw new Error(`merge final falló (código ${mergeCode}) · ${logs.slice(-3).join(' | ')}`);
const finalData = await ff.readFile('final.mp4') as Uint8Array;
if (!finalData || finalData.length === 0) throw new Error('final.mp4 salió vacío');
const finalUrl = URL.createObjectURL(new Blob([finalData], { type: 'video/mp4' }));
const meta = await new Promise<{ duration: number }>((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res({ duration: v.duration || 0 }); v.onerror = () => res({ duration: 0 }); v.src = finalUrl; });
URL.revokeObjectURL(finalUrl);
const driftMs = (meta.duration - total) * 1000;
const driftFrames = driftMs / (1000 / FPS);
addLog(`✅ ETAPA 1b EXITOSA:`);
addLog(`   · ${chunks.length} chunks de video + 1 audio continuo · ${(totalFetched / 1048576).toFixed(1)}MB leídos de ${(f.size / 1073741824).toFixed(2)}GB (${(100 * totalFetched / f.size).toFixed(2)}%)`);
addLog(`   · Esperado: ${total.toFixed(3)}s · medido: ${meta.duration.toFixed(3)}s · deriva: ${driftMs >= 0 ? '+' : ''}${driftMs.toFixed(0)}ms (${driftFrames >= 0 ? '+' : ''}${driftFrames.toFixed(2)} frames)`);
addLog(`   · Audio: AAC copiado del fuente SIN recodificar → 5.1 preservado, cero artefactos de empalme`);
addLog(`   · final.mp4: ${(finalData.length / 1048576).toFixed(2)}MB en ${Math.round(performance.now() - tTotal)}ms`);
if (Math.abs(driftFrames) <= 1) addLog('🎯 DERIVA ≤ 1 FRAME: Etapa 1b validada.');
else addLog(`⚠️ Deriva de ${driftFrames.toFixed(2)} frames: revisar.`);
addLog('🎬 Descargando etapa1b_final.mp4: el salto de audio cada 10s debería haber DESAPARECIDO.');
const url = URL.createObjectURL(new Blob([finalData], { type: 'video/mp4' }));
const a = document.createElement('a'); a.href = url; a.download = 'etapa1b_final.mp4';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 5000);
try {
for (const name of ['video_full.mp4', 'audio_full.m4a', 'final.mp4']) { try { await ff.deleteFile(name); } catch (e) {} }
await ff.terminate();
} catch (e) {}
} catch (e: any) {
addLog(`❌ Etapa 1b: ${e?.message || e}`);
}
setBusy(false);
}

async function testMulticlipTransitions() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
addLog('🎬 ETAPA 2 · Dry-run: Timeline multiclip con transiciones y chunks protegidos');
// 1. Definimos 3 "clips" sintéticos usando regiones del Blade Runner
const syntheticClips = [
{ name: 'Clip A', start: 100, end: 120, speed: 1, transition: { type: 'fade', duration: 1.0 } },
{ name: 'Clip B', start: 500, end: 520, speed: 1, transition: { type: 'wipeleft', duration: 1.5 } },
{ name: 'Clip C', start: 1000, end: 1020, speed: 1, transition: null },
];
// 2. Calculamos la geometría de la timeline (idéntico a Studio.tsx)
const effLen = (c: any) => (c.end - c.start) / c.speed;
const dAfter = (i: number) => {
if (i < 0 || i >= syntheticClips.length - 1) return 0;
const tr = syntheticClips[i].transition;
if (!tr) return 0;
return Math.min(tr.duration, effLen(syntheticClips[i]), effLen(syntheticClips[i + 1]));
};
const videoStarts: number[] = [];
let acc = 0;
for (let i = 0; i < syntheticClips.length; i++) {
videoStarts.push(acc);
acc += effLen(syntheticClips[i]) - dAfter(i);
}
const totalDuration = videoStarts[syntheticClips.length - 1] + effLen(syntheticClips[syntheticClips.length - 1]);
addLog(`📐 Timeline: ${syntheticClips.length} clips · Duración total: ${totalDuration.toFixed(2)}s`);
syntheticClips.forEach((c, i) => addLog(`   · ${c.name}: ${effLen(c).toFixed(1)}s (inicia en timeline: ${videoStarts[i].toFixed(2)}s)${c.transition ? ` → transición ${c.transition.type} de ${c.transition.duration}s` : ''}`));
// 3. Calculamos las ventanas protegidas (donde un chunk NO puede cortar)
const protectedWins: { s: number; e: number }[] = [];
for (let i = 0; i < syntheticClips.length - 1; i++) {
const d = dAfter(i);
if (d > 0) {
const winStart = videoStarts[i + 1]; // El inicio del solape en la timeline
protectedWins.push({ s: winStart, e: winStart + d });
addLog(`🛡️ Ventana protegida ${i + 1}: ${winStart.toFixed(2)}s – ${(winStart + d).toFixed(2)}s (${syntheticClips[i].transition?.type})`);
}
}
// 4. Llamamos al calculador de chunks
const TARGET = 10; const FPS = 30;
const chunks = computeChunkBoundaries(totalDuration, protectedWins, TARGET, FPS);
addLog(`🧩 Chunks generados (target ~${TARGET}s):`);
let valid = true;
chunks.forEach((c) => {
let isProtected = false;
for (const w of protectedWins) {
// Un borde de chunk es 'c.end' (excepto el último). Si cae DENTRO de la ventana, es error.
if (c.end > w.s + 0.01 && c.end < w.e - 0.01 && c.end < totalDuration - 0.01) {
isProtected = true; valid = false;
}
}
addLog(`   · Chunk ${c.index}: ${c.start.toFixed(2)}s – ${c.end.toFixed(2)}s (${(c.end - c.start).toFixed(2)}s) ${isProtected ? '❌ CORTA TRANSICIÓN' : '✅'}`);
});
if (valid) addLog('🎯 ÉXITO: Ningún chunk cortó una ventana de transición. La Etapa 2 (matemática) está validada.');
else addLog('❌ ERROR: Un chunk cayó dentro de una transición. Hay que revisar computeChunkBoundaries.');
} catch (e: any) {
addLog(`❌ Test 9: ${e?.message || e}`);
}
setBusy(false);
}

async function testMulticlipRender() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
addLog('🎬 ETAPA 2b · Render multiclip con transiciones xfade dentro de chunks');
const syntheticClips = [
{ name: 'Clip A', start: 100, end: 120, speed: 1, transition: { type: 'fade', duration: 1.0 } },
{ name: 'Clip B', start: 500, end: 520, speed: 1, transition: { type: 'wipeleft', duration: 1.5 } },
{ name: 'Clip C', start: 1000, end: 1020, speed: 1, transition: null },
];
const effLen = (c: any) => (c.end - c.start) / c.speed;
const dAfter = (i: number) => {
if (i < 0 || i >= syntheticClips.length - 1) return 0;
const tr = syntheticClips[i].transition;
if (!tr) return 0;
return Math.min(tr.duration, effLen(syntheticClips[i]), effLen(syntheticClips[i + 1]));
};
const videoStarts: number[] = [];
let acc = 0;
for (let i = 0; i < syntheticClips.length; i++) {
videoStarts.push(acc);
acc += effLen(syntheticClips[i]) - dAfter(i);
}
const totalDuration = videoStarts[syntheticClips.length - 1] + effLen(syntheticClips[syntheticClips.length - 1]);
addLog(`📐 Timeline: ${syntheticClips.length} clips · Duración total: ${totalDuration.toFixed(2)}s`);
const protectedWins: { s: number; e: number }[] = [];
for (let i = 0; i < syntheticClips.length - 1; i++) {
const d = dAfter(i);
if (d > 0) {
const winStart = videoStarts[i + 1];
protectedWins.push({ s: winStart, e: winStart + d });
}
}
const TARGET = 10; const FPS = 30;
const chunks = computeChunkBoundaries(totalDuration, protectedWins, TARGET, FPS);
addLog(`🧩 ${chunks.length} chunks generados`);
const w = window as any;
if (!w.FFmpegWASM) {
await new Promise<void>((res2, rej) => { const s = document.createElement('script'); s.src = '/ffmpeg.js'; s.onload = () => res2(); s.onerror = () => rej(new Error('no se pudo cargar /ffmpeg.js')); document.head.appendChild(s); });
}
const { FFmpeg } = w.FFmpegWASM;
const ff = new FFmpeg();
const logs: string[] = [];
ff.on('log', ({ message }: any) => { logs.push(String(message)); });
const { toBlobURL } = await import('@ffmpeg/util');
await ff.load({ coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'), wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm') });
const chunkBlobs: Uint8Array[] = [];
let totalFetched = 0;
const tTotal = performance.now();
for (const c of chunks) {
const chunkStart = c.start;
const chunkEnd = c.end;
const chunkDur = chunkEnd - chunkStart;
addLog(`── Chunk ${c.index}: ${chunkStart.toFixed(2)}s–${chunkEnd.toFixed(2)}s (${chunkDur.toFixed(2)}s) ──`);
const clipsInChunk: { clip: any; localStart: number; localEnd: number; fileStart: number; fileEnd: number }[] = [];
for (let i = 0; i < syntheticClips.length; i++) {
const clip = syntheticClips[i];
const clipTLStart = videoStarts[i];
const clipTLEnd = clipTLStart + effLen(clip);
const overlapStart = Math.max(chunkStart, clipTLStart);
const overlapEnd = Math.min(chunkEnd, clipTLEnd);
if (overlapEnd <= overlapStart) continue;
const localStart = overlapStart - chunkStart;
const localEnd = overlapEnd - chunkStart;
const clipLocalStart = overlapStart - clipTLStart;
const clipLocalEnd = overlapEnd - clipTLStart;
const fileStart = clip.start + clipLocalStart * clip.speed;
const fileEnd = clip.start + clipLocalEnd * clip.speed;
clipsInChunk.push({ clip, localStart, localEnd, fileStart, fileEnd });
}
addLog(`   Clips en este chunk: ${clipsInChunk.map((x) => x.clip.name).join(', ')}`);
const clipSegments: any[] = [];
const LOOKAHEAD = 0.25;
for (const item of clipsInChunk) {
const segV = await extractSegment(f, item.fileStart, item.fileEnd + LOOKAHEAD, addLog);
if (!segV) throw new Error(`extractSegment falló para ${item.clip.name}`);
const segA = await extractAudioSegment(f, item.fileStart, item.fileEnd, addLog);
if (!segA) throw new Error(`extractAudioSegment falló para ${item.clip.name}`);
totalFetched += segV.fetchedBytes + segA.fetchedBytes;
clipSegments.push({ segV, segA, clip: item.clip, localStart: item.localStart, localEnd: item.localEnd, fileStart: item.fileStart, fileEnd: item.fileEnd });
}
const inputArgs: string[] = [];
for (let i = 0; i < clipSegments.length; i++) {
await ff.writeFile(`v${i}.h264`, clipSegments[i].segV.annexB);
await ff.writeFile(`a${i}.m4a`, clipSegments[i].segA.mp4);
inputArgs.push('-framerate', clipSegments[i].segV.fps.toFixed(3), '-i', `v${i}.h264`, '-i', `a${i}.m4a`);
}
let filterComplex = '';
let currentVideoLabel = '';
let currentAudioLabel = '';
if (clipSegments.length === 1) {
const seg = clipSegments[0];
const len = seg.localEnd - seg.localStart;
const vRoll = Math.max(0, seg.fileStart - seg.segV.firstTs);
const aRoll = Math.max(0, seg.fileStart - seg.segA.firstTs);
filterComplex = `[0:v]trim=start=${vRoll.toFixed(6)}:end=${(vRoll + len).toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=-2:720[vout];[1:a]atrim=start=${aRoll.toFixed(6)}:end=${(aRoll + len).toFixed(6)},asetpts=PTS-STARTPTS[aout]`;
currentVideoLabel = 'vout';
currentAudioLabel = 'aout';
} else {
let prevVideoLabel = '';
let prevAudioLabel = '';
let cumulativeOffset = 0;
for (let i = 0; i < clipSegments.length; i++) {
const seg = clipSegments[i];
const len = seg.localEnd - seg.localStart;
const vRoll = Math.max(0, seg.fileStart - seg.segV.firstTs);
const aRoll = Math.max(0, seg.fileStart - seg.segA.firstTs);
filterComplex += `[${i * 2}:v]trim=start=${vRoll.toFixed(6)}:end=${(vRoll + len).toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=-2:720,format=yuv420p[v${i}];`;
filterComplex += `[${i * 2 + 1}:a]atrim=start=${aRoll.toFixed(6)}:end=${(aRoll + len).toFixed(6)},asetpts=PTS-STARTPTS[a${i}];`;
if (i === 0) {
prevVideoLabel = `v${i}`;
prevAudioLabel = `a${i}`;
cumulativeOffset = len;
} else {
const prevClip = clipSegments[i - 1].clip;
const tr = prevClip.transition;
if (tr && tr.type !== 'none') {
const d = Math.min(tr.duration, len, clipSegments[i - 1].localEnd - clipSegments[i - 1].localStart);
const offset = Math.max(cumulativeOffset - d, 0);
const xfadeType = ['fade', 'wipeleft', 'wiperight', 'dissolve'].includes(tr.type) ? tr.type : 'fade';
filterComplex += `[${prevVideoLabel}][v${i}]xfade=transition=${xfadeType}:duration=${d}:offset=${offset}[vx${i}];`;
filterComplex += `[${prevAudioLabel}][a${i}]acrossfade=d=${d}:c1=tri:c2=tri[ax${i}];`;
prevVideoLabel = `vx${i}`;
prevAudioLabel = `ax${i}`;
cumulativeOffset += len - d;
} else {
filterComplex += `[${prevVideoLabel}][v${i}]concat=n=2:v=1:a=0[vc${i}];`;
filterComplex += `[${prevAudioLabel}][a${i}]concat=n=2:v=0:a=1[ac${i}];`;
prevVideoLabel = `vc${i}`;
prevAudioLabel = `ac${i}`;
cumulativeOffset += len;
}
}
}
filterComplex += `[${prevVideoLabel}]null[vout];[${prevAudioLabel}]anull[aout]`;
currentVideoLabel = 'vout';
currentAudioLabel = 'aout';
}
const code = await ff.exec([
...inputArgs,
'-filter_complex', filterComplex,
'-map', `[${currentVideoLabel}]`, '-map', `[${currentAudioLabel}]`,
'-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
'-c:a', 'aac', '-b:a', '192k',
'-r', String(FPS),
'-movflags', '+faststart',
'-y', `chunk${c.index}.mp4`,
]);
if (code !== 0) throw new Error(`chunk ${c.index} falló (código ${code}) · ${logs.slice(-3).join(' | ')}`);
const data = await ff.readFile(`chunk${c.index}.mp4`) as Uint8Array;
if (!data || data.length === 0) throw new Error(`chunk${c.index}.mp4 salió vacío`);
chunkBlobs.push(data);
addLog(`   ✅ chunk${c.index}.mp4: ${(data.length / 1048576).toFixed(2)}MB`);
for (let i = 0; i < clipSegments.length; i++) {
try { await ff.deleteFile(`v${i}.h264`); } catch (e) {}
try { await ff.deleteFile(`a${i}.m4a`); } catch (e) {}
}
try { await ff.deleteFile(`chunk${c.index}.mp4`); } catch (e) {}
}
addLog('── Concat final con concat demuxer + -c copy ──');
for (let k = 0; k < chunkBlobs.length; k++) await ff.writeFile(`chunk${k}.mp4`, chunkBlobs[k]);
await ff.writeFile('list.txt', new TextEncoder().encode(chunkBlobs.map((_, k) => `file 'chunk${k}.mp4'`).join('\n')));
const concatCode = await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-movflags', '+faststart', '-y', 'final.mp4']);
if (concatCode !== 0) throw new Error(`concat falló (código ${concatCode}) · ${logs.slice(-3).join(' | ')}`);
const finalData = await ff.readFile('final.mp4') as Uint8Array;
if (!finalData || finalData.length === 0) throw new Error('final.mp4 salió vacío');
const finalUrl = URL.createObjectURL(new Blob([finalData], { type: 'video/mp4' }));
const meta = await new Promise<{ duration: number }>((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res({ duration: v.duration || 0 }); v.onerror = () => res({ duration: 0 }); v.src = finalUrl; });
URL.revokeObjectURL(finalUrl);
const driftMs = (meta.duration - totalDuration) * 1000;
const driftFrames = driftMs / (1000 / FPS);
addLog(`✅ ETAPA 2b EXITOSA:`);
addLog(`   · ${chunks.length} chunks con transiciones xfade/acrossfade`);
addLog(`   · ${(totalFetched / 1048576).toFixed(1)}MB leídos de ${(f.size / 1073741824).toFixed(2)}GB (${(100 * totalFetched / f.size).toFixed(2)}%)`);
addLog(`   · Esperado: ${totalDuration.toFixed(3)}s · medido: ${meta.duration.toFixed(3)}s · deriva: ${driftMs >= 0 ? '+' : ''}${driftMs.toFixed(0)}ms (${driftFrames >= 0 ? '+' : ''}${driftFrames.toFixed(2)} frames)`);
addLog(`   · final.mp4: ${(finalData.length / 1048576).toFixed(2)}MB en ${Math.round(performance.now() - tTotal)}ms`);
if (Math.abs(driftFrames) <= 1) addLog('🎯 DERIVA ≤ 1 FRAME: Etapa 2b validada.');
else addLog(`⚠️ Deriva de ${driftFrames.toFixed(2)} frames: revisar.`);
addLog('🎬 Descargando etapa2b_final.mp4: verificá que las transiciones fade y wipeleft se vean bien.');
const url = URL.createObjectURL(new Blob([finalData], { type: 'video/mp4' }));
const a = document.createElement('a'); a.href = url; a.download = 'etapa2b_final.mp4';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 5000);
try {
for (let k = 0; k < chunkBlobs.length; k++) { try { await ff.deleteFile(`chunk${k}.mp4`); } catch (e) {} }
try { await ff.deleteFile('list.txt'); } catch (e) {}
try { await ff.deleteFile('final.mp4'); } catch (e) {}
await ff.terminate();
} catch (e) {}
} catch (e: any) {
addLog(`❌ Etapa 2b: ${e?.message || e}`);
}
setBusy(false);
}

async function testMulticlipAudioContinuo() {
const f = fileRef.current; if (!f) { addLog('⚠️ Primero elegí un archivo'); return; }
setBusy(true);
try {
addLog('🎬 ETAPA 2c · Multiclip: video por chunks + AUDIO CONTINUO con acrossfades');
const syntheticClips = [
{ name: 'Clip A', start: 100, end: 120, speed: 1, transition: { type: 'fade', duration: 1.0 } },
{ name: 'Clip B', start: 500, end: 520, speed: 1, transition: { type: 'wipeleft', duration: 1.5 } },
{ name: 'Clip C', start: 1000, end: 1020, speed: 1, transition: null },
];
const effLen = (c: any) => (c.end - c.start) / c.speed;
const dAfter = (i: number) => {
if (i < 0 || i >= syntheticClips.length - 1) return 0;
const tr = syntheticClips[i].transition;
if (!tr) return 0;
return Math.min(tr.duration, effLen(syntheticClips[i]), effLen(syntheticClips[i + 1]));
};
const videoStarts: number[] = [];
let acc = 0;
for (let i = 0; i < syntheticClips.length; i++) {
videoStarts.push(acc);
acc += effLen(syntheticClips[i]) - dAfter(i);
}
const totalDuration = videoStarts[syntheticClips.length - 1] + effLen(syntheticClips[syntheticClips.length - 1]);
addLog(`📐 Timeline: ${syntheticClips.length} clips · Duración total: ${totalDuration.toFixed(2)}s`);
const protectedWins: { s: number; e: number }[] = [];
for (let i = 0; i < syntheticClips.length - 1; i++) {
const d = dAfter(i);
if (d > 0) { const ws = videoStarts[i + 1]; protectedWins.push({ s: ws, e: ws + d }); }
}
const TARGET = 10; const FPS = 30;
const chunks = computeChunkBoundaries(totalDuration, protectedWins, TARGET, FPS);
addLog(`🧩 ${chunks.length} chunks de video generados`);
const w = window as any;
if (!w.FFmpegWASM) {
await new Promise<void>((res2, rej) => { const s = document.createElement('script'); s.src = '/ffmpeg.js'; s.onload = () => res2(); s.onerror = () => rej(new Error('no se pudo cargar /ffmpeg.js')); document.head.appendChild(s); });
}
const { FFmpeg } = w.FFmpegWASM;
const ff = new FFmpeg();
const logs: string[] = [];
ff.on('log', ({ message }: any) => { logs.push(String(message)); });
const { toBlobURL } = await import('@ffmpeg/util');
await ff.load({ coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'), wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm') });
const chunkBlobs: Uint8Array[] = [];
let totalFetched = 0;
const tTotal = performance.now();
const LOOKAHEAD = 0.25;
// ===== FASE 1: chunks de VIDEO solamente =====
for (const c of chunks) {
const chunkStart = c.start; const chunkEnd = c.end;
addLog(`── Chunk ${c.index}: ${chunkStart.toFixed(2)}s–${chunkEnd.toFixed(2)}s (video only) ──`);
const clipsInChunk: any[] = [];
for (let i = 0; i < syntheticClips.length; i++) {
const clip = syntheticClips[i];
const clipTLStart = videoStarts[i];
const clipTLEnd = clipTLStart + effLen(clip);
const overlapStart = Math.max(chunkStart, clipTLStart);
const overlapEnd = Math.min(chunkEnd, clipTLEnd);
if (overlapEnd <= overlapStart) continue;
const localStart = overlapStart - chunkStart;
const localEnd = overlapEnd - chunkStart;
const fileStart = clip.start + (overlapStart - clipTLStart) * clip.speed;
const fileEnd = clip.start + (overlapEnd - clipTLStart) * clip.speed;
clipsInChunk.push({ clip, localStart, localEnd, fileStart, fileEnd });
}
addLog(`   Clips: ${clipsInChunk.map((x) => x.clip.name).join(', ')}`);
const clipSegsV: any[] = [];
for (const item of clipsInChunk) {
const segV = await extractSegment(f, item.fileStart, item.fileEnd + LOOKAHEAD, addLog);
if (!segV) throw new Error(`extractSegment falló para ${item.clip.name}`);
totalFetched += segV.fetchedBytes;
clipSegsV.push({ segV, clip: item.clip, localStart: item.localStart, localEnd: item.localEnd, fileStart: item.fileStart });
}
const inputArgs: string[] = [];
for (let i = 0; i < clipSegsV.length; i++) {
await ff.writeFile(`v${i}.h264`, clipSegsV[i].segV.annexB);
inputArgs.push('-framerate', clipSegsV[i].segV.fps.toFixed(3), '-i', `v${i}.h264`);
}
let filterComplex = '';
if (clipSegsV.length === 1) {
const seg = clipSegsV[0];
const len = seg.localEnd - seg.localStart;
const vRoll = Math.max(0, seg.fileStart - seg.segV.firstTs);
filterComplex = `[0:v]trim=start=${vRoll.toFixed(6)}:end=${(vRoll + len).toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=-2:720,format=yuv420p[vout]`;
} else {
let prevLabel = ''; let cumulativeOffset = 0;
for (let i = 0; i < clipSegsV.length; i++) {
const seg = clipSegsV[i];
const len = seg.localEnd - seg.localStart;
const vRoll = Math.max(0, seg.fileStart - seg.segV.firstTs);
filterComplex += `[${i}:v]trim=start=${vRoll.toFixed(6)}:end=${(vRoll + len).toFixed(6)},setpts=PTS-STARTPTS,fps=${FPS},scale=-2:720,format=yuv420p[v${i}];`;
if (i === 0) { prevLabel = `v${i}`; cumulativeOffset = len; }
else {
const prevClip = clipSegsV[i - 1].clip;
const tr = prevClip.transition;
if (tr && tr.type !== 'none') {
const d = Math.min(tr.duration, len, clipSegsV[i - 1].localEnd - clipSegsV[i - 1].localStart);
const offset = Math.max(cumulativeOffset - d, 0);
const xfadeType = ['fade', 'wipeleft', 'wiperight', 'dissolve'].includes(tr.type) ? tr.type : 'fade';
filterComplex += `[${prevLabel}][v${i}]xfade=transition=${xfadeType}:duration=${d}:offset=${offset}[vx${i}];`;
prevLabel = `vx${i}`; cumulativeOffset += len - d;
} else {
filterComplex += `[${prevLabel}][v${i}]concat=n=2:v=1:a=0[vc${i}];`;
prevLabel = `vc${i}`; cumulativeOffset += len;
}
}
}
filterComplex += `[${prevLabel}]null[vout]`;
}
const code = await ff.exec([...inputArgs, '-filter_complex', filterComplex, '-map', '[vout]', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-y', `chunk${c.index}.mp4`]);
if (code !== 0) throw new Error(`vchunk ${c.index} falló (código ${code}) · ${logs.slice(-3).join(' | ')}`);
const data = await ff.readFile(`chunk${c.index}.mp4`) as Uint8Array;
if (!data || data.length === 0) throw new Error(`vchunk${c.index}.mp4 salió vacío`);
chunkBlobs.push(data);
addLog(`   ✅ vchunk${c.index}: ${(data.length / 1048576).toFixed(2)}MB (video puro)`);
for (let i = 0; i < clipSegsV.length; i++) { try { await ff.deleteFile(`v${i}.h264`); } catch (e) {} }
try { await ff.deleteFile(`chunk${c.index}.mp4`); } catch (e) {}
}
// ===== FASE 2: concat de video =====
addLog('── Concat de video (sin audio) ──');
for (let k = 0; k < chunkBlobs.length; k++) await ff.writeFile(`chunk${k}.mp4`, chunkBlobs[k]);
await ff.writeFile('list.txt', new TextEncoder().encode(chunkBlobs.map((_, k) => `file 'chunk${k}.mp4'`).join('\n')));
const concatCode = await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-y', 'video_full.mp4']);
if (concatCode !== 0) throw new Error(`concat de video falló (código ${concatCode})`);
for (let k = 0; k < chunkBlobs.length; k++) { try { await ff.deleteFile(`chunk${k}.mp4`); } catch (e) {} }
try { await ff.deleteFile('list.txt'); } catch (e) {}
// ===== FASE 3: AUDIO CONTINUO multiclip con acrossfades (un solo encode) =====
addLog('── Audio continuo multiclip (un solo encode = cero saltos) ──');
const audioInputs: string[] = [];
for (let i = 0; i < syntheticClips.length; i++) {
const clip = syntheticClips[i];
const segA = await extractAudioSegment(f, clip.start, clip.end, addLog);
if (!segA) throw new Error(`extractAudioSegment falló para ${clip.name}`);
totalFetched += segA.fetchedBytes;
await ff.writeFile(`aud${i}.m4a`, segA.mp4);
audioInputs.push('-i', `aud${i}.m4a`);
}
let audioFilter = '';
const audioLabels: string[] = [];
for (let i = 0; i < syntheticClips.length; i++) {
const len = effLen(syntheticClips[i]);
audioFilter += `[${i}:a]atrim=0:${len.toFixed(6)},asetpts=PTS-STARTPTS[ca${i}];`;
audioLabels.push(`ca${i}`);
}
let prevALabel = audioLabels[0];
for (let i = 1; i < audioLabels.length; i++) {
const tr = syntheticClips[i - 1].transition;
const d = tr && tr.type !== 'none' ? Math.min(tr.duration, effLen(syntheticClips[i - 1]), effLen(syntheticClips[i])) : 0;
if (d > 0) audioFilter += `[${prevALabel}][${audioLabels[i]}]acrossfade=d=${d}:c1=tri:c2=tri[ax${i}];`;
else audioFilter += `[${prevALabel}][${audioLabels[i]}]concat=n=2:v=0:a=1[ax${i}];`;
prevALabel = `ax${i}`;
}
audioFilter += `[${prevALabel}]anull[aout]`;
const audioCode = await ff.exec([...audioInputs, '-filter_complex', audioFilter, '-map', '[aout]', '-c:a', 'aac', '-b:a', '192k', '-y', 'audio_full.m4a']);
if (audioCode !== 0) throw new Error(`audio continuo falló (código ${audioCode}) · ${logs.slice(-3).join(' | ')}`);
for (let i = 0; i < syntheticClips.length; i++) { try { await ff.deleteFile(`aud${i}.m4a`); } catch (e) {} }
// ===== FASE 4: merge final =====
addLog('── Merge final: video continuo + audio continuo ──');
const mergeCode = await ff.exec(['-i', 'video_full.mp4', '-i', 'audio_full.m4a', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', '-y', 'final.mp4']);
if (mergeCode !== 0) throw new Error(`merge final falló (código ${mergeCode})`);
const finalData = await ff.readFile('final.mp4') as Uint8Array;
if (!finalData || finalData.length === 0) throw new Error('final.mp4 salió vacío');
const finalUrl = URL.createObjectURL(new Blob([finalData], { type: 'video/mp4' }));
const meta = await new Promise<{ duration: number }>((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res({ duration: v.duration || 0 }); v.onerror = () => res({ duration: 0 }); v.src = finalUrl; });
URL.revokeObjectURL(finalUrl);
const driftMs = (meta.duration - totalDuration) * 1000;
const driftFrames = driftMs / (1000 / FPS);
addLog(`✅ ETAPA 2c EXITOSA:`);
addLog(`   · ${chunks.length} chunks de video + 1 audio continuo con acrossfades`);
addLog(`   · ${(totalFetched / 1048576).toFixed(1)}MB leídos de ${(f.size / 1073741824).toFixed(2)}GB (${(100 * totalFetched / f.size).toFixed(2)}%)`);
addLog(`   · Esperado: ${totalDuration.toFixed(3)}s · medido: ${meta.duration.toFixed(3)}s · deriva: ${driftMs >= 0 ? '+' : ''}${driftMs.toFixed(0)}ms (${driftFrames >= 0 ? '+' : ''}${driftFrames.toFixed(2)} frames)`);
addLog(`   · final.mp4: ${(finalData.length / 1048576).toFixed(2)}MB en ${Math.round(performance.now() - tTotal)}ms`);
if (Math.abs(driftFrames) <= 1) addLog('🎯 DERIVA ≤ 1 FRAME: Etapa 2c validada.');
else addLog(`⚠️ Deriva de ${driftFrames.toFixed(2)} frames: revisar.`);
addLog('🎬 Descargando etapa2c_final.mp4: los saltos de audio cada 10s deberían haber DESAPARECIDO.');
const url = URL.createObjectURL(new Blob([finalData], { type: 'video/mp4' }));
const a = document.createElement('a'); a.href = url; a.download = 'etapa2c_final.mp4';
document.body.appendChild(a); a.click(); document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 5000);
try {
for (const name of ['video_full.mp4', 'audio_full.m4a', 'final.mp4']) { try { await ff.deleteFile(name); } catch (e) {} }
await ff.terminate();
} catch (e) {}
} catch (e: any) {
addLog(`❌ Etapa 2c: ${e?.message || e}`);
}
setBusy(false);
}

return (
<div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-slate-950 p-6 text-slate-200">
<h1 className="text-xl font-black text-white">🔬 Lab Pipeline — Fase 6</h1>
<p className="text-xs text-slate-400">Mediciones reales en TU equipo (PC y Redmi). Con estos números calibramos los fusibles y decidimos la arquitectura streaming. Nada sale de tu navegador.</p>
<input type="file" accept="video/*" onChange={pickFile} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-sm" />
<div className="flex flex-wrap gap-2">
<button onClick={testOpfs} disabled={busy} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">1 · Copia OPFS + lectura</button>
<button onClick={testSliceSpeed} disabled={busy} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">2 · Slice 100MB del final</button>
<button onClick={testMemfsCeiling} disabled={busy} className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">3 · Techo MEMFS wasm</button>
<button onClick={testSegmentExtract} disabled={busy} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">4 · Extractor byte-ranges</button>
<button onClick={testAudioSegment} disabled={busy} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">5 · Audio byte-ranges</button>
<button onClick={testChunkedExport} disabled={busy} className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">6 · Export chunked</button>
<button onClick={testChunkedStage1} disabled={busy} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">7 · Chunked Etapa 1</button>
<button onClick={testChunkedAudioFix} disabled={busy} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">8 · Audio continuo</button>
<button onClick={testMulticlipTransitions} disabled={busy} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">9 · Multiclip (Dry-Run)</button>
<button onClick={testMulticlipRender} disabled={busy} className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">10 · Multiclip (Render)</button>
<button onClick={testMulticlipAudioContinuo} disabled={busy} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black disabled:opacity-40">11 · Multiclip audio continuo</button>
</div>
<pre className="min-h-[16rem] whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-[11px] leading-relaxed text-green-300">{log.join('\n')}</pre>
<a href="/studio" className="text-xs text-cyan-300 underline">← Volver al Studio</a>
</div>
);
}