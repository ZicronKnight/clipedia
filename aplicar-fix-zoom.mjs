// aplicar-fix-zoom.mjs — cierra el paréntesis de max() en los scale de zoom
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-zoom', src);
const A = "))':h='";
const B = "))':eval=frame";
const cA = src.split(A).length - 1;
const cB = src.split(B).length - 1;
if (cA !== 4 || cB !== 4) {
console.error(`❌ Patrones esperados 4 y 4, encontrados ${cA} y ${cB}. NO se tocó el archivo (revisá que el patch de animaciones esté aplicado).`);
process.exit(1);
}
src = src.split(A).join(")))':h='");
src = src.split(B).join(")))':eval=frame");
fs.writeFileSync(PATH, src);
console.log('✅ Zoom corregido: 4+4 paréntesis cerrados. Backup en Studio.tsx.bak-zoom');