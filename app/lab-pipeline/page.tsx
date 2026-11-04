'use client';
import React, { useRef, useState } from 'react';
import { extractSegment, extractAudioSegment } from '@/components/studio/segmentExtractor';
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
</div>
<pre className="min-h-[16rem] whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-[11px] leading-relaxed text-green-300">{log.join('\n')}</pre>
<a href="/studio" className="text-xs text-cyan-300 underline">← Volver al Studio</a>
</div>
);
}