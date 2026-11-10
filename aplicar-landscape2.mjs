// aplicar-landscape2.mjs — modo visión en paisaje (ancla del preview a prueba de ternario)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-landscape2', src);
const ops = [];
const VAR = '[@media(orientation:landscape)_and(max-width:1023px)]:';
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Preview más protagonista en paisaje (ancla = el contenido de las clases, sin comillas)
rep('preview-landscape',
'relative h-[clamp(110px,20dvh,220px)] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-[clamp(160px,26dvh,300px)] lg:h-auto lg:min-h-0 lg:order-2',
'relative h-[clamp(110px,20dvh,220px)] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-[clamp(160px,26dvh,300px)] ' + VAR + 'h-[42dvh] lg:h-auto lg:min-h-0 lg:order-2');
// 2) Timeline con piso más chico en paisaje
rep('timeline-landscape',
'className="relative flex min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"',
'className="relative flex min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 ' + VAR + 'min-h-[70px] lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"');
// 3) Tarjeta de herramientas móvil oculta en paisaje
rep('tools-landscape',
'<div className="flex shrink-0 gap-1.5 lg:hidden">',
'<div className="flex shrink-0 gap-1.5 lg:hidden ' + VAR + 'hidden">');
// 4) Panel de pestañas oculto en paisaje (modo visión)
rep('aside-landscape',
'<aside className="rounded-xl border border-slate-800 bg-slate-900/50 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">',
'<aside className="rounded-xl border border-slate-800 bg-slate-900/50 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden ' + VAR + 'hidden">');
fs.writeFileSync(PATH, src);
console.log('✅ Modo visión landscape v2 aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-landscape2');