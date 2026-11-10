// aplicar-landscape-fix.mjs — espacio faltante después de "and" en el variant landscape
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
const BAD = '[@media(orientation:landscape)_and(max-width:1023px)]:';
const GOOD = '[@media(orientation:landscape)_and_(max-width:1023px)]:';
const count = src.split(BAD).length - 1;
if (count === 0) {
  console.error('❌ No encontré el variant roto. Si ya ves "_and_" en el archivo, está corregido: no hay nada que hacer.');
  process.exit(1);
}
fs.writeFileSync(PATH + '.bak-lsfix', src);
src = src.split(BAD).join(GOOD);
fs.writeFileSync(PATH, src);
console.log('✅ Corregidas ' + count + ' ocurrencias: ahora el media query lleva espacio después de "and".');
console.log('📦 Backup en:', PATH + '.bak-lsfix');