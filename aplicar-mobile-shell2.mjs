// aplicar-mobile-shell2.mjs — app shell móvil v2 (sin anclas del aside viejo)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-shell2', src);
const ops = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + c + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Raíz = viewport real + safe-area inferior (chau overflow sobre los botones de Android)
rep('root-shell',
'className="flex flex-col gap-2 p-2 lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:overflow-hidden lg:p-4"',
'className="flex h-[100vh] flex-col gap-2 overflow-hidden p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] supports-[height:100dvh]:h-[100dvh] lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:p-4 lg:pb-4"');
// 2) Preview proporcional: se encoge solo en pantallas chicas
rep('preview-clamp',
'className="relative h-44 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-64 lg:h-auto lg:min-h-0 lg:order-2"',
'className="relative h-[clamp(110px,20dvh,220px)] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-[clamp(160px,26dvh,300px)] lg:h-auto lg:min-h-0 lg:order-2"');
// 3) Timeline = todo el espacio sobrante, con piso usable (scroll interno)
rep('timeline-flex',
'className="relative flex min-h-[15rem] max-h-[36dvh] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"',
'className="relative flex min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0"');
// 4) SUAVE: si el contenido del panel quedó siempre visible en móvil, lo colapsamos con propsOpen
const UNGATED = '<div className="flex min-h-0 flex-1">';
const GATED = "<div className={cx('min-h-0 flex-1 lg:flex', propsOpen ? 'flex' : 'hidden')}>";
if (src.split(UNGATED).length - 1 === 1) { src = src.replace(UNGATED, GATED); ops.push('props-gate'); }
else if (src.includes("propsOpen ? 'flex' : 'hidden'")) { ops.push('props-ya-gateado'); }
else { console.warn('⚠️ [props-gate] no encontré el wrapper de contenido del panel; sigo sin tocarlo (el fix de altura ya aplica igual).'); ops.push('props-gate-skip'); }
fs.writeFileSync(PATH, src);
console.log('✅ Mobile shell v2 aplicado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-shell2');