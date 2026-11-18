// aplicar-medialib-cards.mjs — tarjetas de tamaño fijo y filas que no se estiran
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-cards', src);
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

// 2) Alto fijo idéntico en tarjetas de Stickers y de Sonidos (2 ocurrencias)
rep('card-height',
"'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border p-2 text-left transition active:scale-[0.99]',",
"'group relative flex h-[152px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border p-2 text-left transition active:scale-[0.99]',",
2);

// 3) Miniatura de sticker: ocupa el espacio que deja la franja de info
rep('sticker-thumb',
'className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] p-2"',
'className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] p-2"');

// 4) Miniatura de sonido: mismo criterio
rep('sfx-thumb',
'className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] bg-gradient-to-b from-[#08132a] to-[#050d1c] px-2"',
'className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] bg-gradient-to-b from-[#08132a] to-[#050d1c] px-2"');

// 5) Franja de info de sticker: altura fija, texto centrado vertical
rep('sticker-footer',
'<div className="mt-2 px-0.5">',
'<div className="mt-2 flex h-10 shrink-0 flex-col justify-center px-0.5">');

// 6) Franja de info de sonido: altura fija (play + nombre + categoría)
rep('sfx-footer',
'<div className="mt-2 flex items-center gap-2 px-0.5">',
'<div className="mt-2 flex h-10 shrink-0 items-center gap-2 px-0.5">');

// 7) La onda llena mejor la miniatura ahora que tiene alto estable
rep('sfx-wave',
'<SfxWaveform def={s} active={isSel} playing={isPlay} barsCount={22} />',
'<SfxWaveform def={s} active={isSel} playing={isPlay} barsCount={22} tall />');

if (fails.length) {
  console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', '));
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Tarjetas uniformes aplicadas (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-cards');