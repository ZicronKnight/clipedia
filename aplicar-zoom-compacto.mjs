// aplicar-zoom-compacto.mjs — barrita de zoom compacta en móvil, intacta en desktop
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-zoomcomp', src);
const ops = [];
function repRe(name, re, replace, expect) {
  const count = (src.match(re) || []).length;
  if (count !== expect) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba ' + expect + '). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(re, replace);
  ops.push(name);
}
function repAll(name, search, replace, expect) {
  const count = src.split(search).length - 1;
  if (count !== expect) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba ' + expect + '). NO se tocó el archivo.'); process.exit(1); }
  src = src.split(search).join(replace);
  ops.push(name);
}
// 1) Contenedor: menos padding y aire en móvil (regex tolera z-30/z-50 y bg /90//95)
repRe('zoom-container',
/className="absolute right-1\.5 top-1\.5 z-\d+ flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950\/\d+ p-1 shadow-lg[^"]*lg:right-3 lg:top-3"/,
'className="absolute right-1 top-1 z-50 flex items-center gap-0.5 rounded-md border border-slate-700 bg-slate-950/95 p-0.5 shadow-lg shadow-black/40 backdrop-blur lg:right-3 lg:top-3 lg:gap-1 lg:rounded-lg lg:p-1"', 1);
// 2) El porcentaje: más angosto y chiquito en móvil
repRe('zoom-span',
/<span className="w-\d+ text-center font-mono text-\[\d+px\] text-cyan-300">/,
'<span className="w-8 text-center font-mono text-[9px] text-cyan-300 lg:w-12 lg:text-[10px]">', 1);
// 3) Botones − y +: menos aire horizontal en móvil (aparecen 2 veces)
repAll('zoom-buttons',
'className="rounded px-2 py-0.5 text-xs font-bold text-slate-300 hover:bg-slate-800"',
'className="rounded px-1.5 py-1 text-xs font-bold text-slate-300 hover:bg-slate-800 lg:px-2 lg:py-0.5"', 2);
// 4) Botón 1:1: compacto en móvil
repAll('zoom-reset',
'className="rounded px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:bg-slate-800"',
'className="rounded px-1 py-1 text-[9px] font-bold text-slate-400 hover:bg-slate-800 lg:px-2 lg:py-0.5 lg:text-[10px]"', 1);
fs.writeFileSync(PATH, src);
console.log('✅ Zoom compacto aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-zoomcomp');