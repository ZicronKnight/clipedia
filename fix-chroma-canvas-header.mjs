// fix-chroma-canvas-header.mjs — repone la cabecera de ChromaVideoCanvas consumida por el span
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';

if (src.includes('function ChromaVideoCanvas(')) {
  console.log('ℹ️ La cabecera ya está presente: no hay nada que reparar.');
  process.exit(0);
}

const ORPHAN = /([ \t]*vo,[ \t]*\r?\n[ \t]*videoEl,[ \t]*\r?\n[ \t]*active,[ \t]*\r?\n\}: \{)/;
const n = (src.match(new RegExp(ORPHAN.source, 'g')) || []).length;
if (n !== 1) {
  console.error('❌ Esperaba 1 bloque huérfano (vo/videoEl/active) y encontré ' + n + '. NO se tocó nada.');
  console.error('   Restaurá el backup del parche de chroma: copy components\\studio\\Studio.tsx.bak-chromaimg components\\studio\\Studio.tsx');
  process.exit(1);
}

fs.writeFileSync(PATH + '.bak-headerfix', src);
src = src.replace(ORPHAN, 'function ChromaVideoCanvas({' + EOL + '$1');

// Verificación estructural: cada función debe existir exactamente una vez
const checks = [
  ['function sampleCornerHex(', 1],
  ['function ChromaVideoCanvas(', 1],
  ['function ChromaImageCanvas(', 1],
  ['function getEffectiveWords(', 1],
];
const bad = checks.filter(([frag, want]) => (src.split(frag).length - 1) !== want);
if (bad.length) {
  console.error('❌ Verificación falló en: ' + bad.map((b) => b[0]).join(', ') + '. NO se tocó nada.');
  process.exit(1);
}

fs.writeFileSync(PATH, src);
console.log('✅ Cabecera de ChromaVideoCanvas repuesta. Verificación estructural OK (4/4).');
console.log('📦 Backup del estado roto en:', PATH + '.bak-headerfix');