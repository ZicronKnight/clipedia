// aplicar-preview-apilada.mjs — preview a lo ancho arriba + barra de transporte abajo
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-apilada', src);
const done = [];
const skip = [];
function soft(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { skip.push(name); return; }
  src = src.replace(g, fn);
  done.push(name + (n > 1 ? '×' + n : ''));
}

// 1) Rama de preview de sticker: reemplazo determinista (marcador de inicio + ancla estructural del bloque de audio)
const START = '{tab === \'sticker\' ? (';
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
             <div className="flex flex-col gap-2.5">
               <div
                 className={cx(
                   'relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-[#1c3557] p-2 transition-all duration-200',
                   expandedPrev
                     ? 'h-[58vw] max-h-[340px] lg:h-64 lg:max-h-none'
                     : 'h-[38vw] max-h-[200px] min-h-[136px] lg:h-44 lg:min-h-0 lg:max-h-none'
                 )}
                 style={{ background: 'repeating-conic-gradient(#15233b 0% 25%, #0c1627 0% 50%) 0 0/16px 16px' }}
               >
                 <canvas ref={prevRef} className="max-h-full max-w-full object-contain" />
                 <button
                   type="button"
                   onClick={() => setExpandedPrev((e) => !e)}
                   title={expandedPrev ? 'Reducir vista previa' : 'Ampliar vista previa'}
                   aria-label="Ampliar o reducir vista previa"
                   className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-[#244269] bg-[#0b1930]/90 text-[11px] text-slate-300 transition hover:border-cyan-400 hover:text-white active:scale-90"
                 >
                   {expandedPrev ? '🗗' : '⛶'}
                 </button>
               </div>
               <div className="flex items-center gap-2 rounded-xl border border-[#172c47] bg-[#091629] px-2.5 py-2">
                 <button
                   type="button"
                   onClick={handleTogglePlay}
                   className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-500/15 text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/30 active:scale-90"
                   title={isPlaying ? 'Pausar' : 'Reproducir'}
                   aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
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
                 <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                   {(prog * dur).toFixed(1)}s / {dur.toFixed(1)}s
                 </span>
                 <button
                   type="button"
                   onClick={() => setLoop((l) => !l)}
                   className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold"
                   title={effectiveLoop ? 'Bucle activado' : 'Reproducir una sola vez'}
                   aria-label="Alternar bucle"
                 >
                   <span className={cx('relative inline-flex h-4 w-7 items-center rounded-full transition-colors', effectiveLoop ? 'bg-cyan-400' : 'bg-slate-700')}>
                     <span className={cx('inline-block h-3 w-3 transform rounded-full bg-[#050d1a] transition-transform', effectiveLoop ? 'translate-x-3.5' : 'translate-x-0.5')} />
                   </span>
                   <span className={cx('hidden min-[380px]:inline', effectiveLoop ? 'text-cyan-300' : 'text-slate-400')}>Bucle</span>
                 </button>
               </div>
             </div>
           ) : (
             `;
src = src.slice(0, startIdx) + BRANCH + src.slice(sfxDiv);
done.push('preview-apilada');

// 2) La tarjeta vuelve a flujo vertical (ya no reparte canvas y controles en fila)
soft('card-vertical',
/flex flex-wrap items-center justify-center gap-x-2\.5 gap-y-2 (rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-2\.5) lg:block lg:p-3/,
(m, core) => core + ' lg:p-3');

// 3) Blindaje: si el bloque fijo superior no existiera, se crea
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

fs.writeFileSync(PATH, src);
console.log('✅ Aplicado:', done.join(', '));
if (skip.length) console.log('ℹ️ Ya estaba / no aplica:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-apilada');