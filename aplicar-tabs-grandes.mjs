// aplicar-tabs-grandes.mjs — pestañas del panel más grandes SOLO en desktop
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-tabs', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// Rail más ancha y con más aire en desktop
rep('rail-ancho',
'<div className="hidden w-[86px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-slate-950/40 p-1.5 lg:flex">',
'<div className="hidden w-[86px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-slate-950/40 p-1.5 lg:flex lg:w-[104px] lg:gap-1.5 lg:p-2">');
// Botones de pestaña más altos en desktop
rep('rail-botones',
"className={cx('flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors', propsTab === t.id ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300' : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200')} title={t.label}>",
"className={cx('flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors lg:gap-1.5 lg:py-3', propsTab === t.id ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300' : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200')} title={t.label}>");
// Etiqueta un pelín más grande en desktop
rep('rail-label',
'{t.icon}<span className="w-full truncate px-1 text-center text-[9px] font-semibold leading-none">{t.label}</span>',
'{t.icon}<span className="w-full truncate px-1 text-center text-[9px] font-semibold leading-none lg:text-[10px]">{t.label}</span>');
// Íconos: 16px en móvil (igual que hoy), 24px en desktop
for (const icon of ['IconPropsInspector', 'IconPropsPalette', 'IconPropsWand', 'IconPropsCaptions', 'IconPropsWrench']) {
  rep('icon-' + icon, '<' + icon + ' className="h-4 w-4" />', '<' + icon + ' className="h-4 w-4 lg:h-6 lg:w-6" />');
}
fs.writeFileSync(PATH, src);
console.log('✅ Pestañas desktop agrandadas (' + ops.length + ' cambios):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-tabs');