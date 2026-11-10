// aplicar-fuga-luz.mjs — sella los bordes de la timeline: chau clips fugando por padding
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-fuga', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
function repAny(name, pairs) {
  for (const [s, r] of pairs) {
    if (src.split(s).length - 1 === 1) { src = src.replace(s, r); ops.push(name); return; }
  }
  ops.push(name + '-skip');
}
// 1) Scroll container: padding CERO arriba e izquierda (sticky flush al borde)
rep('scroll-padding',
'className={`min-h-0 flex-1 overflow-auto overscroll-contain p-2 [touch-action:pan-x_pan-y] lg:p-3 ${timelinePanning ? \'cursor-grabbing select-none\' : \'\'}`}',
'className={`min-h-0 flex-1 overflow-auto overscroll-contain p-0 pb-2 pr-2 [touch-action:pan-x_pan-y] lg:pb-3 lg:pr-3 ${timelinePanning ? \'cursor-grabbing select-none\' : \'\'}`}');
// 2) Regla sticky: fondo 100% opaco + esquina redondeada que acompaña el marco
rep('ruler-opaque',
'<div className="sticky top-0 z-40 flex w-full bg-slate-900/95 shadow-[0_3px_10px_rgba(0,0,0,0.28)] backdrop-blur-sm">',
'<div className="sticky top-0 z-40 flex w-full rounded-tl-xl bg-slate-900 shadow-[0_3px_10px_rgba(0,0,0,0.28)]">');
// 3) Celda de ticks de la regla: opaca
rep('ruler-cells-opaque',
'className="relative h-6 flex-none cursor-pointer select-none border-b border-slate-700 bg-slate-900/95 lg:h-7"',
'className="relative h-6 flex-none cursor-pointer select-none border-b border-slate-700 bg-slate-900 lg:h-7"');
// 4) Gutter de pistas (renderLaneControls): debajo de la regla al scrollear
rep('gutter-z-lanes',
'sticky left-0 z-30 flex min-h-[48px] w-[78px] shrink-0 flex-col justify-center gap-px rounded-l-lg border border-r border-slate-700/80',
'sticky left-0 z-20 flex min-h-[48px] w-[78px] shrink-0 flex-col justify-center gap-px rounded-l-lg border border-r border-slate-700/80');
// 5) Gutter de V1 FIJA: mismo trato
rep('gutter-z-v1',
'sticky left-0 z-30 flex w-[78px] shrink-0 flex-col justify-center gap-1 rounded-l-lg border border-r border-cyan-500/25',
'sticky left-0 z-20 flex w-[78px] shrink-0 flex-col justify-center gap-1 rounded-l-lg border border-r border-cyan-500/25');
// 6) Barrita de zoom por encima de la regla (si aún está en z-30)
repAny('zoom-z', [
['<div className="absolute right-1.5 top-1.5 z-30 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 shadow-lg backdrop-blur lg:right-3 lg:top-3">',
 '<div className="absolute right-1.5 top-1.5 z-50 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/95 p-1 shadow-lg shadow-black/40 backdrop-blur lg:right-3 lg:top-3">']
]);
fs.writeFileSync(PATH, src);
console.log('✅ Fuga de luz sellada:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-fuga');