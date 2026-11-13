// aplicar-linea-volumen.mjs — línea de ganancia verde (Vegas/DaVinci) en cada clip de audio
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-gain', src);
const ops = [];

// 1) Estado de drag a nivel módulo (no necesita hook)
const ANCHOR = "let lastSegmentReason = '';";
if (src.split(ANCHOR).length - 1 !== 1) { console.error('❌ ancla lastSegmentReason no única'); process.exit(1); }
src = src.replace(ANCHOR, ANCHOR + "\nlet gainDragState: { id: string; startY: number; startVol: number; h: number } | null = null;");
ops.push('gain-state');

// 2) Insertar la línea + perilla justo después del <WaveformCanvas ... /> dentro del clip de audio
const re = /<WaveformCanvas[^>]*>/;
const m = src.match(re);
if (!m) { console.error('❌ no encontré <WaveformCanvas>'); process.exit(1); }
const GAIN = `
{(() => { const vol = track.muted ? 0 : clamp(track.volume ?? 1, 0, 1); const topPct = 82 - 62 * vol; return (<>
<div className="pointer-events-none absolute left-0 right-0 z-20" style={{ top: topPct + '%' }}>
<div className={cx('h-[2px] w-full', track.muted ? 'bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.8)]' : 'bg-green-400 shadow-[0_0_7px_rgba(74,222,128,0.9)]')} />
</div>
<div className="absolute right-0.5 z-30 flex -translate-y-1/2 cursor-ns-resize touch-none items-center gap-1" style={{ top: topPct + '%' }}
title="Línea de volumen: arrastrá ↕ para cambiar la ganancia del clip"
onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); const host = e.currentTarget.parentElement as HTMLElement; gainDragState = { id: track.id, startY: e.clientY, startVol: vol, h: host.getBoundingClientRect().height }; }}
onPointerMove={(e) => { const d = gainDragState; if (!d || d.id !== track.id) return; const nv = clamp(d.startVol + (d.startY - e.clientY) / Math.max(d.h * 0.62, 20), 0, 1); updateAudioTrack(track.id, { volume: Math.round(nv * 100) / 100, muted: false }); }}
onPointerUp={() => { gainDragState = null; }}
onPointerCancel={() => { gainDragState = null; }}>
<span className={cx('rounded bg-slate-950/85 px-1 font-mono text-[8px] font-black', track.muted ? 'text-rose-300' : 'text-green-300')}>{Math.round(vol * 100)}%</span>
<span className={cx('flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-black text-black', track.muted ? 'border-rose-300 bg-rose-400' : 'border-green-300 bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.9)]')}>↕</span>
</div>
</>); })()}
`;
src = src.replace(re, (tag) => tag + GAIN);
ops.push('gain-line');

fs.writeFileSync(PATH, src);
console.log('✅ Línea de volumen aplicada:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-gain');