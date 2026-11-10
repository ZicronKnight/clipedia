// aplicar-mobile-fix.mjs — zoom abajo en móvil + drag táctil con fantasma (long-press)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-mobile', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Barra de zoom: abajo a la derecha en móvil, arriba en desktop
rep('zoombar',
'<div className="absolute right-1.5 top-1.5 z-30 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 shadow-lg backdrop-blur lg:right-3 lg:top-3">',
'<div className="absolute bottom-1.5 right-1.5 top-auto z-30 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 shadow-lg backdrop-blur lg:bottom-auto lg:right-3 lg:top-3">');
// 2) Refs y estado del fantasma
rep('refs',
'const timelinePanRef = useRef<TimelinePanDrag | null>(null);',
'const timelinePanRef = useRef<TimelinePanDrag | null>(null);\nconst liftTimerRef = useRef<number | null>(null);\nconst liftedRef = useRef(false);\nconst liftedHintRef = useRef(false);\nconst [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);');
// 3) Motor de long-press: congela el scroll táctil mientras sostenés
rep('helpers',
'function timeFromPointer(e: React.PointerEvent) {',
`// ===== LONG-PRESS TÁCTIL: sostené el clip y aparece una copia fantasma =====
useEffect(() => {
const onTM = (e: TouchEvent) => { if (liftedRef.current) e.preventDefault(); };
document.addEventListener('touchmove', onTM, { passive: false });
return () => document.removeEventListener('touchmove', onTM);
}, []);
function armLift(e: React.PointerEvent, label: string) {
if (e.pointerType !== 'touch') return;
if (liftTimerRef.current !== null) { clearTimeout(liftTimerRef.current); liftTimerRef.current = null; }
const sx = e.clientX; const sy = e.clientY;
liftTimerRef.current = window.setTimeout(() => {
liftTimerRef.current = null;
liftedRef.current = true;
setGhost({ x: sx, y: sy, label });
if (!liftedHintRef.current) { liftedHintRef.current = true; showToast('✋ Sostenido: movelo y soltalo donde quieras; el scroll queda congelado mientras tanto', 'info', 3200); }
if (typeof navigator !== 'undefined' && (navigator as any).vibrate) (navigator as any).vibrate(18);
}, 320);
}
function clearLift() {
if (liftTimerRef.current !== null) { clearTimeout(liftTimerRef.current); liftTimerRef.current = null; }
liftedRef.current = false;
setGhost(null);
}
function timeFromPointer(e: React.PointerEvent) {`);
// 4) Armar el lift al tomar un clip de V1
rep('arm-clip',
'moveDragRef.current = { id: clip.id, startX: e.clientX, active: false };',
'moveDragRef.current = { id: clip.id, startX: e.clientX, active: false };\narmLift(e, clip.name);');
// 5) Armar el lift al tomar overlays (texto/imagen/audio/capa)
rep('arm-overlay',
'overlayTimeDragRef.current = primary ? { ...primary, id, type, mode, startX: e.clientX, group } : null;',
'overlayTimeDragRef.current = primary ? { ...primary, id, type, mode, startX: e.clientX, group } : null;\nconst liftLabel = textOverlaysRef.current.find((x) => x.id === id)?.text || imageOverlaysRef.current.find((x) => x.id === id)?.name || audioTracksRef.current.find((x) => x.id === id)?.name || videoOverlaysRef.current.find((x) => x.id === id)?.name || 'elemento';\narmLift(e, String(liftLabel).slice(0, 26));');
// 6) moveMoveDrag: fantasma + cancel del timer si se mueve rápido
rep('move-clip',
'function moveMoveDrag(e: React.PointerEvent) {\nconst d = moveDragRef.current; if (!d) return; if (!d.active) { if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD) return; d.active = true; setDraggingId(d.id); } reorderToPointer(e, d.id);\n}',
'function moveMoveDrag(e: React.PointerEvent) {\nconst d = moveDragRef.current; if (!d) return;\nif (liftTimerRef.current !== null && Math.abs(e.clientX - d.startX) > 10) { clearTimeout(liftTimerRef.current); liftTimerRef.current = null; }\nif (liftedRef.current) setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));\nif (!d.active) { if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD) return; d.active = true; setDraggingId(d.id); } reorderToPointer(e, d.id);\n}');
// 7) moveOverlayTimeDrag: fantasma + cancel del timer
rep('move-overlay',
'function moveOverlayTimeDrag(e: React.PointerEvent) {\nconst d = overlayTimeDragRef.current; if (!d) return; const delta = (e.clientX - d.startX) / pps;',
'function moveOverlayTimeDrag(e: React.PointerEvent) {\nconst d = overlayTimeDragRef.current; if (!d) return; const delta = (e.clientX - d.startX) / pps;\nif (liftTimerRef.current !== null && Math.abs(e.clientX - d.startX) > 10) { clearTimeout(liftTimerRef.current); liftTimerRef.current = null; }\nif (liftedRef.current) setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));');
// 8 y 9) Soltar = limpiar fantasma
rep('end-clip',
'function endMoveDrag() { moveDragRef.current = null; setDraggingId(null); }',
'function endMoveDrag() { moveDragRef.current = null; setDraggingId(null); clearLift(); }');
rep('end-overlay',
'function endOverlayTimeDrag() { overlayTimeDragRef.current = null; }',
'function endOverlayTimeDrag() { overlayTimeDragRef.current = null; clearLift(); }');
// 10) El fantasma visual (portal)
rep('ghost-const',
'const importProgressUI = importProgress && typeof document !== \'undefined\' ? createPortal(',
`const ghostUI = ghost && typeof document !== 'undefined' ? createPortal(
<div className="pointer-events-none fixed z-[400] -translate-x-1/2 -translate-y-[130%] rounded-lg border border-cyan-300/70 bg-cyan-500/25 px-3 py-1.5 text-[11px] font-bold text-cyan-50 shadow-lg shadow-cyan-500/40 backdrop-blur-sm" style={{ left: ghost.x, top: ghost.y }}>
✋ {ghost.label}
</div>,
document.body
) : null;
const importProgressUI = importProgress && typeof document !== 'undefined' ? createPortal(`);
rep('ghost-render',
'{importProgressUI}',
'{importProgressUI}\n{ghostUI}');
// 11) Sin menú contextual fantasma durante el long-press
rep('ctx-menu',
'<div className="relative flex min-h-[15rem] max-h-[36dvh] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0" style=',
'<div onContextMenu={(e) => { if (liftedRef.current || liftTimerRef.current !== null) e.preventDefault(); }} className="relative flex min-h-[15rem] max-h-[36dvh] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0" style=');
fs.writeFileSync(PATH, src);
console.log('✅ Mobile-fix aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-mobile');