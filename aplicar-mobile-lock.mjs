// aplicar-mobile-lock.mjs — móvil como app de altura fija: nada queda bajo la barra de Android
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-mobilelock', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Raíz: altura fija de viewport dinámico en móvil (100dvh ya descuenta la barra de Android)
rep('root-lock',
'<div className="flex flex-col gap-2 p-2 lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:overflow-hidden lg:p-4" onDragEnter={onDragEnter}',
'<div className="flex h-[100dvh] flex-col gap-2 overflow-hidden p-2 lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:p-4" onDragEnter={onDragEnter}');
// 2) Preview un pelín más chico en móvil para devolverle espacio a la timeline
rep('preview-mobile',
'className="relative h-44 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-64 lg:h-auto lg:min-h-0 lg:order-2"',
'className="relative h-40 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-56 lg:h-auto lg:min-h-0 lg:order-2"');
// 3) Columna de propiedades: deja de ser rígida en móvil (puede comprimirse)
rep('props-column',
'<div className="flex shrink-0 flex-col gap-2 lg:min-h-0 lg:flex-1 lg:gap-4 lg:order-3">',
'<div className="flex min-h-0 flex-col gap-2 lg:min-h-0 lg:flex-1 lg:gap-4 lg:order-3">');
// 4) El aside tabulado pasa a columna flex con altura negociable
rep('aside-flex',
'<aside className="rounded-xl border border-slate-800 bg-slate-900/50 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">',
'<aside className="flex min-h-0 flex-col rounded-xl border border-slate-800 bg-slate-900/50 lg:flex-1 lg:overflow-hidden">');
// 5) Contenido del panel: tope de 42dvh en móvil con scroll interno (nunca empuja la timeline)
rep('props-content-cap',
"<div className={cx('min-h-0 flex-1 lg:flex', propsOpen ? 'flex' : 'hidden')}>",
"<div className={cx('min-h-0 flex-1 overflow-hidden lg:flex', propsOpen ? 'flex max-h-[42dvh]' : 'hidden')}>");
// 6) Timeline: mínimo más chico para que SIEMPRE entre en el espacio restante
rep('timeline-min',
'className="relative flex min-h-[15rem] max-h-[36dvh] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"',
'className="relative flex min-h-[8rem] max-h-[38dvh] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"');
fs.writeFileSync(PATH, src);
console.log('✅ Mobile lock aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-mobilelock');