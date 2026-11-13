// aplicar-timeline-mas-alta.mjs — sube un poco el alto de la timeline móvil (preview abraza el 16:9)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-tlalta', src);
const re = /h-\[\d+dvh\] min-h-\[120px\] max-h-\[\d+px\]/;
const c = (src.match(new RegExp(re.source, 'g')) || []).length;
if (c !== 1) { console.error('❌ ancla ' + c + ' veces (esperaba 1). NO se tocó nada.'); process.exit(1); }
src = src.replace(re, 'h-[32dvh] min-h-[120px] max-h-[280px]');
fs.writeFileSync(PATH, src);
console.log('✅ Timeline móvil: 26dvh/230px → 32dvh/280px. El preview se achica solo.');
console.log('📦 Backup en:', PATH + '.bak-tlalta');