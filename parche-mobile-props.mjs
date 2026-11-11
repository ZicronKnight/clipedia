#!/usr/bin/env node
/**
 * parche-mobile-props.mjs
 * Fix móvil: el panel de propiedades quedaba detrás de la timeline y el
 * layout se salía del borde inferior. Al abrir propiedades en celular,
 * la timeline y la tarjeta de herramientas se ocultan y el panel ocupa
 * ese espacio con scroll interno. Desktop queda intacto.
 *
 * Uso: node parche-mobile-props.mjs [ruta/a/Studio.tsx]
 * (sin argumento usa ./Studio.tsx)
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';

const target = resolve(process.argv[2] || './Studio.tsx');
if (!existsSync(target)) {
  console.error(`✖ No existe el archivo: ${target}`);
  process.exit(1);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Matcher tolerante a indentación/saltos de línea: mismos tokens, cualquier whitespace.
const flexFind = (src, find) => {
  const re = new RegExp(find.trim().split(/\s+/).map(escapeRe).join('\\s+'), 'g');
  return { re, count: (src.match(re) || []).length };
};

const steps = [
  {
    id: '1a', desc: 'Shell offset: medir con getBoundingClientRect (no offsetTop)',
    marker: `setShellOffset(Math.max(0, Math.round(top)))`,
    find: `const compute = () => setShellOffset(Math.max(0, el.offsetTop));`,
    replace: `const compute = () => { const top = el.getBoundingClientRect().top + window.scrollY; setShellOffset(Math.max(0, Math.round(top))); };`,
  },
  {
    id: '1b', desc: 'Shell offset: escuchar también visualViewport (barra del navegador móvil)',
    marker: `window.visualViewport?.addEventListener('resize', compute)`,
    find: `window.addEventListener('resize', compute);
window.addEventListener('orientationchange', compute);
return () => { window.removeEventListener('resize', compute); window.removeEventListener('orientationchange', compute); };`,
    replace: `window.addEventListener('resize', compute);
window.addEventListener('orientationchange', compute);
window.visualViewport?.addEventListener('resize', compute);
return () => { window.removeEventListener('resize', compute); window.removeEventListener('orientationchange', compute); window.visualViewport?.removeEventListener('resize', compute); };`,
  },
  {
    id: '2', desc: 'Contenedor principal: flex-1 en móvil cuando el panel está abierto',
    marker: `propsOpen && 'flex-1 [@media(orientation:landscape)_and_(max-width:1023px)]:flex-none'`,
    find: `<div className="flex min-h-0 flex-col gap-2 lg:grid lg:flex-1 lg:grid-cols-[116px_1fr_clamp(300px,26vw,380px)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-4">`,
    replace: `<div className={cx('flex min-h-0 flex-col gap-2 lg:grid lg:flex-1 lg:grid-cols-[116px_1fr_clamp(300px,26vw,380px)] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-4', propsOpen && 'flex-1 [@media(orientation:landscape)_and_(max-width:1023px)]:flex-none')}>`,
  },
  {
    id: '3', desc: 'Columna de propiedades: altura acotada (min-h-0 flex-1) en móvil',
    marker: `propsOpen ? 'min-h-0 flex-1 [@media(orientation:landscape)_and_(max-width:1023px)]:flex-none'`,
    find: `<div className="flex shrink-0 flex-col gap-2 lg:min-h-0 lg:flex-1 lg:gap-4 lg:order-3">`,
    replace: `<div className={cx('flex flex-col gap-2 lg:min-h-0 lg:flex-1 lg:gap-4 lg:order-3', propsOpen ? 'min-h-0 flex-1 [@media(orientation:landscape)_and_(max-width:1023px)]:flex-none' : 'shrink-0 lg:shrink')}>`,
  },
  {
    id: '4', desc: 'Aside de propiedades: flex-col + overflow-hidden + flex-1 acotado',
    marker: `'flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50`,
    find: `<aside className="rounded-xl border border-slate-800 bg-slate-900/50 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden [@media(orientation:landscape)_and_(max-width:1023px)]:hidden">`,
    replace: `<aside className={cx('flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 lg:min-h-0 lg:flex-1 [@media(orientation:landscape)_and_(max-width:1023px)]:hidden', propsOpen ? 'min-h-0 flex-1' : 'shrink-0 lg:shrink')}>`,
  },
  {
    id: '5a', desc: 'Pestaña móvil: resaltar solo cuando el panel está abierto',
    marker: `propsTab === t.id && propsOpen ? 'bg-cyan-500/15 text-cyan-300'`,
    find: `propsTab === t.id ? 'bg-cyan-500/15 text-cyan-300'`,
    replace: `propsTab === t.id && propsOpen ? 'bg-cyan-500/15 text-cyan-300'`,
  },
  {
    id: '5b', desc: 'Barra de pestañas móvil: botón ▾ para cerrar y volver a la timeline',
    marker: `aria-label="Cerrar propiedades"`,
    find: `{t.icon} <span className="w-full truncate text-center text-[8px] font-semibold leading-none">{t.label}</span>
</button>
))}
</div>`,
    replace: `{t.icon} <span className="w-full truncate text-center text-[8px] font-semibold leading-none">{t.label}</span>
</button>
))}
<button onClick={() => setPropsOpen(false)} aria-label="Cerrar propiedades" title="Volver a la timeline"
  className={cx('shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-cyan-300', !propsOpen && 'hidden')}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
</button>
</div>`,
  },
  {
    id: '6', desc: 'Tarjeta de herramientas móvil: ocultar con el panel abierto',
    marker: `cx('shrink-0 gap-1.5 lg:hidden`,
    find: `<div className="flex shrink-0 gap-1.5 lg:hidden [@media(orientation:landscape)_and_(max-width:1023px)]:hidden">`,
    replace: `<div className={cx('shrink-0 gap-1.5 lg:hidden [@media(orientation:landscape)_and_(max-width:1023px)]:hidden', propsOpen ? 'hidden' : 'flex')}>`,
  },
  {
    id: '7', desc: 'Timeline: ocultar en móvil portrait con panel abierto (desktop y landscape intactos)',
    marker: `propsOpen ? 'hidden lg:flex [@media(orientation:landscape)_and_(max-width:1023px)]:flex'`,
    find: `<div className="relative flex min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 [@media(orientation:landscape)_and_(max-width:1023px)]:min-h-[70px] lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0" style={{ '--tz': String(clamp(pps / DEFAULT_PPS, 1, 1.5)) } as React.CSSProperties}>`,
    replace: `<div className={cx('relative min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 [@media(orientation:landscape)_and_(max-width:1023px)]:min-h-[70px] lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0', propsOpen ? 'hidden lg:flex [@media(orientation:landscape)_and_(max-width:1023px)]:flex' : 'flex')} style={{ '--tz': String(clamp(pps / DEFAULT_PPS, 1, 1.5)) } as React.CSSProperties}>`,
  },
];

let src = readFileSync(target, 'utf8');
const report = [];
let failed = false;
let applied = 0;

for (const s of steps) {
  if (src.includes(s.marker)) { report.push(`↷ ${s.id}  ya aplicado — ${s.desc}`); continue; }
  const { re, count } = flexFind(src, s.find);
  if (count !== 1) {
    report.push(`✖ ${s.id}  FALLO (${count} coincidencias, se esperaba 1) — ${s.desc}`);
    failed = true;
    continue;
  }
  src = src.replace(re, () => s.replace);
  report.push(`✔ ${s.id}  aplicado — ${s.desc}`);
  applied += 1;
}

console.log(`\nStudio.tsx · parche propiedades móvil\n${'─'.repeat(52)}`);
report.forEach((l) => console.log(l));
console.log('─'.repeat(52));

if (failed) {
  console.error('\n✖ No se escribió nada. Algún bloque fue modificado (¿Qwen tocó esas líneas?).');
  console.error('  Buscá el ancla del paso fallado en el archivo y aplicalo a mano, o pasame el bloque actual.');
  process.exit(1);
}
if (applied === 0) {
  console.log('\n✅ El parche ya estaba aplicado por completo. No se tocó nada.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = join(dirname(target), `${basename(target)}.bak-${stamp}`);
copyFileSync(target, backup);
writeFileSync(target, src, 'utf8');
console.log(`\n✅ ${applied} cambio(s) aplicados.`);
console.log(`💾 Backup: ${backup}`);
console.log('👉 Verificá con tu build/dev server y probá en portrait: abrir Estilo oculta la timeline, cerrar (▾ o pestaña activa) la devuelve.');