// aplicar-preview-fija-fix.mjs — restaura el backup y aplica el monitor fijo SIN reestructurar JSX
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
const BAK = PATH + '.bak-stickyprev';
if (!fs.existsSync(BAK)) {
  console.error('❌ No encontré el backup ' + BAK + '. Restaurá manualmente el mediaLibrary.tsx anterior a "aplicar-preview-fija-movil.mjs" y volvé a correr.');
  process.exit(1);
}
fs.copyFileSync(PATH, PATH + '.bak-roto');
let src = fs.readFileSync(BAK, 'utf8');
console.log('♻️  Restaurado desde', BAK, '(el roto quedó guardado como .bak-roto)');
const ops = [];
const fails = [];
function rep(name, search, replace, expect = 1) {
  const c = src.split(search).length - 1;
  if (c !== expect) { fails.push(name + '(' + c + '≠' + expect + ')'); return; }
  src = src.split(search).join(replace); ops.push(name);
}
function repRe(name, re, fn) {
  const c = (src.match(new RegExp(re.source, 'g')) || []).length;
  if (c !== 1) { fails.push(name + '(' + c + ')'); return; }
  src = src.replace(re, fn); ops.push(name);
}

// 1) El scroll arranca pegado arriba para que la tarjeta fija tape el borde
rep('body-pt0',
'className="sfxlib-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:grid',
'className="sfxlib-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pt-0 lg:grid');

// 2) En móvil el envoltorio desaparece: la tarjeta pasa a ser hija directa del scroll
rep('wrapper-contents',
'className="sfxlib-scroll order-1 flex shrink-0 flex-col gap-3 lg:order-3 lg:min-h-0 lg:shrink lg:overflow-y-auto lg:pr-0.5"',
'className="sfxlib-scroll contents lg:order-3 lg:flex lg:min-h-0 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:pr-0.5"');

// 3) Cabecera del monitor: solo desktop (en móvil el lienzo se explica solo)
rep('header-desktop',
'<div className="mb-2 flex items-center justify-between">',
'<div className="mb-2 hidden w-full items-center justify-between lg:flex">');

// 4) Tarjeta de vista previa: bloque FIJO arriba en móvil + fila horizontal compacta
repRe('sticky-card',
/\{\/\* TARJETA SUPERIOR: VISTA PREVIA \*\/\}\s*<div className="rounded-2xl border border-\[#192f4f\] bg-\[#071224\] p-3">/,
() => `{/* TARJETA SUPERIOR: VISTA PREVIA */}
         <div className="sticky top-0 z-30 order-1 -mx-3 bg-[#050b18]/95 px-3 pb-3 pt-3 backdrop-blur-md lg:static lg:z-auto lg:order-none lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
         <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-2xl border border-[#192f4f] bg-[#071224] p-2.5 lg:block lg:p-3">`);

// 5) Cierre del bloque fijo, justo antes de la tarjeta de personalizar
repRe('sticky-close',
/\{\/\* TARJETA INFERIOR: PERSONALIZAR STICKER \/ AUDIO \*\/\}/,
() => '</div>\n         {/* TARJETA INFERIOR: PERSONALIZAR STICKER / AUDIO */}');

// 6) Orden móvil: monitor (1) → personalizar (2) → catálogo (3)
rep('personalizar-order',
'<div className="rounded-2xl border border-[#192f4f] bg-[#071224] p-3">',
'<div className="order-2 rounded-2xl border border-[#192f4f] bg-[#071224] p-3 lg:order-none">');
rep('catalogo-order',
'className="order-2 flex min-w-0 flex-col rounded-2xl border border-[#192f4f] bg-[#071122] p-3 lg:order-2 lg:min-h-0"',
'className="order-3 flex min-w-0 flex-col rounded-2xl border border-[#192f4f] bg-[#071122] p-3 lg:order-2 lg:min-h-0"');

// 7) Lienzo: cuadrado compacto al costado en móvil, grande y centrado en desktop
rep('canvas-box',
"'flex w-full items-center justify-center overflow-hidden rounded-xl border border-[#1c3557] p-3 transition-all duration-200',",
"'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#1c3557] p-1.5 transition-all duration-200 lg:w-full lg:p-3',");
rep('canvas-size',
"expandedPrev ? 'h-56 sm:h-64' : 'h-40 sm:h-44'",
"expandedPrev ? 'h-[184px] w-[184px] sm:h-[220px] sm:w-[220px] lg:h-64 lg:w-full' : 'h-[92px] w-[92px] sm:h-[124px] sm:w-[124px] lg:h-44 lg:w-full'");

// 8) Transporte: al lado del lienzo en móvil, debajo en desktop (sin tocar el JSX)
rep('transport-row',
'<div className="mt-2.5 flex items-center gap-2.5 px-0.5">',
'<div className="mt-0 flex min-w-[150px] flex-1 flex-wrap items-center gap-x-2.5 gap-y-1.5 px-0.5 lg:mt-2.5 lg:flex-nowrap">');
rep('range-minw',
'className="sfxlib-range flex-1"',
'className="sfxlib-range min-w-[110px] flex-1"');

if (fails.length) {
  console.error('❌ NO se escribió nada. Anclas fallidas: ' + fails.join(', '));
  console.error('   El archivo sigue roto: restaurá con  copy "' + BAK + '" "' + PATH + '"');
  process.exit(1);
}
if ((src.match(/sticky top-0 z-30 order-1/g) || []).length !== 1) {
  console.error('❌ Verificación falló: bloque fijo duplicado. NO se escribió nada.');
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Monitor fijo en móvil aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Estados guardados: .bak-stickyprev (sano previo) · .bak-roto (el que falló)');