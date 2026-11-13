// aplicar-preview-fit.mjs — preview = alto exacto del video (sin barras) · timeline recupera el espacio
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-fit', src);
const ops = [];
function repEither(name, candidates, replace) {
  for (const s of candidates) {
    if (src.split(s).length - 1 === 1) { src = src.replace(s, replace); ops.push(name); return; }
  }
  console.error('❌ [' + name + '] ninguna ancla encontrada. NO se tocó nada.'); process.exit(1);
}
function rep(name, s, r) {
  if (src.split(s).length - 1 !== 1) { console.error('❌ [' + name + '] ancla no única. NO se tocó nada.'); process.exit(1); }
  src = src.replace(s, r); ops.push(name);
}

// 1) Preview: de "crece y letterbox" a "aspect-ratio exacto del canvas" (con techo para verticales)
repEither('preview-aspect', [
  'relative min-h-[150px] flex-1 overflow-hidden rounded-xl border border-slate-800 bg-black sm:min-h-[180px] [@media(orientation:landscape)_and_(max-width:1023px)]:h-[42dvh] [@media(orientation:landscape)_and_(max-width:1023px)]:flex-none lg:h-auto lg:min-h-0 lg:flex-none lg:order-2',
  'relative h-[clamp(110px,20dvh,220px)] shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-[clamp(160px,26dvh,300px)] [@media(orientation:landscape)_and_(max-width:1023px)]:h-[42dvh] lg:h-auto lg:min-h-0 lg:order-2',
],
'relative shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black [@media(max-width:1023px)]:[aspect-ratio:var(--par)] [@media(max-width:1023px)]:max-h-[46dvh] [@media(orientation:landscape)_and_(max-width:1023px)]:h-[42dvh] [@media(orientation:landscape)_and_(max-width:1023px)]:max-h-none lg:h-auto lg:min-h-0 lg:flex-none lg:order-2');

// 2) Inyectar la variable --par (relación real del canvas) en la caja del preview
rep('preview-var',
'<div ref={previewBoxRef} className=',
'<div ref={previewBoxRef} style={{ \'--par\': `${REF_WIDTH} / ${REF_HEIGHT}` } as React.CSSProperties} className=');

// 3) El área principal ya no roba espacio en móvil (vuelve a altura de contenido)
repEither('main-area', [
  "'flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:flex-1",
  "'flex min-h-0 flex-col gap-2 lg:grid lg:flex-1",
],
"'flex min-h-0 flex-col gap-2 lg:grid lg:flex-1");

// 4) Timeline: vuelve a crecer (flex-1) para aprovechar todo lo que libera el preview
repEither('timeline-grow', [
  "'relative flex-none h-[26dvh] min-h-[120px] max-h-[230px] flex-col rounded-xl border border-slate-800 bg-slate-900/60 [@media(orientation:landscape)_and_(max-width:1023px)]:h-[38dvh] [@media(orientation:landscape)_and_(max-width:1023px)]:min-h-[70px] [@media(orientation:landscape)_and_(max-width:1023px)]:max-h-none lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0'",
  "'relative min-h-[110px] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 [@media(orientation:landscape)_and_(max-width:1023px)]:min-h-[70px] lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0'",
],
"'relative flex-1 min-h-[150px] flex-col rounded-xl border border-slate-800 bg-slate-900/60 [@media(orientation:landscape)_and_(max-width:1023px)]:min-h-[70px] lg:h-[34vh] lg:min-h-[260px] lg:max-h-[420px] lg:flex-none lg:shrink-0'");

fs.writeFileSync(PATH, src);
console.log('✅ Preview fit aplicado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-fit');