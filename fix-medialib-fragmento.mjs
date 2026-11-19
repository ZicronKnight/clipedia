// fix-medialib-fragmento.mjs — repara el fragmento del portal y completa el móvil (idempotente)
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-fragfix', src);
const done = [];
const skip = [];
const has = (s) => src.includes(s);
const MARK = 'return createPortal(';

// ── 1) Estados del móvil ──
if (!has('const [catSheet, setCatSheet]')) {
  const A = "const [catK, setCatK] = useState<string>('Todos');";
  const at = src.indexOf(A);
  if (at === -1) skip.push('estados(ancla catK)');
  else {
    const ins = "\nconst [catSheet, setCatSheet] = useState(false);\nconst [catFilter, setCatFilter] = useState('');\nconst [prevCompact, setPrevCompact] = useState(false);";
    src = src.slice(0, at + A.length) + ins + src.slice(at + A.length);
    done.push('estados');
  }
} else skip.push('estados-ya');

// ── 2) Lista filtrada de la hoja ──
if (!has('const sheetCats')) {
  const A = "const activeCat = tab === 'sfx' ? catS : catK;";
  const at = src.indexOf(A);
  if (at === -1) skip.push('sheetCats(ancla activeCat)');
  else {
    const ins = `
const sheetCats = (() => {
const q = catFilter.trim().toLowerCase();
const all = ['Todos', ...baseCats, 'Favoritos', 'Recientes'];
return q ? all.filter((c) => c.toLowerCase().includes(q)) : all;
})();`;
    src = src.slice(0, at + A.length) + ins + src.slice(at + A.length);
    done.push('sheetCats');
  }
} else skip.push('sheetCats-ya');

// ── 3) Barra de categorías móvil: botón que abre la hoja ──
if (!has('setCatSheet(true)')) {
  const s = src.indexOf('{/* Chips de categorías horizontales solo en móvil/tablet (< lg) */}');
  const e = s < 0 ? -1 : src.indexOf('{/* Grilla visual de tarjetas */}', s);
  if (s < 0 || e < 0) skip.push('barra-categorias(anclas)');
  else {
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
    src = src.slice(0, s) + nuevo + src.slice(e);
    done.push('barra-categorias');
  }
} else skip.push('barra-categorias-ya');

// ── 4) Alto del lienzo con modo compacto ──
{
  const OLD = "'h-[38vw] max-h-[200px] min-h-[136px] lg:h-44 lg:min-h-0 lg:max-h-none'";
  if (has(OLD)) {
    src = src.replace(OLD, "prevCompact ? 'h-[74px] lg:h-44' : 'h-[30vw] max-h-[168px] min-h-[112px] lg:h-44 lg:min-h-0 lg:max-h-none'");
    done.push('preview-alto');
  } else skip.push('preview-alto-ya');
}

// ── 5) Toggle del lienzo (localizado por aria-label único) ──
if (!has('setPrevCompact((v) => !v)')) {
  const MARK2 = 'aria-label="Ampliar o reducir vista previa"';
  const at = src.indexOf(MARK2);
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

// ── 6) La vista previa deja de ser sticky en móvil ──
{
  const OLD = 'className="sticky top-0 z-30 order-1 -mx-3 bg-[#050b18]/95 px-3 pb-3 pt-3 backdrop-blur-md lg:static lg:z-auto lg:order-none lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"';
  if (has(OLD)) {
    src = src.replace(OLD, 'className="order-1 lg:order-none"');
    done.push('preview-no-sticky');
  } else skip.push('preview-no-sticky-ya');
}

// ── 7) Declaración de la hoja de categorías ──
if (!has('const catSheetUI')) {
  const at = src.lastIndexOf(MARK);
  if (at === -1) { console.error('❌ No encontré return createPortal(. NO se tocó nada.'); process.exit(1); }
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
  src = src.slice(0, at) + hoja + src.slice(at);
  done.push('hoja-categorias');
} else skip.push('hoja-categorias-ya');

// ── 8) EL FIX CRÍTICO: abrir el fragmento por índice ──
{
  const at = src.lastIndexOf(MARK);
  const after = at + MARK.length;
  const head = src.slice(after, after + 80).trimStart();
  if (head.startsWith('<>')) skip.push('fragmento-ya-abierto');
  else {
    src = src.slice(0, after) + '\n<>' + src.slice(after);
    done.push('fragmento-abierto');
  }
}

// ── 9) Montaje de la hoja + cierre del fragmento ──
if (!has('{catSheetUI}')) {
  const re = /<\/div>,\s*document\.body\s*\);\s*\}\s*export default MediaLibraryModal;/;
  if (!re.test(src)) skip.push('montaje(ancla final)');
  else {
    src = src.replace(re, '{catSheetUI}\n</>,\ndocument.body\n);\n}\nexport default MediaLibraryModal;');
    done.push('montaje');
  }
} else if (!/<\/>,\s*document\.body/.test(src)) {
  const re = /<\/div>\s*\{catSheetUI\}\s*,?\s*document\.body/;
  if (re.test(src)) {
    src = src.replace(re, '</div>\n{catSheetUI}\n</>,\ndocument.body');
    done.push('cierre-fragmento');
  } else skip.push('cierre-fragmento(ancla)');
} else skip.push('montaje-ya');

// ── 10) Verificación estructural del portal ──
{
  const at = src.lastIndexOf(MARK);
  const tail = src.slice(at);
  const problems = [];
  if (!/^\s*return createPortal\(\s*<>/.test(tail)) problems.push('el fragmento no abre justo después de createPortal(');
  if (!/\{catSheetUI\}/.test(tail)) problems.push('falta {catSheetUI} en el portal');
  if (!/<\/>,\s*document\.body/.test(tail)) problems.push('falta </> antes de document.body');
  if (!has('const catSheetUI')) problems.push('falta const catSheetUI');
  if (!has('const [catSheet, setCatSheet]')) problems.push('falta el estado catSheet');
  if (!has('const sheetCats')) problems.push('falta sheetCats');
  if (problems.length) {
    console.error('❌ NO se escribió nada. Problemas:');
    problems.forEach((p) => console.error('   · ' + p));
    console.error('Restaurá: copy components\\studio\\mediaLibrary.tsx.bak-fragfix components\\studio\\mediaLibrary.tsx');
    process.exit(1);
  }
}

fs.writeFileSync(PATH, src);
console.log('✅ Reparado:', done.length ? done.join(', ') : '(nada que cambiar)');
if (skip.length) console.log('ℹ️ Ya estaba / no aplica:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-fragfix');