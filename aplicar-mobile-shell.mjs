// aplicar-mobile-shell.mjs — app shell móvil: todo entra en la pantalla visible
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-shell', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Raíz con altura de viewport real + safe-area inferior
rep('root-shell',
'className="flex flex-col gap-2 p-2 lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:overflow-hidden lg:p-4"',
'className="flex h-[100vh] flex-col gap-2 overflow-hidden p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] supports-[height:100dvh]:h-[100dvh] lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:p-4 lg:pb-4"');
// 2) Preview proporcional en móvil
rep('preview-clamp',
'className="relative h-44 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-64 lg:h-auto lg:min-h-0 lg:order-2"',
'className="relative h-[clamp(110px,20dvh,220px)] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-[clamp(160px,26dvh,300px)] lg:h-auto lg:min-h-0 lg:order-2"');
// 3) Timeline = todo el espacio sobrante, con piso mínimo usable
rep('timeline-flex',
'className="relative flex min-h-[15rem] max-h-[36dvh] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"',
'className="relative flex min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"');
// 4) Propiedades móviles = hoja flotante (no roba altura del flujo)
rep('props-sheet',
"<aside className={`${propsOpen ? 'block' : 'hidden'} space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}>",
"<aside className={`${propsOpen ? 'block' : 'hidden'} fixed inset-x-2 bottom-2 top-14 z-40 space-y-4 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-4 shadow-2xl shadow-black/50 backdrop-blur lg:static lg:inset-auto lg:z-auto lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:bg-slate-900/50 lg:shadow-none lg:backdrop-blur-none`}>\n<button onClick={() => setPropsOpen(false)} className=\"w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-xs font-bold text-slate-300 lg:hidden\">▲ Cerrar propiedades</button>");
fs.writeFileSync(PATH, src);
console.log('✅ App shell móvil aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-shell');