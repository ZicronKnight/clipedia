// aplicar-preview-centrada.mjs — lienzo de la vista previa centrado horizontalmente (arriba) + transporte abajo
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-centrada', src);
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
//    Ancla de inicio + ancla ESTRUCTURAL del bloque de audio (nunca un ") : (" lazy).
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
             <div className="flex w-full flex-col gap-2.5">
               <div
                 className={cx(
                   'relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-[#1c3557] p-2 transition-all duration-200',
                   expandedPrev
                     ? 'h-[58vw] max-h-[340px] lg:h-64 lg:max-h-none'
                     : 'h-[38vw] max-h-[200px] min-h-[136px] lg:h-44 lg:min-h-0 lg:max-h-none'
                 )}
                 style={{ background: 'repeating-conic-gradient(#15233b 0% 25%, #0c1627 0% 50%) 0 0/16px 16px' }}
               >
                 <canvas ref={prevRef} className="mx-auto block max-h-full max-w-full object-contain" />
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
               <div className="flex w-full items-center gap-2 rounded-xl border border-[#172c47] bg-[#091629] px-2.5 py-2">
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
done.push('preview-centrada');

// 2) La tarjeta contenedora vuelve a flujo de bloque (sin flex residual que la descentre)
soft('card-bloque',
/flex flex-wrap items-center justify-center gap-x-2\.5 gap-y-2 (rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-2\.5) lg:block lg:p-3/,
(m, core) => core + ' lg:p-3');

soft('card-bloque-alt',
/flex flex-wrap items-center gap-x-2\.5 gap-y-2 (rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-2\.5) lg:block lg:p-3/,
(m, core) => core + ' lg:p-3');

fs.writeFileSync(PATH, src);
console.log('✅ Aplicado:', done.join(', '));
if (skip.length) console.log('ℹ️ Ya estaba / no aplica:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-centrada');