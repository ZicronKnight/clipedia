'use client';
import React, { useRef, useState } from 'react';
import { extractSegment } from '@/components/studio/segmentExtractor';
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
</div>
<pre className="min-h-[16rem] whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-[11px] leading-relaxed text-green-300">{log.join('\n')}</pre>
<a href="/studio" className="text-xs text-cyan-300 underline">← Volver al Studio</a>
</div>
);
}