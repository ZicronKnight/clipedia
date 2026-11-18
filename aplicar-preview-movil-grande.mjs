// aplicar-preview-movil-grande.mjs — vista previa fija en móvil, pero GRANDE (38vw, no 92px)
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-prevgrande', src);
const done = [];
const skip = [];

function soft(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { skip.push(name); return; }
  src = src.replace(g, fn);
  done.push(name + (n > 1 ? '×' + n : ''));
}

// 1) Reemplazo determinista de la rama de preview de sticker.
//    ancla de inicio + ancla estructural del bloque de audio (NUNCA un ") : (" lazy).
const START = "{tab === 'sticker' ? (";
const startIdx = src.indexOf(START);
const sfxM = /flex items-center justify-between gap-3 rounded-xl border border-\[#1c3557\] bg-\[#0b192e\]/.exec(src);
if (startIdx === -1 || !sfxM) {
  console.error('❌ No encontré el bloque de vista previa. NO se tocó nada.');
  process.exit(1);
}
const sfxDiv = src.lastIndexOf('<div', sfxM.index);
if (sfxDiv <= startIdx) {
  console.error('❌ No pude delimitar el bloque. NO se tocó nada.');
  process.exit(1);
}

const BRANCH = `{tab === 'sticker' ? (
             <div className="flex flex-wrap items-center justify-center gap-2.5 lg:block">
               <div
                 className={cx(
                   'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#1c3557] p-1.5 transition-all duration-200 lg:w-full lg:p-3',
                   expandedPrev
                     ? 'h-[64vw] w-[64vw] min-h-[200px] min-w-[200px] max-h-[320px] max-w-[320px] lg:h-64 lg:min-h-0 lg:min-w-0 lg:max-h-none lg:max-w-none'
                     : 'h-[38vw] w-[38vw] min-h-[124px] min-w-[124px] max-h-[190px] max-w-[190px] lg:h-44 lg:min-h-0 lg:min-w-0 lg:max-h-none lg:max-w-none'
                 )}
                 style={{ background: 'repeating-conic-gradient(#15233b 0% 25%, #0c1627 0% 50%) 0 0/16px 16px' }}
               >
                 <canvas ref={prevRef} className="max-h-full max-w-full object-contain" />
                 <button
                   type="button"
                   onClick={() => setExpandedPrev((e) => !e)}
                   title={expandedPrev ? 'Reducir vista previa' : 'Ampliar vista previa'}
                   aria-label="Ampliar o reducir vista previa"
                   className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md border border-[#244269] bg-[#0b1930]/90 text-[11px] text-slate-300 transition hover:border-cyan-400 hover:text-white active:scale-90 lg:hidden"
                 >
                   {expandedPrev ? '🗗' : '⛶'}
                 </button>
               </div>
               <div className="flex min-w-[128px] flex-1 flex-col justify-center gap-2 lg:mt-2.5 lg:flex-row lg:items-center lg:gap-2.5">
                 <div className="flex min-w-0 items-center gap-2 lg:flex-1">
                   <button
                     type="button"
                     onClick={handleTogglePlay}
                     className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#25456b] bg-[#0b1a30] text-cyan-300 transition hover:border-cyan-400 hover:text-white active:scale-95 lg:h-7 lg:w-7"
                     title={isPlaying ? 'Pausar' : 'Reproducir'}
                   >
                     {isPlaying ? (
                       <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
                     ) : (
                       <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4"><path d="M8 5v14l11-7z" /></svg>
                     )}
                   </button>
                   <input
                     type="range"
                     min={0}
                     max={1}
                     step={0.005}
                     value={prog}
                     onChange={(e) => { setIsPlaying(false); setProg(+e.target.value); }}
                     className="sfxlib-range min-w-0 flex-1"
                     aria-label="Progreso de animación"
                   />
                 </div>
                 <div className="flex items-center justify-between gap-2 lg:contents">
                   <span className="shrink-0 font-mono text-[10px] text-slate-400">
                     {(prog * dur).toFixed(1)}s / {dur.toFixed(1)}s
                   </span>
                   <button
                     type="button"
                     onClick={() => setLoop((l) => !l)}
                     className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-slate-300"
                     title="Activar o desactivar bucle"
                   >
                     <span className={cx('relative inline-flex h-4 w-7 items-center rounded-full transition-colors', effectiveLoop ? 'bg-cyan-400' : 'bg-slate-700')}>
                       <span className={cx('inline-block h-3 w-3 transform rounded-full bg-[#050d1a] transition-transform', effectiveLoop ? 'translate-x-3.5' : 'translate-x-0.5')} />
                     </span>
                     <span className={effectiveLoop ? 'text-cyan-300' : 'text-slate-400'}>Bucle</span>
                   </button>
                 </div>
               </div>
             </div>
           ) : (
             `;

src = src.slice(0, startIdx) + BRANCH + src.slice(sfxDiv);
done.push('preview-grande');

// 2) La tarjeta容纳 canvas + controles en fila con wrap (y vuelve a bloque en desktop)
soft('card-wrap',
/'flex flex-wrap items-center gap-x-2\.5 gap-y-2 rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-2\.5 lg:block lg:p-3'/,
() => "'flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 rounded-2xl border border-[#192f4f] bg-[#071224] p-2.5 lg:block lg:p-3'");

// 3) Blindaje: si la tarjeta no tenía el layout móvil, se lo damos
soft('card-wrap-alt',
/<div className="rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-3">\s*<div className="mb-2 hidden/,
(m) => m.replace('rounded-2xl border border-[#192f4f] bg-[#071224] p-3', 'flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 rounded-2xl border border-[#192f4f] bg-[#071224] p-2.5 lg:block lg:p-3'));

// 4) Blindaje del bloque fijo superior (siempre visible en móvil)
if (!/sticky top-0 z-30 order-1/.test(src)) {
  soft('sticky-open',
  /\{\/\* TARJETA SUPERIOR: VISTA PREVIA \*\/\}\s*<div className="/,
  () => '{/* TARJETA SUPERIOR: VISTA PREVIA */}\n         <div className="sticky top-0 z-30 order-1 -mx-3 bg-[#050b18]/95 px-3 pb-3 pt-3 backdrop-blur-md lg:static lg:z-auto lg:order-none lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">\n         <div className="');
  soft('sticky-close',
  /\{\/\* TARJETA INFERIOR: PERSONALIZAR STICKER \/ AUDIO \*\/\}/,
  () => '</div>\n         {/* TARJETA INFERIOR: PERSONALIZAR STICKER / AUDIO */}');
  soft('body-pt0',
  /sfxlib-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:grid/,
  () => 'sfxlib-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pt-0 lg:grid');
  soft('wrapper-contents',
  /sfxlib-scroll order-1 flex shrink-0 flex-col gap-3 lg:order-3 lg:min-h-0 lg:shrink lg:overflow-y-auto lg:pr-0\.5/,
  () => 'sfxlib-scroll contents lg:order-3 lg:flex lg:min-h-0 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:pr-0.5');
  soft('personalizar-order',
  /<div className="rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-3">/,
  () => '<div className="order-2 rounded-2xl border border-[#192f4f] bg-[#071224] p-3 lg:order-none">');
  soft('catalogo-order',
  /order-2 flex min-w-0 flex-col rounded-2xl border border-\[#192f4f\] bg-\[#071122\] p-3 lg:order-2 lg:min-h-0/,
  () => 'order-3 flex min-w-0 flex-col rounded-2xl border border-[#192f4f] bg-[#071122] p-3 lg:order-2 lg:min-h-0');
} else {
  skip.push('sticky-ya-estaba');
}

// 5) Cabecera del monitor: solo desktop (en móvil el ⛶ vive sobre el lienzo)
soft('header-desktop',
/<div className="mb-2 flex items-center justify-between">/,
() => '<div className="mb-2 hidden w-full items-center justify-between lg:flex">');

fs.writeFileSync(PATH, src);
console.log('✅ Aplicado:', done.join(', '));
if (skip.length) console.log('ℹ️ Ya estaba / no aplica:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-prevgrande');