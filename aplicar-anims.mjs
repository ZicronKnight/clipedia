// aplicar-anims.mjs — Etapa 1: animaciones de entrada/salida en overlays
// (modelo de datos + controles en Propiedades + preview en vivo)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
const BAK = PATH + '.bak-anims';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(BAK, src);
const ops = [];
const L = (...lines) => lines.join('\n');
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// ===== 1) Tipos y catálogo de animaciones =====
const SHAPE = `type OverlayShape = 'none' | 'round' | 'circle';`;
rep('types-catalog', SHAPE, L(
`type OverlayAnim = 'none' | 'from-left' | 'from-right' | 'from-top' | 'from-bottom' | 'zoom-in' | 'zoom-out';`,
`type OverlayAnimOut = 'none' | 'to-left' | 'to-right' | 'to-top' | 'to-bottom' | 'zoom-in' | 'zoom-out';`,
`const ANIM_IN_LABELS: Record<OverlayAnim, string> = { 'none': 'Sin animación', 'from-left': '↩️ Desde la izquierda', 'from-right': '↪️ Desde la derecha', 'from-top': '⬇️ Desde arriba', 'from-bottom': '⬆️ Desde abajo', 'zoom-in': '🔍 Zoom creciendo', 'zoom-out': '🔭 Zoom encogiendo' };`,
`const ANIM_OUT_LABELS: Record<OverlayAnimOut, string> = { 'none': 'Sin animación', 'to-left': '⬅️ Hacia la izquierda', 'to-right': '➡️ Hacia la derecha', 'to-top': '⬆️ Hacia arriba', 'to-bottom': '⬇️ Hacia abajo', 'zoom-in': '🔍 Zoom creciendo', 'zoom-out': '🔭 Zoom encogiendo' };`,
SHAPE));
// ===== 2) Campos en los tres tipos de overlay =====
rep('type-text',
`kind?: 'texto' | 'subtitulo'; laneId?: string;`,
`kind?: 'texto' | 'subtitulo'; laneId?: string; animIn?: OverlayAnim; animInDur?: number; animOut?: OverlayAnimOut; animOutDur?: number;`);
rep('type-image',
L(`x: number; y: number; size: number; rotate: 0 | 90 | 180 | 270; fadeIn: number; fadeOut: number;`,
`lane?: number; laneId?: string;`),
L(`x: number; y: number; size: number; rotate: 0 | 90 | 180 | 270; fadeIn: number; fadeOut: number;`,
`lane?: number; laneId?: string; animIn?: OverlayAnim; animInDur?: number; animOut?: OverlayAnimOut; animOutDur?: number;`));
rep('type-video',
L(`fadeIn: number; fadeOut: number; muted: boolean; shape: OverlayShape; hasAudio?: boolean; srcW?: number; srcH?: number;`,
`lane?: number; laneId?: string;`),
L(`fadeIn: number; fadeOut: number; muted: boolean; shape: OverlayShape; hasAudio?: boolean; srcW?: number; srcH?: number;`,
`lane?: number; laneId?: string; animIn?: OverlayAnim; animInDur?: number; animOut?: OverlayAnimOut; animOutDur?: number;`));
// ===== 3) Motor matemático (paridad preview↔export) =====
rep('helper',
`function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }`,
`function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }
// ===== ANIMACIONES DE ENTRADA/SALIDA DE OVERLAYS =====
// Convención de paridad: los slides recorren EXACTAMENTE un canvas de distancia
// (refW/refH), igual en el preview que en las expresiones FFmpeg del export.
// Easing smoothstep: suave al arranque y al freno, sin rebotes.
function animOffsets(a: { animIn?: OverlayAnim; animInDur?: number; animOut?: OverlayAnimOut; animOutDur?: number; start: number; end: number }, t: number, refW: number, refH: number): { dx: number; dy: number; f: number } {
const smooth = (p: number) => p * p * (3 - 2 * p);
const di = Math.max(0.05, a.animInDur ?? 0.5);
const doo = Math.max(0.05, a.animOutDur ?? 0.5);
const ei = a.animIn && a.animIn !== 'none' ? smooth(clamp((t - a.start) / di, 0, 1)) : 1;
const eo = a.animOut && a.animOut !== 'none' ? smooth(clamp((t - (a.end - doo)) / doo, 0, 1)) : 0;
let dx = 0; let dy = 0; let f = 1;
const vin = 1 - ei;
if (a.animIn === 'from-left') dx -= refW * vin;
if (a.animIn === 'from-right') dx += refW * vin;
if (a.animIn === 'from-top') dy -= refH * vin;
if (a.animIn === 'from-bottom') dy += refH * vin;
if (a.animIn === 'zoom-in') f *= 0.6 + 0.4 * ei;
if (a.animIn === 'zoom-out') f *= 1.3 - 0.3 * ei;
if (a.animOut === 'to-left') dx -= refW * eo;
if (a.animOut === 'to-right') dx += refW * eo;
if (a.animOut === 'to-top') dy -= refH * eo;
if (a.animOut === 'to-bottom') dy += refH * eo;
if (a.animOut === 'zoom-out') f *= 1 - 0.4 * eo;
if (a.animOut === 'zoom-in') f *= 1 + 0.3 * eo;
return { dx, dy, f };
}`);
// ===== 4) Preview: calcular el offset de animación por overlay =====
rep('preview-text-an',
`const localInWindow = playhead - activeText.start;`,
`const localInWindow = playhead - activeText.start;
const an = animOffsets(activeText, playhead, REF_WIDTH, REF_HEIGHT);`);
rep('preview-image-an',
`const localInWindow = playhead - activeImage.start;`,
`const localInWindow = playhead - activeImage.start;
const an = animOffsets(activeImage, playhead, REF_WIDTH, REF_HEIGHT);`);
rep('preview-vo-an',
`const liw = playhead - vo.start;`,
`const liw = playhead - vo.start;
const an = animOffsets(vo, playhead, REF_WIDTH, REF_HEIGHT);`);
// ===== 5) Preview: transform con translate/scale (conservando el zIndex del z-order) =====
rep('preview-text-style',
`style={{ left: activeText.x, top: activeText.y, transform: 'translate(-50%, -50%)', opacity: alpha, zIndex: paintKeyOf(activeText.laneId, activeText.kind === 'subtitulo' ? 'subtitle' : 'text', ati) }}`,
`style={{ left: activeText.x, top: activeText.y, transform: \`translate(-50%, -50%) translate(\${an.dx}px, \${an.dy}px) scale(\${an.f})\`, opacity: alpha, zIndex: paintKeyOf(activeText.laneId, activeText.kind === 'subtitulo' ? 'subtitle' : 'text', ati) }}`);
rep('preview-image-style',
`style={{ left: activeImage.x, top: activeImage.y, width: (activeImage.size / 100) * REF_WIDTH, transform: \`translate(-50%, -50%) rotate(\${activeImage.rotate}deg)\`, opacity: alpha, zIndex: paintKeyOf(activeImage.laneId, 'image', ai) }}`,
`style={{ left: activeImage.x, top: activeImage.y, width: (activeImage.size / 100) * REF_WIDTH, transform: \`translate(-50%, -50%) translate(\${an.dx}px, \${an.dy}px) scale(\${an.f}) rotate(\${activeImage.rotate}deg)\`, opacity: alpha, zIndex: paintKeyOf(activeImage.laneId, 'image', ai) }}`);
rep('preview-vo-style',
`style={{ left: vo.x, top: vo.y, width: (vo.size / 100) * REF_WIDTH, transform: \`translate(-50%, -50%) rotate(\${vo.rotate}deg)\`, opacity: voAlpha, visibility: inWin && !isLaneMuted(vo.laneId) ? 'visible' : 'hidden', clipPath: voClip, zIndex: paintKeyOf(vo.laneId, 'video', vi) }}`,
`style={{ left: vo.x, top: vo.y, width: (vo.size / 100) * REF_WIDTH, transform: \`translate(-50%, -50%) translate(\${an.dx}px, \${an.dy}px) scale(\${an.f}) rotate(\${vo.rotate}deg)\`, opacity: voAlpha, visibility: inWin && !isLaneMuted(vo.laneId) ? 'visible' : 'hidden', clipPath: voClip, zIndex: paintKeyOf(vo.laneId, 'video', vi) }}`);
// ===== 6) Controles en Propiedades (texto: sin zoom; imagen y capa: catálogo completo) =====
const TEXT_FADE_LABEL = `<label className="block select-none text-xs text-slate-400">Fade out: {selectedText.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedText.fadeOut} onChange={(e) => updateTextOverlay(selectedText.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>`;
const UI_TEXT = `<label className="block select-none text-xs text-slate-400">✨ Animación de entrada
<select value={selectedText.animIn || 'none'} onChange={(e) => updateTextOverlay(selectedText.id, { animIn: e.target.value as OverlayAnim })} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-fuchsia-400">
{(Object.keys(ANIM_IN_LABELS) as OverlayAnim[]).filter((k) => k !== 'zoom-in' && k !== 'zoom-out').map((k) => (<option key={k} value={k}>{ANIM_IN_LABELS[k]}</option>))}
</select></label>
{(selectedText.animIn && selectedText.animIn !== 'none') && (<label className="block select-none text-xs text-slate-400">Duración entrada: {(selectedText.animInDur ?? 0.5).toFixed(2)}s<input type="range" min={0.1} max={3} step={0.05} value={selectedText.animInDur ?? 0.5} onChange={(e) => updateTextOverlay(selectedText.id, { animInDur: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>)}
<label className="block select-none text-xs text-slate-400">✨ Animación de salida
<select value={selectedText.animOut || 'none'} onChange={(e) => updateTextOverlay(selectedText.id, { animOut: e.target.value as OverlayAnimOut })} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-fuchsia-400">
{(Object.keys(ANIM_OUT_LABELS) as OverlayAnimOut[]).filter((k) => k !== 'zoom-in' && k !== 'zoom-out').map((k) => (<option key={k} value={k}>{ANIM_OUT_LABELS[k]}</option>))}
</select></label>
{(selectedText.animOut && selectedText.animOut !== 'none') && (<label className="block select-none text-xs text-slate-400">Duración salida: {(selectedText.animOutDur ?? 0.5).toFixed(2)}s<input type="range" min={0.1} max={3} step={0.05} value={selectedText.animOutDur ?? 0.5} onChange={(e) => updateTextOverlay(selectedText.id, { animOutDur: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>)}
`;
rep('ui-text', TEXT_FADE_LABEL, TEXT_FADE_LABEL + '\n' + UI_TEXT);
const IMAGE_FADE_LABEL = `<label className="block select-none text-xs text-slate-400">Fade out: {selectedImage.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedImage.fadeOut} onChange={(e) => updateImageOverlay(selectedImage.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>`;
const UI_IMAGE = `<label className="block select-none text-xs text-slate-400">✨ Animación de entrada
<select value={selectedImage.animIn || 'none'} onChange={(e) => updateImageOverlay(selectedImage.id, { animIn: e.target.value as OverlayAnim })} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-pink-400">
{(Object.keys(ANIM_IN_LABELS) as OverlayAnim[]).map((k) => (<option key={k} value={k}>{ANIM_IN_LABELS[k]}</option>))}
</select></label>
{(selectedImage.animIn && selectedImage.animIn !== 'none') && (<label className="block select-none text-xs text-slate-400">Duración entrada: {(selectedImage.animInDur ?? 0.5).toFixed(2)}s<input type="range" min={0.1} max={3} step={0.05} value={selectedImage.animInDur ?? 0.5} onChange={(e) => updateImageOverlay(selectedImage.id, { animInDur: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>)}
<label className="block select-none text-xs text-slate-400">✨ Animación de salida
<select value={selectedImage.animOut || 'none'} onChange={(e) => updateImageOverlay(selectedImage.id, { animOut: e.target.value as OverlayAnimOut })} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-pink-400">
{(Object.keys(ANIM_OUT_LABELS) as OverlayAnimOut[]).map((k) => (<option key={k} value={k}>{ANIM_OUT_LABELS[k]}</option>))}
</select></label>
{(selectedImage.animOut && selectedImage.animOut !== 'none') && (<label className="block select-none text-xs text-slate-400">Duración salida: {(selectedImage.animOutDur ?? 0.5).toFixed(2)}s<input type="range" min={0.1} max={3} step={0.05} value={selectedImage.animOutDur ?? 0.5} onChange={(e) => updateImageOverlay(selectedImage.id, { animOutDur: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>)}
`;
rep('ui-image', IMAGE_FADE_LABEL, IMAGE_FADE_LABEL + '\n' + UI_IMAGE);
const VO_FADE_LABEL = `<label className="block select-none text-xs text-slate-400">Fade out (opacidad): {selectedVo.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedVo.fadeOut} onChange={(e) => updateVideoOverlay(selectedVo.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" /></label>`;
const UI_VO = `<label className="block select-none text-xs text-slate-400">✨ Animación de entrada
<select value={selectedVo.animIn || 'none'} onChange={(e) => updateVideoOverlay(selectedVo.id, { animIn: e.target.value as OverlayAnim })} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-amber-400">
{(Object.keys(ANIM_IN_LABELS) as OverlayAnim[]).map((k) => (<option key={k} value={k}>{ANIM_IN_LABELS[k]}</option>))}
</select></label>
{(selectedVo.animIn && selectedVo.animIn !== 'none') && (<label className="block select-none text-xs text-slate-400">Duración entrada: {(selectedVo.animInDur ?? 0.5).toFixed(2)}s<input type="range" min={0.1} max={3} step={0.05} value={selectedVo.animInDur ?? 0.5} onChange={(e) => updateVideoOverlay(selectedVo.id, { animInDur: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" /></label>)}
<label className="block select-none text-xs text-slate-400">✨ Animación de salida
<select value={selectedVo.animOut || 'none'} onChange={(e) => updateVideoOverlay(selectedVo.id, { animOut: e.target.value as OverlayAnimOut })} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-amber-400">
{(Object.keys(ANIM_OUT_LABELS) as OverlayAnimOut[]).map((k) => (<option key={k} value={k}>{ANIM_OUT_LABELS[k]}</option>))}
</select></label>
{(selectedVo.animOut && selectedVo.animOut !== 'none') && (<label className="block select-none text-xs text-slate-400">Duración salida: {(selectedVo.anim