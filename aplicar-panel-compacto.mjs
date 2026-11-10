// aplicar-panel-compacto.mjs — el rail de pestañas se comprime con la ventana (clamp vh/vw)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-compacto', src);
const ops = [];
function rep(name, search, replace, expect) {
  const count = src.split(search).length - 1;
  if (count !== expect) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba ' + expect + '). NO se tocó el archivo.'); process.exit(1); }
  src = src.split(search).join(replace);
  ops.push(name);
}
// 1) Columna del panel: se estrecha con el ancho de la ventana (300px mínimo, 380px máximo)
rep('grid-ancho',
'lg:grid-cols-[116px_1fr_380px]',
'lg:grid-cols-[116px_1fr_clamp(300px,26vw,380px)]', 1);
// 2) Rail vertical: ancho y aire internos proporcionales a la ventana
rep('rail-container',
'<div className="hidden w-[86px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-slate-950/40 p-1.5 lg:flex lg:w-[104px] lg:gap-1.5 lg:p-2">',
'<div className="hidden w-[86px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-slate-950/40 p-1.5 lg:flex lg:w-[clamp(72px,7vw,104px)] lg:gap-[clamp(2px,0.6vh,6px)] lg:p-[clamp(4px,1vh,8px)]">', 1);
// 3) Botones de pestaña: reparten la altura disponible y se aprietan solos
rep('rail-botones',
"'flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors lg:gap-1.5 lg:py-3'",
"'flex min-h-0 flex-1 flex-col items-center justify-center gap-[clamp(2px,0.6vh,6px)] rounded-lg border py-1 transition-colors'", 1);
// 4) Íconos: tamaño con clamp de altura de ventana (igual que el rail de imports)
rep('rail-iconos',
'className="h-4 w-4 lg:h-6 lg:w-6"',
'className="h-[clamp(14px,2.4vh,24px)] w-[clamp(14px,2.4vh,24px)]"', 5);
// 5) Etiquetas: tipografía que encoge con la ventana
rep('rail-labels',
'<span className="w-full truncate px-1 text-center text-[9px] font-semibold leading-none lg:text-[10px]">{t.label}</span>',
'<span className="w-full truncate px-1 text-center text-[clamp(7px,1.1vh,10px)] font-semibold leading-none">{t.label}</span>', 1);
fs.writeFileSync(PATH, src);
console.log('✅ Panel compacto aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-compacto');