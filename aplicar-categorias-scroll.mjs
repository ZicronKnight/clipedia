// aplicar-categorias-scroll.mjs — sidebar de categorías con scroll propio + filtro
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-catscroll', src);
const ops = []; const fails = [];

function rep(name, search, replace, expect = 1) {
  const c = src.split(search).length - 1;
  if (c !== expect) { fails.push(name + '(' + c + '≠' + expect + ')'); return; }
  src = src.split(search).join(replace); ops.push(name);
}
function repRe(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n !== 1) { fails.push(name + '(' + n + ')'); return; }
  src = src.replace(g, fn); ops.push(name);
}
// span que CORTA EN e: preserva el ancla de cierre (regla del manual)
function span(name, startRe, endRe, content) {
  const sm = new RegExp(startRe.source).exec(src);
  if (!sm) { fails.push(name + '(inicio)'); return; }
  const rest = src.slice(sm.index + sm[0].length);
  const em = new RegExp(endRe.source).exec(rest);
  if (!em) { fails.push(name + '(cierre)'); return; }
  const cut = sm.index + sm[0].length + em.index;
  src = src.slice(0, sm.index) + content + src.slice(cut);
  ops.push(name);
}

// 1) Estado del filtro de categorías
rep('estado-filtro',
"const [catK, setCatK] = useState<string>('Todos');",
"const [catK, setCatK] = useState<string>('Todos');\nconst [catQuery, setCatQuery] = useState('');");

// 2) Lista filtrada (acepta el nombre viejo o el nuevo del catálogo)
repRe('lista-filtrada',
/const baseCats = tab === 'sfx' \? (?:SFX_CATS|sfxCats) : STICKER_CATS;/,
(m) => m + `
const catFilteredList = (() => {
const q = catQuery.trim().toLowerCase();
const all = ['Todos', ...baseCats];
return q ? all.filter((c) => c.toLowerCase().includes(q)) : all;
})();`);

// 3) Sidebar: cabecera fija + lista scrolleable (la tarjeta LOCAL queda abajo)
span('aside-scroll',
/<aside className="hidden flex-col justify-between rounded-2xl border border-\[#192f4f\] bg-\[#071122\] p-3 lg:flex">/,
/\{\/\* Tarjeta inferior 100% LOCAL \*\/\}/,
`<aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-[#192f4f] bg-[#071122] p-3 lg:flex">
         <div className="shrink-0">
           <div className="mb-2 flex items-baseline justify-between gap-2 px-2">
             <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Categorías</p>
             <span className="shrink-0 font-mono text-[9px] font-bold text-cyan-400/70">{baseCats.length}</span>
           </div>
           <div className="relative mb-2">
             <input
               type="text"
               value={catQuery}
               onChange={(e) => setCatQuery(e.target.value)}
               placeholder="Filtrar categoría…"
               className="h-8 w-full rounded-lg border border-[#223f63] bg-[#091527] pl-8 pr-7 text-[11px] text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400"
             />
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-500" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
             {catQuery && (
               <button type="button" onClick={() => setCatQuery('')} className="absolute right-2 top-1.5 rounded px-1 text-[11px] font-bold text-slate-400 transition hover:text-white" title="Limpiar filtro">✕</button>
             )}
           </div>
         </div>
         <div className="sfxlib-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
           <nav className="space-y-1">
             {catFilteredList.map((cat) => {
               const active = activeCat === cat;
               return (
                 <button
                   key={cat}
                   onClick={() => setActiveCat(cat)}
                   title={cat + ' · ' + (catCounts[cat] ?? 0) + ' elementos'}
                   className={cx(
                     'flex w-full items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5 text-left text-[11.5px] font-bold transition',
                     active
                       ? 'border-fuchsia-400/60 bg-gradient-to-r from-violet-600/25 to-cyan-500/15 text-white shadow-[0_0_14px_rgba(168,85,247,0.2)]'
                       : 'border-transparent text-slate-300 hover:bg-[#0d1c34] hover:text-white'
                   )}
                 >
                   <span className="flex min-w-0 items-center gap-2">
                     {renderCatBadgeIcon(cat, active)}
                     <span className="truncate">{cat}</span>
                   </span>
                   <span className={cx('shrink-0 font-mono text-[10px]', active ? 'text-cyan-300' : 'text-slate-500')}>
                     {catCounts[cat] ?? 0}
                   </span>
                 </button>
               );
             })}
             {catFilteredList.length === 0 && (
               <p className="px-2 py-5 text-center text-[11px] leading-relaxed text-slate-500">Ninguna categoría coincide con "{catQuery}".</p>
             )}
           </nav>
           <div className="my-2.5 border-t border-[#162a47]" />
           <nav className="space-y-1 pb-1">
             {(['Favoritos', 'Recientes'] as const).map((special) => {
               const active = activeCat === special;
               return (
                 <button
                   key={special}
                   onClick={() => setActiveCat(special)}
                   title={special}
                   className={cx(
                     'flex w-full items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5 text-left text-[11.5px] font-bold transition',
                     active
                       ? 'border-fuchsia-400/60 bg-gradient-to-r from-violet-600/25 to-cyan-500/15 text-white'
                       : 'border-transparent text-slate-300 hover:bg-[#0d1c34] hover:text-white'
                   )}
                 >
                   <span className="flex min-w-0 items-center gap-2">
                     {renderCatBadgeIcon(special, active)}
                     <span className="truncate">{special}</span>
                   </span>
                   <span className={cx('shrink-0 font-mono text-[10px]', active ? 'text-cyan-300' : 'text-slate-500')}>
                     {catCounts[special] ?? 0}
                   </span>
                 </button>
               );
             })}
           </nav>
         </div>
         `);

// 4) La tarjeta LOCAL queda anclada abajo (no se estira ni se va)
rep('tarjeta-local',
'<div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-[#121633] to-[#0a1326] p-3">',
'<div className="mt-2 shrink-0 rounded-xl border border-violet-500/30 bg-gradient-to-br from-[#121633] to-[#0a1326] p-3">');

// 5) Un poco más de ancho para que los nombres largos no se trunquen tanto
rep('ancho-sidebar',
'lg:grid-cols-[195px_minmax(0,1fr)_395px]',
'lg:grid-cols-[212px_minmax(0,1fr)_395px]');

if (fails.length) { console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', ')); process.exit(1); }
fs.writeFileSync(PATH, src);
console.log('✅ Categorías con scroll aplicadas (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-catscroll');