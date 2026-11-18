// fix-chroma-header.mjs — repone la cabecera de ChromaVideoCanvas (idempotente)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';

if (src.includes('function ChromaVideoCanvas(')) {
  console.log('ℹ️ La cabecera YA está en el archivo: el código está sano.');
  console.log('   Si el error persiste es caché de Turbopack:');
  console.log('   1) Ctrl+C el dev server   2) borrá la carpeta .next   3) npm run dev');
  process.exit(0);
}

const ORPHAN = /([ \t]*vo,[ \t]*\r?\n[ \t]*videoEl,[ \t]*\r?\n[ \t]*active,[ \t]*\r?\n\}: \{)/;
const n = (src.match(new RegExp(ORPHAN.source, 'g')) || []).length;
if (n !== 1) {
  console.error('❌ Esperaba 1 bloque huérfano (vo/videoEl/active) y encontré ' + n + '. NO se tocó nada.');
  console.error('   Restaurá el backup previo al parche de chroma:');
  console.error('   copy components\\studio\\Studio.tsx.bak-chromaimg components\\studio\\Studio.tsx');
  process.exit(1);
}

fs.writeFileSync(PATH + '.bak-headerfix', src);
src = src.replace(ORPHAN, 'function ChromaVideoCanvas({' + EOL + '$1');

const checks = [
  'function sampleCornerHex(',
  'function ChromaVideoCanvas(',
  'function ChromaImageCanvas(',
  'function getEffectiveWords(',
];
const bad = checks.filter((f) => (src.split(f).length - 1) !== 1);
if (bad.length) {
  console.error('❌ Verificación estructural falló en: ' + bad.join(', ') + '. NO se tocó nada.');
  process.exit(1);
}

fs.writeFileSync(PATH, src);
console.log('✅ Cabecera de ChromaVideoCanvas repuesta. Verificación estructural OK (4/4).');
console.log('📦 Backup del estado roto:', PATH + '.bak-headerfix');
console.log('   Si el cartel sigue: borrá .next y reiniciá el dev server.');