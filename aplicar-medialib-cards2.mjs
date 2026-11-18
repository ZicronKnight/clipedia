// aplicar-medialib-cards2.mjs — tarjetas de tamaño fijo (paso de onda tolerante y opcional)
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-cards2', src);
const ops = [];
const fails = [];
function rep(name, search, replace, expect = 1) {
  const c = src.split(search).length - 1;
  if (c !== expect) { fails.push(name + '(' + c + '≠' + expect + ')'); return; }
  src = src.split(search).join(replace); ops.push(name);
}

// 1) La grilla deja de repartir el sobrante entre filas
rep('grid-rows',
'<div className="sfxlib-scroll grid grid-cols-2 gap-2.5 pr-0.5 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">',
'<div className="sfxlib-scroll grid auto-rows-min content-start grid-cols-2 gap-2.5 pr-0.5 pb-1 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">');

// 2) Alto fijo idéntico en tarjetas de Stickers y de Sonidos
rep('card-height',
"'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border p-2 text-left transition active:scale-[0.99]',",
"'group relative flex h-[152px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border p-2 text-left transition active:scale-[0.99]',",
2);

// 3) Miniatura de sticker elástica
rep('sticker-thumb',
'className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] p-2"',
'className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] p-2"');

// 4) Miniatura de sonido elástica
rep('sfx-thumb',
'className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] bg-[#071120] px-2"',
'className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] bg-[#071120] px-2"');

// 5) Franja de info de sticker: altura fija
rep('sticker-footer',
'<div className="mt-2 px-0.5">',
'<div className="mt-2 flex h-10 shrink-0 flex-col justify-center px-0.5">');

// 6) Franja de info de sonido: altura fija
rep('sfx-footer',
'<div className="mt-2 flex items-center gap-2 px-0.5">',
'<div className="mt-2 flex h-10 shrink-0 items-center gap-2 px-0.5">');

if (fails.length) {
  console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', '));
  process.exit(1);
}

// 7) COSMÉTICO y tolerante: la onda de la tarjeta llena mejor la miniatura
const waveRe = /<SfxWaveform\s+def=\{s\}[^>]*\/>/;
const wm = src.match(waveRe);
if (wm) {
  if (/\btall\b/.test(wm[0])) ops.push('sfx-wave-ya-estaba');
  else { src = src.replace(waveRe, wm[0].replace(/\s*\/>$/, ' tall />')); ops.push('sfx-wave'); }
} else {
  ops.push('sfx-wave-omitido(cosmético)');
}

fs.writeFileSync(PATH, src);
console.log('✅ Tarjetas uniformes aplicadas (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-cards2');