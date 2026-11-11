// aplicar-comment-xmlns.mjs — declara el namespace SVG en todos los SVG anidados del generador
import fs from 'node:fs';
const PATH = 'components/studio/commentStudio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
const BAD = '<svg width=';
const GOOD = '<svg xmlns="http://www.w3.org/2000/svg" width=';
const count = src.split(BAD).length - 1;
if (count < 5) { console.error('❌ Encontré ' + count + ' ocurrencias de "<svg width=" (esperaba ≥5: iconos, dots, badge, avatar, colita). NO se tocó el archivo.'); process.exit(1); }
if (src.includes('xmlns="http://www.w3.org/2000/svg" width=')) { console.error('❌ Ya hay xmlns aplicados: no hago doble parche. Revisá si ya corriste este script.'); process.exit(1); }
fs.writeFileSync(PATH + '.bak-xmlns', src);
src = src.split(BAD).join(GOOD);
fs.writeFileSync(PATH, src);
console.log('✅ xmlns agregado a ' + count + ' SVGs anidados (S/iconos, dotsV, dotsH, badge, avatar y colita).');
console.log('📦 Backup en:', PATH + '.bak-xmlns');