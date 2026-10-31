// ===== ASR CLIENTE: Whisper en el navegador vía transformers.js =====
// Regla de la casa: script tag módulo desde /public, nunca ESM dentro del bundle Next.
export type AsrModelId = 'tiny' | 'base' | 'small' | 'medium';
export type AsrLanguage = 'es' | 'en' | 'pt' | 'auto';
export interface AsrWord { text: string; start: number; end: number }
export interface AsrCaption { text: string; start: number; end: number }
export const ASR_MODELS: { id: AsrModelId; hf: string; label: string; icon: string; desc: string; mb: number; stars: number; plus: boolean; factorDesktop: number; factorMobile: number }[] = [
{ id: 'tiny', hf: 'Xenova/whisper-tiny', label: 'Veloz', icon: '⚡', desc: 'Borrador rápido · ideal celulares y videos largos', mb: 40, stars: 2, plus: false, factorDesktop: 0.6, factorMobile: 2.5 },
{ id: 'base', hf: 'Xenova/whisper-base', label: 'Equilibrado', icon: '⚖️', desc: 'Balance velocidad/calidad para PC', mb: 80, stars: 3, plus: false, factorDesktop: 1.2, factorMobile: 6 },
{ id: 'small', hf: 'Xenova/whisper-small', label: 'Preciso', icon: '🎯', desc: 'Español sólido para entregas · solo PC', mb: 250, stars: 4, plus: true, factorDesktop: 3, factorMobile: 999 },
{ id: 'medium', hf: 'Xenova/whisper-medium', label: 'Pro', icon: '🏆', desc: 'Máxima calidad · PC potente y paciencia', mb: 760, stars: 5, plus: true, factorDesktop: 8, factorMobile: 999 },
];
export const ASR_LANGS: { id: AsrLanguage; label: string; whisper: string | null }[] = [
{ id: 'es', label: 'Español', whisper: 'spanish' },
{ id: 'en', label: 'Inglés', whisper: 'english' },
{ id: 'pt', label: 'Portugués', whisper: 'portuguese' },
{ id: 'auto', label: 'Detección automática', whisper: null },
];
const LS_MODELS = 'clipedia:asr-models';
const LS_SPEED = 'clipedia:asr-speed';
const LS_PREF = 'clipedia:asr-pref';
export function asrDownloadedModels(): string[] { try { return JSON.parse(localStorage.getItem(LS_MODELS) || '[]'); } catch { return []; } }
function markDownloaded(id: string) { try { const s = new Set(asrDownloadedModels()); s.add(id); localStorage.setItem(LS_MODELS, JSON.stringify([...s])); } catch {} }
export function asrSpeedFactor(modelId: string, isMobile: boolean, fallback: number): number {
try { const m = JSON.parse(localStorage.getItem(LS_SPEED) || '{}'); const v = m[`${modelId}:${isMobile ? 'm' : 'd'}`]; return typeof v === 'number' && v > 0 ? v : fallback; } catch { return fallback; }
}
function markSpeed(modelId: string, isMobile: boolean, factor: number) { try { const m = JSON.parse(localStorage.getItem(LS_SPEED) || '{}'); m[`${modelId}:${isMobile ? 'm' : 'd'}`] = Math.round(factor * 100) / 100; localStorage.setItem(LS_SPEED, JSON.stringify(m)); } catch {} }
export function readAsrPref(): { model: AsrModelId; lang: AsrLanguage } | null { try { return JSON.parse(localStorage.getItem(LS_PREF) || 'null'); } catch { return null; } }
export function writeAsrPref(model: AsrModelId, lang: AsrLanguage) { try { localStorage.setItem(LS_PREF, JSON.stringify({ model, lang })); } catch {} }
export function loadAsrLib(): Promise<any> {
return new Promise((resolve, reject) => {
const w = window as any;
if (w.transformers) return resolve(w.transformers);
if (w.__asrWaiters) { w.__asrWaiters.push({ resolve, reject }); return; }
w.__asrWaiters = [{ resolve, reject }];
const finish = (lib: any) => {
const waiters = w.__asrWaiters || [];
w.__asrWaiters = null;
waiters.forEach((p: any) => (lib ? p.resolve(lib) : p.reject(new Error('transformers.js no pudo inicializarse'))));
};
// Carga como MÓDULO ES (el formato real del dist) y tiende el puente al global:
// sirve tanto si el archivo es ESM (namespace con pipeline) como si fuera UMD.
const s = document.createElement('script');
s.type = 'module';
s.textContent = [
"import * as T from '/transformers.min.js';",
"const g = (typeof self !== 'undefined' ? self : window);",
"window.transformers = (T && T.pipeline) ? T : g.transformers;",
"window.dispatchEvent(new Event('asr-lib-ready'));",
].join('\n');
s.onerror = () => finish(null);
w.addEventListener('asr-lib-ready', () => finish(w.transformers), { once: true });
document.head.appendChild(s);
});
}
// Decodifica el segmento [t0,t1) del audio de un video a 16kHz mono (la dieta de Whisper)
export async function decodeSegment16k(url: string, t0: number, t1: number): Promise<Float32Array | null> {
try {
const buf = await (await fetch(url)).arrayBuffer();
const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
const decoded = await ctx.decodeAudioData(buf);
const ch = decoded.getChannelData(0);
const s = Math.max(0, Math.floor(t0 * 16000));
const e = Math.min(ch.length, Math.floor(t1 * 16000));
const seg = ch.slice(s, e);
ctx.close();
return seg.length > 0 ? seg : null;
} catch { return null; }
}
let pipeCache: { id: string; pipe: any } | null = null;
export async function transcribeSegment(opts: {
modelId: AsrModelId; hf: string; language: AsrLanguage; audio: Float32Array;
onModelProgress?: (pct: number) => void;
}): Promise<AsrWord[]> {
const lib = await loadAsrLib();
if (lib.env) lib.env.allowLocalModels = false;
if (!pipeCache || pipeCache.id !== opts.hf) {
pipeCache = { id: opts.hf, pipe: await lib.pipeline('automatic-speech-recognition', opts.hf, {
quantized: true,
progress_callback: (p: any) => {
if (p && p.status === 'progress' && p.total) opts.onModelProgress?.(Math.round(((p.loaded || 0) / p.total) * 100));
if (p && (p.status === 'done' || p.status === 'ready')) opts.onModelProgress?.(100);
},
}) };
markDownloaded(opts.modelId);
}
const lang = ASR_LANGS.find((l) => l.id === opts.language)?.whisper ?? null;
const t0 = performance.now();
const out = await pipeCache.pipe(opts.audio, {
return_timestamps: 'word',
chunk_length_s: 30,
task: 'transcribe',
...(lang ? { language: lang } : {}),
});
const secs = (performance.now() - t0) / 1000;
const audioSecs = Math.max(opts.audio.length / 16000, 0.1);
markSpeed(opts.modelId, /Mobile|Android/i.test(navigator.userAgent || ''), secs / audioSecs);
const words: AsrWord[] = [];
for (const c of out.chunks || []) {
const ts = c.timestamp || [null, null];
const s = typeof ts[0] === 'number' ? ts[0] : null;
if (s === null) continue;
const e = typeof ts[1] === 'number' ? ts[1] : s + 0.6;
const txt = String(c.text || '').trim();
if (!txt) continue;
const parts = txt.split(/\s+/);
if (parts.length === 1) { words.push({ text: txt, start: s, end: Math.max(e, s + 0.2) }); continue; }
// Chunk multi-palabra (algunos builds devuelven segmentos): repartimos el
// tiempo por peso de caracteres → palabras aproximadas pero agrupables.
const weights = parts.map((p) => Math.max(p.length, 1));
const total = weights.reduce((a, b) => a + b, 0);
const span = Math.max(e - s, 0.15 * parts.length);
let t = s;
parts.forEach((p, i) => { const d = span * (weights[i] / total); words.push({ text: p, start: t, end: t + d }); t += d; });
}
words.sort((a, b) => a.start - b.start);
return words;
}
// ===== AGRUPACIÓN ESTILO CAPCUT: bloques de pocas palabras con corte natural =====
// Corta cuando: llega a maxWords palabras · hay una pausa > gap · el bloque
// dura más de maxDur · o la palabra anterior cerró frase (. ! ? …).
export function groupWordsIntoCaptions(words: AsrWord[], maxWords = 5, maxDur = 2.8, gap = 0.45): AsrCaption[] {
const caps: AsrCaption[] = [];
let cur: AsrWord[] = [];
const flush = () => {
if (!cur.length) return;
const text = cur.map((w) => w.text).join(' ').replace(/\s+([,.;:!?¡¿])/g, '$1').trim();
if (text) caps.push({ text, start: cur[0].start, end: Math.max(cur[cur.length - 1].end, cur[0].start + 0.4) });
cur = [];
};
for (const w of words) {
const prev = cur[cur.length - 1];
if (prev) {
const dur = w.end - cur[0].start;
const gapNow = w.start - prev.end;
const endsSentence = /[.!?…]$/.test(prev.text);
if (cur.length >= maxWords || gapNow > gap || dur > maxDur || (endsSentence && cur.length >= 2)) flush();
}
cur.push(w);
}
flush();
return caps;
}