// fix-export-480p.mjs — dimensiones de salida SIEMPRE pares (libx264 + yuv420p)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-480p', src);
const ops = [];
const fails = [];

function evenRound(name, re, dim) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { fails.push(name + '(0)'); return; }
  src = src.replace(g, 'Math.max(2, Math.round((' + dim + ' * resInfo.factor) / 2) * 2)');
  ops.push(name + '×' + n);
}

// Cubre export clásico + chunked (y el resumen del modal si muestra la salida)
evenRound('ancho-par', /Math\.round\(\s*REF_WIDTH\s*\*\s*resInfo\.factor\s*\)/, 'REF_WIDTH');
evenRound('alto-par', /Math\.round\(\s*REF_HEIGHT\s*\*\s*resInfo\.factor\s*\)/, 'REF_HEIGHT');

if (fails.length) {
  console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', '));
  process.exit(1);
}
// Verificación: no debe quedar ningún redondeo impar de la resolución de salida
if (/Math\.round\(\s*REF_(WIDTH|HEIGHT)\s*\*\s*resInfo\.factor\s*\)/.test(src)) {
  console.error('❌ Verificación falló: quedó un redondeo sin alinear a par. NO se tocó nada.');
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Salida alineada a par:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-480p');