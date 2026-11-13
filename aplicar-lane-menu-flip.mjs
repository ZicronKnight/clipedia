// aplicar-lane-menu-flip.mjs — el cajón del engranaje se reubica para verse completo (portal + clamp)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-laneflip', src);
const ops = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { console.error('❌ [' + name + '] ancla ' + c + ' veces (esperaba 1). NO se tocó nada.'); process.exit(1); }
  src = src.replace(search, replace); ops.push(name);
}
function span(name, start, end, content) {
  const s = src.indexOf(start); const e = src.indexOf(end);
  if (s === -1 || e === -1 || e <= s) { console.error('❌ [' + name + '] span no encontrado. NO se tocó nada.'); process.exit(1); }
  src = src.slice(0, s) + content + src.slice(e); ops.push(name);
}

// 1) Estado + ref + efecto de posicionamiento inteligente (justo después de clearLongPress)
rep('state+effect',
`function clearLongPress() {
if (longPressTimerRef.current) {
window.clearTimeout(longPressTimerRef.current);
longPressTimerRef.current = null;
}
}`,
`function clearLongPress() {
if (longPressTimerRef.current) {
window.clearTimeout(longPressTimerRef.current);
longPressTimerRef.current = null;
}
}
const laneMenuRef = useRef<HTMLDivElement>(null);
const [laneMenuPos, setLaneMenuPos] = useState<{ left: number; top: number; ready: boolean }>({ left: -9999, top: -9999, ready: false });
useLayoutEffect(() => {
if (!openLaneMenuId) { setLaneMenuPos((p) => (p.ready ? { ...p, ready: false } : p)); return; }
const el = laneMenuRef.current;
if (!el) return;
const place = () => {
const gear = document.querySelector('[data-lane-gear="' + openLaneMenuId + '"]') as HTMLElement | null;
if (!gear) { setOpenLaneMenuId(null); return; }
const r = gear.getBoundingClientRect();
const h = el.offsetHeight; const w = el.offsetWidth;
const vw = window.innerWidth; const vh = window.innerHeight; const m = 8;
let left = r.right + 6;
if (left + w > vw - m) left = Math.max(m, r.left - w - 6);
let top = r.top + r.height / 2 - h / 2;
top = Math.min(top, vh - m - h);
top = Math.max(m, top);
setLaneMenuPos({ left, top, ready: true });
};
place();
const onDocDown = (e: PointerEvent) => {
const t = e.target as HTMLElement;
if (t.closest('[data-lane-menu]') || t.closest('[data-lane-gear]')) return;
setOpenLaneMenuId(null);
};
window.addEventListener('resize', place);
window.addEventListener('scroll', place, true);
document.addEventListener('pointerdown', onDocDown);
return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); document.removeEventListener('pointerdown', onDocDown); };
}, [openLaneMenuId]);`);

// 2) renderLaneControls: mismo encabezado + engranaje (con data-lane-gear), SIN el cajón inline
span('renderLaneControls',
'function renderLaneControls(lane: TimelineLane) {',
'function executeDeleteTimelineLane(',
`function renderLaneControls(lane: TimelineLane) {
const siblings = laneList(lane.kind); const index = siblings.findIndex((x) => x.id === lane.id);
const count = lane.kind === 'audio' ? audioTracks.filter((x) => x.laneId === lane.id).length : lane.kind === 'image' ? imageOverlays.filter((x) => x.laneId === lane.id).length : lane.kind === 'video' ? videoOverlays.filter((x) => x.laneId === lane.id).length : textOverlays.filter((x) => x.laneId === lane.id).length;
const active = focusedLaneId === lane.id;
const isOpen = openLaneMenuId === lane.id;
return (
<div data-lane-controls="true" onPointerDown={(e) => e.stopPropagation()} onClick={() => { setFocusedLaneId(lane.id); setActiveLaneIds((prev) => ({ ...prev, [lane.kind]: lane.id })); }}
className={cx('sticky left-0 relative flex min-h-[48px] w-[52px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-l-lg border px-1 py-1 transition-all duration-150', isOpen ? 'z-40' : 'z-30', lane.muted ? 'border-rose-500/60 bg-[#2a0e17] shadow-[6px_0_14px_rgba(2,6,23,0.85)]' : active ? 'border-cyan-400/90 border-l-[3px] border-l-cyan-300 bg-gradient-to-r from-[#144b6b] via-[#0e2f4f] to-[#0a2038] shadow-[0_0_16px_rgba(34,211,238,0.32),6px_0_14px_rgba(2,6,23,0.9)]' : 'border-slate-800 bg-[#07111f] hover:border-slate-700 hover:bg-[#0b192c] shadow-[6px_0_14px_rgba(2,6,23,0.85)]')}>
<button type="button" onClick={(e) => { e.stopPropagation(); setFocusedLaneId(lane.id); setActiveLaneIds((prev) => ({ ...prev, [lane.kind]: lane.id })); }} className="flex w-full items-center justify-center gap-1 rounded py-0.5 leading-none transition" title={'Seleccionar ' + lane.name + ' como pista activa (' + count + ' clips)'}>
<span className={cx('text-[11px] font-black tracking-wide transition-colors', lane.muted ? 'text-rose-300 line-through' : active ? 'text-white drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]' : 'text-slate-400')}>{lane.name}</span>
{lane.muted ? (<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.95)]" />) : active ? (<span className="h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,1)] ring-2 ring-cyan-400/40" />) : null}
</button>
<button type="button" data-lane-gear={lane.id} onClick={(e) => { e.stopPropagation(); setFocusedLaneId(lane.id); setActiveLaneIds((prev) => ({ ...prev, [lane.kind]: lane.id })); setOpenLaneMenuId((prev) => (prev === lane.id ? null : lane.id)); }}
className={cx('flex h-6 w-8 items-center justify-center rounded-md border transition', isOpen ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'border-slate-700/80 bg-slate-800/70 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200')} title={'Opciones de pista ' + lane.name}>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cx('h-3.5 w-3.5 transition-transform duration-200', isOpen && 'rotate-90 text-cyan-300')} aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
</button>
</div>
);
}
`);

// 3) Portal del cajón (fijo, clamp a pantalla) insertado antes del menú contextual
rep('portal',
'{ctxMenu && typeof document !== \'undefined\' && createPortal(',
`{openLaneMenuId && typeof document !== 'undefined' && createPortal(
(() => {
const lane = timelineLanes.find((l) => l.id === openLaneMenuId);
if (!lane) return null;
const siblings = laneList(lane.kind);
const index = siblings.findIndex((x) => x.id === lane.id);
const count = lane.kind === 'audio' ? audioTracks.filter((x) => x.laneId === lane.id).length : lane.kind === 'image' ? imageOverlays.filter((x) => x.laneId === lane.id).length : lane.kind === 'video' ? videoOverlays.filter((x) => x.laneId === lane.id).length : textOverlays.filter((x) => x.laneId === lane.id).length;
return (
<div ref={laneMenuRef} data-lane-menu="true" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
style={{ left: laneMenuPos.left, top: laneMenuPos.top, visibility: laneMenuPos.ready ? 'visible' : 'hidden', transformOrigin: 'left center', animation: 'laneMenuPop 160ms cubic-bezier(0.16, 1, 0.3, 1)' }}
className="fixed z-[260] flex w-[206px] max-h-[calc(100vh-16px)] flex-col gap-1.5 overflow-y-auto rounded-xl border border-cyan-400/50 bg-slate-950/95 p-2 shadow-[0_10px_32px_rgba(0,0,0,0.9)] backdrop-blur-md">
<div className="flex items-center justify-between border-b border-slate-800/90 pb-1">
<div className="flex items-center gap-1.5">
<span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-black text-cyan-300">{lane.name}</span>
<span className="text-[10px] font-semibold text-slate-400">{count} {count === 1 ? 'clip' : 'clips'}</span>
</div>
<button type="button" onClick={() => setOpenLaneMenuId(null)} className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-white" title="Cerrar menú">✕</button>
</div>
<div className="grid grid-cols-2 gap-1.5">
<button type="button" onClick={() => toggleTimelineLaneMute(lane.id)} className={cx('flex h-7 items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-bold transition', lane.muted ? 'border-rose-400/60 bg-rose-500/20 text-rose-200' : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-400/50 hover:text-cyan-200')} title={lane.kind === 'audio' ? (lane.muted ? 'Activar sonido' : 'Silenciar pista') : (lane.muted ? 'Mostrar pista' : 'Ocultar pista')}>
{lane.kind === 'audio' ? (<><span>{lane.muted ? '🔇' : '🔊'}</span><span>{lane.muted ? 'Muda' : 'Sonando'}</span></>) : (<><span>{lane.muted ? '🙈' : '️'}</span><span>{lane.muted ? 'Oculta' : 'Visible'}</span></>)}
</button>
<button type="button" onClick={() => duplicateTimelineLane(lane.id)} className="flex h-7 items-center justify-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/15 px-2 text-[11px] font-bold text-violet-200 transition hover:border-violet-400 hover:bg-violet-500/25" title={'Duplicar la pista ' + lane.name + ' con todos sus clips'}><span>📑</span><span>Duplicar</span></button>
</div>
<div className="grid grid-cols-4 gap-1.5">
<button type="button" onClick={() => moveTimelineLane(lane.id, -1)} disabled={index <= 0} className="flex h-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-black text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:opacity-30" title="Subir pista">↑</button>
<button type="button" onClick={() => moveTimelineLane(lane.id, 1)} disabled={index >= siblings.length - 1} className="flex h-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-black text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200 disabled:opacity-30" title="Bajar pista">↓</button>
<button type="button" onClick={() => { addTimelineLane(lane.kind); setOpenLaneMenuId(null); }} className="flex h-7 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/15 text-[11px] font-bold text-cyan-200 transition hover:bg-cyan-500/25" title={'Crear nueva pista vacía de ' + lane.kind}>＋Pista</button>
<button type="button" onClick={() => { deleteTimelineLane(lane.id); setOpenLaneMenuId(null); }} className="flex h-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-400 transition hover:border-rose-500/60 hover:bg-rose-500/20 hover:text-rose-200" title="Eliminar esta pista">🗑️</button>
</div>
{(lane.kind === 'audio' || lane.kind === 'video') && (
<div onPointerDown={(e) => e.stopPropagation()} className="mt-0.5 flex items-center gap-1.5 rounded-lg border border-slate-800/90 bg-slate-900/80 px-2 py-1.5" title="Volumen de la pista">
<span className="shrink-0 text-xs">{(lane.volume ?? 1) === 0 ? '🔇' : '🔊'}</span>
<input type="range" min={0} max={1} step={0.01} value={lane.volume ?? 1} onChange={(e) => setTimelineLaneVolume(lane.id, Number(e.target.value))} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-cyan-400" />
<span className="w-8 shrink-0 text-right font-mono text-[10px] font-black text-cyan-300">{Math.round((lane.volume ?? 1) * 100)}%</span>
</div>
)}
</div>
);
})(),
document.body
)}
{ctxMenu && typeof document !== 'undefined' && createPortal(`);

// 4) Keyframe de aparición sin translateY (el centrado ya lo calcula el efecto)
rep('keyframe',
'@keyframes laneDrawerSlideIn { 0% { opacity: 0; transform: translateY(-50%) translateX(-14px) scaleX(0.92); } 100% { opacity: 1; transform: translateY(-50%) translateX(0) scaleX(1); } }',
'@keyframes laneDrawerSlideIn { 0% { opacity: 0; transform: translateY(-50%) translateX(-14px) scaleX(0.92); } 100% { opacity: 1; transform: translateY(-50%) translateX(0) scaleX(1); } } @keyframes laneMenuPop { 0% { opacity: 0; transform: translateX(-10px) scale(0.95); } 100% { opacity: 1; transform: translateX(0) scale(1); } }');

fs.writeFileSync(PATH, src);
console.log('✅ Cajón de pista inteligente aplicado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-laneflip');