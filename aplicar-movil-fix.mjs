// aplicar-movil-fix.mjs — (1) zoom bar sobre la regla sticky · (2) ghost táctil para drag entre pistas
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-movil', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) La barrita de zoom flota POR ENCIMA de la regla sticky
rep('zoom-z',
'<div className="absolute right-1.5 top-1.5 z-30 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 shadow-lg backdrop-blur lg:right-3 lg:top-3">',
'<div className="absolute right-1.5 top-1.5 z-50 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-1 shadow-lg shadow-black/40 backdrop-blur lg:right-3 lg:top-3">');
// 2) Refs y state del ghost táctil
rep('ghost-refs',
'const overlayPosDragRef = useRef<{ type: \'text\' | \'image\' | \'video\'; id: string } | null>(null);',
'const overlayPosDragRef = useRef<{ type: \'text\' | \'image\' | \'video\'; id: string } | null>(null);\nconst liftTimerRef = useRef<number | null>(null);\nconst liftedRef = useRef(false);\nconst lastPointerRef = useRef({ x: 0, y: 0 });\nconst ghostWRef = useRef(120);\nconst ghostRef = useRef<HTMLDivElement | null>(null);\nconst [ghost, setGhost] = useState<{ x: number; y: number; w: number; label: string; cls: string } | null>(null);');
// 3) Congelar el scroll del navegador mientras sostenés el clip
rep('touchmove-freeze',
'// ===== RESTAURAR AUTOSAVE =====',
'// ===== DRAG TÁCTIL CON "CLIP EN LA MANO": mientras esté levantado, el scroll se congela =====\nuseEffect(() => {\nconst onTouchMove = (e: TouchEvent) => { if (liftedRef.current) e.preventDefault(); };\nwindow.addEventListener(\'touchmove\', onTouchMove, { passive: false });\nreturn () => window.removeEventListener(\'touchmove\', onTouchMove);\n}, []);\n// ===== RESTAURAR AUTOSAVE =====');
// 4) Al iniciar drag táctil: timer de long-press que levanta el ghost
rep('lift-start',
'overlayTimeDragRef.current = primary ? { ...primary, id, type, mode, startX: e.clientX, group } : null;',
'overlayTimeDragRef.current = primary ? { ...primary, id, type, mode, startX: e.clientX, group } : null;\nlastPointerRef.current = { x: e.clientX, y: e.clientY };\nif (liftTimerRef.current) { window.clearTimeout(liftTimerRef.current); liftTimerRef.current = null; }\nliftedRef.current = false;\nif (e.pointerType === \'touch\' && mode === \'move\' && primary) {\nconst rect = (e.currentTarget as HTMLElement).getBoundingClientRect();\nconst nombre = type === \'text\' ? (textOverlaysRef.current.find((x) => x.id === id)?.text || \'Texto\') : type === \'image\' ? (imageOverlaysRef.current.find((x) => x.id === id)?.name || \'Imagen\') : type === \'audio\' ? (audioTracksRef.current.find((x) => x.id === id)?.name || \'Audio\') : (videoOverlaysRef.current.find((x) => x.id === id)?.name || \'Capa\');\nconst icono = type === \'text\' ? \'✏️ \' : type === \'image\' ? \'🖼️ \' : type === \'audio\' ? \'🎵 \' : \'🎞 \';\nconst cls = type === \'text\' ? \'rounded-md border-2 border-dashed border-fuchsia-300 bg-fuchsia-500/25 shadow-xl shadow-fuchsia-500/30 backdrop-blur-sm\' : type === \'image\' ? \'rounded-md border-2 border-dashed border-pink-300 bg-pink-500/25 shadow-xl shadow-pink-500/30 backdrop-blur-sm\' : type === \'audio\' ? \'rounded-md border-2 border-dashed border-green-300 bg-green-500/25 shadow-xl shadow-green-500/30 backdrop-blur-sm\' : \'rounded-md border-2 border-dashed border-amber-300 bg-amber-500/25 shadow-xl shadow-amber-500/30 backdrop-blur-sm\';\nconst w = Math.max(96, rect.width);\nghostWRef.current = w;\nliftTimerRef.current = window.setTimeout(() => {\nliftedRef.current = true;\ntry { (navigator as any).vibrate?.(12); } catch (e2) {}\nconst p = lastPointerRef.current;\nsetGhost({ x: p.x - w / 2, y: p.y - 74, w, label: icono + nombre, cls });\n}, 260);\n}');
// 5) En el move: el ghost sigue al dedo + lane-detect solo con mouse o clip levantado
rep('lift-move',
'const d = overlayTimeDragRef.current; if (!d) return; const delta = (e.clientX - d.startX) / pps;',
'const d = overlayTimeDragRef.current; if (!d) return; const delta = (e.clientX - d.startX) / pps;\nlastPointerRef.current = { x: e.clientX, y: e.clientY };\nif (liftTimerRef.current && !liftedRef.current && Math.abs(e.clientX - d.startX) > DRAG_THRESHOLD) { window.clearTimeout(liftTimerRef.current); liftTimerRef.current = null; }\nif (liftedRef.current && ghostRef.current) ghostRef.current.style.transform = `translate3d(${e.clientX - ghostWRef.current / 2}px, ${e.clientY - 74}px, 0)`;');
rep('lane-guard',
'const rowKey = laneRowUnderPointer(e);',
'const rowKey = (e.pointerType !== \'touch\' || liftedRef.current) ? laneRowUnderPointer(e) : null;');
// 6) Al soltar / cancelar: se apaga todo
rep('lift-end',
'function endOverlayTimeDrag() { overlayTimeDragRef.current = null; }',
'function endOverlayTimeDrag() {\noverlayTimeDragRef.current = null;\nif (liftTimerRef.current) { window.clearTimeout(liftTimerRef.current); liftTimerRef.current = null; }\nliftedRef.current = false;\nsetGhost(null);\n}');
// 7) El ghost translúcido flotando sobre todo
rep('ghost-render',
'{dragOver && (',
'{ghost && (\n<div ref={ghostRef} className="pointer-events-none fixed left-0 top-0 z-[60]" style={{ transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0)` }}>\n<div className={ghost.cls} style={{ width: ghost.w }}>\n<p className="truncate px-2 py-2 text-[10px] font-semibold text-white drop-shadow">{ghost.label}</p>\n</div>\n<p className="mt-1 text-center text-[9px] font-bold text-cyan-200 drop-shadow">soltá para ubicar acá</p>\n</div>\n)}\n{dragOver && (');
fs.writeFileSync(PATH, src);
console.log('✅ Móvil fix aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-movil');