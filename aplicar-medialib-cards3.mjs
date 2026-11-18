// aplicar-medialib-cards3.mjs — tarjetas uniformes (anclas estructurales, idempotente)
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-cards3', src);
const done = [];
const skip = [];

function soft(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { skip.push(name); return; }
  src = src.replace(g, fn);
  done.push(name + (n > 1 ? '×' + n : ''));
}

// 1) La grilla deja de estirar las filas para llenar el alto
soft('grid', /"sfxlib-scroll grid grid-cols-2/, () => '"sfxlib-scroll grid auto-rows-min content-start grid-cols-2');

// 2) Alto fijo idéntico en tarjetas de Stickers y Sonidos
soft('alto-tarjeta', /'group relative flex cursor-pointer flex-col/, () => "'group relative flex h-[152px] shrink-0 cursor-pointer flex-col");

// 3) Miniatura de sticker: elástica (ancla sin colores)
soft('mini-sticker', /relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg/, () => 'relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg');

// 4) Miniatura de sonido: elástica (ancla sin colores)
soft('mini-sfx', /relative flex h-20 w-full items-center justify-center overflow-hidden rounded-lg/, () => 'relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg');

// 5) Franjas de info con altura fija (cubre ambas variantes de footer)
soft('footer-texto', /<div className="mt-2 px-0\.5">/, () => '<div className="mt-2 flex h-10 shrink-0 flex-col justify-center px-0.5">');
soft('footer-play', /<div className="mt-2 flex items-center gap-2 px-0\.5">/, () => '<div className="mt-2 flex h-10 shrink-0 items-center gap-2 px-0.5">');

// 6) Cosmético: la onda llena mejor la miniatura
soft('onda-tall', /<SfxWaveform\s+def=\{s\}(?![^>]*\btall\b)[^>]*\/>/, (m) => m.replace(/\s*\/>$/, ' tall />'));

if (done.length === 0) {
  console.error('❌ Nada que aplicar y ninguna ancla estructural encontrada. ¿Es este el mediaLibrary.tsx correcto? NO se tocó nada.');
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Aplicado:', done.join(', '));
if (skip.length) console.log('ℹ️ Ya estaba / no aplica:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-cards3');