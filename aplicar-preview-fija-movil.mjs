// aplicar-preview-fija-movil.mjs — la vista previa queda SIEMPRE visible en móvil (sticky compacta)
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-stickyprev', src);
const done = [];
const skip = [];
function soft(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { skip.push(name); return; }
  src = src.replace(g, fn);
  done.push(name + (n > 1 ? '×' + n : ''));
}

// 1) El scroll del cuerpo arranca pegado arriba (la tarjeta fija tapa el borde)
soft('body-pt0',
/sfxlib-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:grid/,
() => 'sfxlib-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pt-0 lg:grid');

// 2) En móvil el envoltorio desaparece (contents): preview y personalizador pasan
//    a ser hijos directos del scroll → el sticky vale para TODO el recorrido.
soft('wrapper-contents',
/sfxlib-scroll order-1 flex shrink-0 flex-col gap-3 lg:order-3 lg:min-h-0 lg:shrink lg:overflow-y-auto lg:pr-0\.5/,
() => 'sfxlib-scroll contents lg:order-3 lg:flex lg:min-h-0 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:pr-0.5');

// 3) Cabecera de la tarjeta: solo desktop (en móvil el monitor ya se explica solo)
soft('header-desktop',
/<div className="mb-2 flex items-center justify-between">/,
() => '<div className="mb-2 hidden items-center justify-between lg:flex">');

// 4) La tarjeta de vista previa se vuelve un bloque fijo arriba en móvil
soft('sticky-open',
/\{\/\* TARJETA SUPERIOR: VISTA PREVIA \*\/\}\s*<div className="rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-3">/,
() => '{/* TARJETA SUPERIOR: VISTA PREVIA */}\n         <div className="sticky top-0 z-30 order-1 -mx-3 bg-[#050b18]/95 px-3 pb-2 pt-3 backdrop-blur-md lg:static lg:z-auto lg:order-none lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">\n         <div className="rounded-2xl border border-[#192f4f] bg-[#071224] p-2.5 lg:p-3">');

soft('sticky-close',
/\{\/\* TARJETA INFERIOR: PERSONALIZAR STICKER \/ AUDIO \*\/\}/,
() => '</div>\n         {/* TARJETA INFERIOR: PERSONALIZAR STICKER / AUDIO */}');

// 5) Orden móvil: preview (1) → personalizar (2) → catálogo (3)
soft('personalizar-order',
/<div className="rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-3">/,
() => '<div className="order-2 rounded-2xl border border-[#192f4f] bg-[#071224] p-3 lg:order-none">');

soft('catalogo-order',
/order-2 flex min-w-0 flex-col rounded-2xl border border-\[#192f4f\] bg-\[#071122\] p-3 lg:order-2 lg:min-h-0/,
() => 'order-3 flex min-w-0 flex-col rounded-2xl border border-[#192f4f] bg-[#071122] p-3 lg:order-2 lg:min-h-0');

// 6) Monitor compacto en móvil: lienzo a la izquierda + transporte a la derecha
soft('monitor-compacto',
/\{tab === 'sticker' \? \([\s\S]*?\) : \(/,
() => `{tab === 'sticker' ? (
             <div className="flex items-stretch gap-2.5 lg:block">
               <div
                 className={cx(
                   'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#1c3557] p-1.5 transition-all duration-200 lg:w-full lg:p-3',
                   expandedPrev ? 'h-36 w-36 lg:h-64' : 'h-[76px] w-[76px] lg:h-44'
                 )}
                 style={{ background: 'repeating-conic-gradient(#15233b 0% 25%, #0c1627 0% 50%) 0 0/16px 16px' }}
               >
                 <canvas ref={prevRef} className="max-h-full max-w-full object-contain" />
                 <button
                   type="button"
                   onClick={() => setExpandedPrev((e) => !e)}
                   title={expandedPrev ? 'Reducir vista previa' : 'Ampliar vista previa'}
                   className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-md border border-[#244269] bg-[#0b1930]/90 text-[9px] text-slate-300 transition active:scale-90 lg:hidden"
                 >
                   {expandedPrev ? '🗗' : '⛶'}
                 </button>
               </div>
               <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 lg:mt-2.5 lg:flex-row lg:items-center lg:gap-2.5">
                 <div className="flex min-w-0 items-center gap-2 lg:flex-1">
                   <button
                     type="button"
                     onClick={handleTogglePlay}
                     className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#25456b] bg-[#0b1a30] text-cyan-300 transition hover:border-cyan-400 hover:text-white active:scale-95 lg:h-7 lg:w-7"
                     title={isPlaying ? 'Pausar' : 'Reproducir'}
                   >
                     {isPlaying ? (
                       <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
                     ) : (
                       <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3.5 w-3.5"><path d="M8 5v14l11-7z" /></svg>
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
           ) : (`);

// 7) El monitor de audio también se aprieta un poco en móvil
soft('monitor-audio',
/flex items-center justify-between gap-3 rounded-xl border border-\[#1c3557\] bg-\[#0b192e\] p-3\.5/,
() => 'flex items-center justify-between gap-3 rounded-xl border border-[#1c3557] bg-[#0b192e] p-2.5 lg:p-3.5');

if (done.length === 0) {
  console.error('❌ Ninguna ancla encontrada. NO se tocó nada.');
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Vista previa fija en móvil:', done.join(', '));
if (skip.length) console.log('ℹ️ Ya estaba / no aplica:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-stickyprev');