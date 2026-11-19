// aplicar-medialib-movil2.mjs — categorías en hoja inferior + preview plegable (toggle determinista)
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-mlmovil2', src);
const done = []; const skip = [];

function soft(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { skip.push(name); return; }
  src = src.replace(g, fn); done.push(name + (n > 1 ? '×' + n : ''));
}
function has(s) { return src.includes(s); }

// 1) Estados nuevos
if (!has('const [catSheet, setCatSheet]')) {
  const m = /const \[catK, setCatK\] = useState[^\r\n]*/.exec(src);
  if (m) {
    src = src.replace(m[0], m[0] + "\nconst [catSheet, setCatSheet] = useState(false);\nconst [catFilter, setCatFilter] = useState('');\nconst [prevCompact, setPrevCompact] = useState(false);");
    done.push('estados');
  } else skip.push('estados');
} else skip.push('estados-ya');

// 2) Lista filtrada para la hoja
if (!has('const sheetCats')) {
  soft('lista-filtrada', /const activeCat = tab === 'sfx' \? catS : catK;/, (m) => m + `
const sheetCats = (() => {
const q = catFilter.trim().toLowerCase();
const all = ['Todos', ...baseCats, 'Favoritos', 'Recientes'];
return q ? all.filter((c) => c.toLowerCase().includes(q)) : all;
})();`);
} else skip.push('lista-filtrada-ya');

// 3) Barra de categorías móvil → botón que abre la hoja
if (!has('setCatSheet(true)')) {
  const startRe = /\{\/\* Chips de categorías horizontales solo en móvil\/tablet \(< lg\) \*\/\}/;
  const endRe = /\{\/\* Grilla visual de tarjetas \*\/\}/;
  const sm = startRe.exec(src);
  if (sm) {
    const rest = src.slice(sm.index + sm[0].length);
    const em = endRe.exec(rest);
    if (em) {
      const cut = sm.index + sm[0].length + em.index;
      const nuevo = `{/* Categorías en móvil: botón que abre la hoja con buscador */}
         <div className="mb-2.5 flex shrink-0 items-center gap-1.5 lg:hidden">
           <button
             type="button"
             onClick={() => { setCatFilter(''); setCatSheet(true); }}
             className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border px-2.5 text-left transition active:scale-[0.99]"
             style={{ borderColor: (CAT_HUE[activeCat] || '#22d3ee') + '99', background: (CAT_HUE[activeCat] || '#22d3ee') + '1f' }}
             title="Elegir categoría"
           >
             <span className="flex shrink-0 items-center" style={{ color: CAT_HUE[activeCat] || '#22d3ee' }}>
               <CatIcon cat={activeCat} className="h-4 w-4" />
             </span>
             <span className="min-w-0 flex-1 truncate text-[11px] font-black uppercase tracking-wide text-white">{activeCat}</span>
             <span className="shrink-0 rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-200">{catCounts[activeCat] ?? 0}</span>
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
           </button>
           <span className="shrink-0 rounded-xl border border-[#223f63] bg-[#0a1729] px-2 py-2 font-mono text-[10px] font-bold text-slate-400" title="Total en esta vista">
             {(tab === 'sfx' ? sfxList.length : stkList.length)}
           </span>
         </div>
         `;
      src = src.slice(0, sm.index) + nuevo + src.slice(cut);
      done.push('barra-categorias');
    } else skip.push('barra-categorias(cierre)');
  } else skip.push('barra-categorias(inicio)');
} else skip.push('barra-categorias-ya');

// 4) Alto del lienzo: compacto opcional en móvil
soft('preview-alto',
/'h-\[38vw\] max-h-\[200px\] min-h-\[136px\] lg:h-44 lg:min-h-0 lg:max-h-none'/,
() => "prevCompact ? 'h-[74px] lg:h-44' : 'h-[30vw] max-h-[168px] min-h-[112px] lg:h-44 lg:min-h-0 lg:max-h-none'");

// 5) Toggle del lienzo: localizado por su aria-label ÚNICO (no agarra el de la cabecera)
if (!has('setPrevCompact((v) => !v)')) {
  const MARK = 'aria-label="Ampliar o reducir vista previa"';
  const at = src.indexOf(MARK);
  if (at === -1) skip.push('preview-toggle(sin aria-label)');
  else {
    const open = src.lastIndexOf('<button', at);
    const close = src.indexOf('</button>', at);
    if (open === -1 || close === -1) skip.push('preview-toggle(sin etiquetas)');
    else {
      const nuevo = `<button
                type="button"
                onClick={() => setPrevCompact((v) => !v)}
                title={prevCompact ? 'Ampliar vista previa' : 'Reducir vista previa'}
                aria-label="Cambiar tamaño de la vista previa"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-[#244269] bg-[#0b1930]/90 text-[11px] text-slate-300 transition hover:border-cyan-400 hover:text-white active:scale-90 lg:hidden"
              >
                {prevCompact ? '⤢' : '⤡'}
              </button>`;
      src = src.slice(0, open) + nuevo + src.slice(close + '</button>'.length);
      done.push('preview-toggle');
    }
  }
} else skip.push('preview-toggle-ya');

// 6) La preview deja de ser sticky (no tapa los sliders)
soft('preview-no-sticky',
/className="sticky top-0 z-30 order-1 -mx-3 bg-\[#050b18\]\/95 px-3 pb-3 pt-3 backdrop-blur-md lg:static lg:z-auto lg:order-none lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"/,
() => 'className="order-1 lg:order-none"');

// 7) Hoja inferior de categorías
if (!has('const catSheetUI')) {
  const m = /return createPortal\(/.exec(src);
  if (m) {
    const hoja = `const catSheetUI = catSheet ? (
<div className="fixed inset-0 z-[230] flex items-end bg-black/75 backdrop-blur-sm lg:hidden" onClick={() => setCatSheet(false)}>
<div onClick={(e) => e.stopPropagation()} className="flex max-h-[82dvh] w-full flex-col overflow-hidden rounded-t-2xl border-t-2 border-x-2 border-transparent" style={{ background: 'linear-gradient(#081428,#050b18) padding-box, linear-gradient(135deg,#22d3ee,#8b5cf6,#ec4899) border-box' }}>
<div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#192f4f] px-4 py-3">
<div className="min-w-0">
<p className="text-[13px] font-black text-white">Categorías</p>
<p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{tab === 'sfx' ? 'Sonidos' : 'Stickers'} · {sheetCats.length} disponibles</p>
</div>
<button type="button" onClick={() => setCatSheet(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#254269] bg-[#0a172b] text-[13px] font-black text-slate-300 transition active:scale-95" aria-label="Cerrar">✕</button>
</div>
<div className="shrink-0 px-4 pb-2 pt-3">
<div className="relative">
<input type="text" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} placeholder="Buscar categoría…" className="h-10 w-full rounded-xl border border-[#223f63] bg-[#091527] pl-9 pr-8 text-[13px] text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400" />
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
{catFilter && <button type="button" onClick={() => setCatFilter('')} className="absolute right-2.5 top-2.5 rounded px-1 text-[12px] font-bold text-slate-400 transition hover:text-white">✕</button>}
</div>
</div>
<div className="sfxlib-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-4">
<div className="grid grid-cols-2 gap-2">
{sheetCats.map((c) => {
const on = activeCat === c;
const hue = CAT_HUE[c] || '#22d3ee';
return (
<button key={c} type="button" onClick={() => { setActiveCat(c); setCatSheet(false); }} className={cx('flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left transition active:scale-[0.98]', on ? 'text-white' : 'border-[#1c3350] bg-[#0a1729]/80 text-slate-300')} style={on ? { borderColor: hue + 'cc', background: hue + '26', boxShadow: '0 0 12px ' + hue + '40' } : undefined}>
<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border" style={{ background: hue + '1f', borderColor: hue + '55', color: hue }}>
<CatIcon cat={c} className="h-4 w-4" />
</span>
<span className="min-w-0 flex-1">
<span className="block truncate text-[11.5px] font-bold leading-tight">{c}</span>
<span className="mt-0.5 block font-mono text-[9px] text-slate-500">{catCounts[c] ?? 0}</span>
</span>
</button>
);
})}
</div>
{sheetCats.length === 0 && <p className="py-8 text-center text-[12px] text-slate-500">Ninguna categoría coincide.</p>}
</div>
</div>
</div>
) : null;
`;
    src = src.slice(0, m.index) + hoja + src.slice(m.index);
    done.push('hoja-categorias');
  } else skip.push('hoja-categorias');
} else skip.push('hoja-categorias-ya');

// 8) Fragmento raíz + montaje de la hoja
if (!has('{catSheetUI}')) {
  soft('raiz-abre', /return createPortal\(\s*<div className="fixed inset-0 z-\[215\]/,
  () => 'return createPortal(\n<>\n<div className="fixed inset-0 z-[215]');
  soft('raiz-cierra', /<\/div>,\s*document\.body\s*\);\s*\}\s*export default MediaLibraryModal;/,
  () => '{catSheetUI}\n</>,\ndocument.body\n);\n}\nexport default MediaLibraryModal;');
} else skip.push('montaje-ya');

if (done.length === 0) {
  console.error('❌ Nada para aplicar. ¿Es este el mediaLibrary.tsx correcto? NO se tocó nada.');
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Aplicado:', done.join(', '));
if (skip.length) console.log('ℹ️ Ya estaba / no aplica:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-mlmovil2');