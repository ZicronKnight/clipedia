// aplicar-preview-169.mjs — preview móvil crece (16:9 entero) + timeline acotada arriba
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-preview169', src);
const ops = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { console.error('❌ [' + name + '] ancla ' + c + ' veces (esperaba 1). NO se tocó nada.'); process.exit(1); }
  src = src.replace(search, replace); ops.push(name);
}
// 1) El área principal crece en móvil para que el preview pueda estirarse
rep('main-flex',
"'flex min-h-0 flex-col gap-2 lg:grid lg:flex-1",
"'flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:flex-1");
// 2) Preview móvil: de altura fija topada a flex-1 (crece y muestra el 16:9 completo)
rep('preview-grow',
"'relative h-[clamp(110px,20dvh,220px)] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-[clamp(160px,26dvh,300px)] [@media(orientation:landscape)_and_(max-width:1023px)]:h-[42dvh] lg:h-auto lg:min-h-0 lg:order-2'",
"'relative min-h-[150px] flex-1 overflow-hidden rounded-xl border border-slate-800 bg-black sm:min-h-[180px] [@media(orientation:landscape)_and_(max-width:1023px)]:h-[42dvh] [@media(orientation:landscape)_and_(max-width:1023px)]:flex-none lg:h-auto lg:min-h-0 lg:flex-none lg:order-2'");
// 3) Timeline móvil: altura acotada (deja de comerse el sobrante) → ese espacio va al preview
rep('timeline-cap',
"'relative min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 [@media(orientation:landscape)_and_(max-width:1023px)]:min-h-[70px] lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0'",
"'relative flex-none h-[26dvh] min-h-[120px] max-h-[230px] flex-col rounded-xl border border-slate-800 bg-slate-900/60 [@media(orientation:landscape)_and_(max-width:1023px)]:h-[38dvh] [@media(orientation:landscape)_and_(max-width:1023px)]:min-h-[70px] [@media(orientation:landscape)_and_(max-width:1023px)]:max-h-none lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0'");
fs.writeFileSync(PATH, src);
console.log('✅ Preview 16:9 móvil aplicado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-preview169');