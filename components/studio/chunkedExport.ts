// ===== FASE 6 · PASO 3b: planificador de chunks para export escalable =====
export interface Chunk { index: number; start: number; end: number }
export interface ProtectedWindow { s: number; e: number }
// Bordes de chunk en GRILLA DE FRAME y NUNCA dentro de una ventana protegida
// (transición / acrossfade): si el borde cae ahí, el chunk se extiende hasta
// el final de la ventana. Devuelve chunks contiguos que cubren [0, total].
export function computeChunkBoundaries(total: number, protectedWins: ProtectedWindow[], targetLen = 60, fps = 30): Chunk[] {
if (total <= 0) return [];
const grid = 1 / fps;
const snap = (t: number) => Math.round(t / grid) * grid;
const sorted = [...protectedWins].sort((a, b) => a.s - b.s);
const chunks: Chunk[] = [];
let pos = 0;
let guard = 0;
while (pos < total - 1e-6 && guard++ < 10000) {
let next = Math.min(pos + targetLen, total);
if (next < total - 1e-6) {
next = snap(next);
for (const w of sorted) {
if (next > w.s + 1e-6 && next < w.e - 1e-6) { next = snap(Math.min(w.e, total)); break; }
}
if (next <= pos + 1e-6) next = snap(pos + grid);
}
const end = Math.min(next, total);
chunks.push({ index: chunks.length, start: pos, end });
pos = end;
}
return chunks;
}