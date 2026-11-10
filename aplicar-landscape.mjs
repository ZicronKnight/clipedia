// aplicar-landscape.mjs — modo visión en paisaje de celular (sin deformaciones)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-landscape', src);
const ops = [];
const VAR = '[@media(orientation:landscape)_and(max-width:1023px)]:';
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Preview más protagonista en paisaje (42% del alto visible)
rep('preview-landscape',
'className="relative h-[clamp(110px,20dvh,220px)] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-[clamp(160px,26dvh,300px)] lg:h-auto lg:min-h-0 lg:order-2">',
'className="relative h-[clamp(110px,20dvh,220px)] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-[clamp(160px,26dvh,300px)] ' + VAR + 'h-[42dvh] lg:h-auto lg:min-h-0 lg:order-2">');
// 2) Timeline con piso más chico en paisaje (entra sin aplastar)
rep('timeline-landscape',
'className="relative flex min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"',
'className="relative flex min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 ' + VAR + 'min-h-[70px] lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"');
// 3) La tarjeta de herramientas móvil se esconde en paisaje (sus acciones viven en el transporte desktop y en vertical)
rep('tools-landscape',
'<div className="flex shrink-0 gap-1.5 lg:hidden">',
'<div className="flex shrink-0 gap-1.5 lg:hidden ' + VAR + 'hidden">');
// 4) El panel de pestañas se esconde en paisaje (modo visión; edición en vertical o fullscreen)
rep('aside-landscape',
'<aside className="rounded-xl border border-slate-800 bg-slate-900/50 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">',
'<aside className="rounded-xl border border-slate-800 bg-slate-900/50 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden ' + VAR + 'hidden">');
fs.writeFileSync(PATH, src);
console.log('✅ Modo visión landscape aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-landscape');