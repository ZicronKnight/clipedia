// aplicar-sacar-beta.mjs — elimina la barra "Beta privada … esta pestaña 🔒" del editor
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const files = [];
for (const base of ['app', 'components', 'src']) {
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) files.push(p);
    }
  })(path.join(ROOT, base));
}
const esBanner = (l) => /Beta privada/.test(l) && /pestaña/.test(l);
const abreTag = (l) => /<(div|p|section|span)\b/.test(l) && !/<\/(div|p|section|span)>/.test(l);
const cierraSolo = (l) => /^\s*<\/(div|p|section|span)>\s*;?\s*$/.test(l);
const autoContenida = (l) => /<(div|p|section|span)\b/.test(l) && /<\/(div|p|section|span)>/.test(l);
let tocados = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  const i = lines.findIndex(esBanner);
  if (i === -1) continue;
  let from = -1, to = -1;
  if (autoContenida(lines[i])) { from = i; to = i; }
  else if (i > 0 && i < lines.length - 1 && abreTag(lines[i - 1]) && cierraSolo(lines[i + 1])) { from = i - 1; to = i + 1; }
  if (from === -1) {
    console.error('❌ [' + f + '] encontré el texto pero no reconozco el bloque completo. NO toqué nada. Acá está el contexto para pasárselo a tu amiga:');
    console.error(lines.slice(Math.max(0, i - 4), i + 5).map((l, k) => (Math.max(0, i - 4) + k) + ': ' + l).join('\n'));
    process.exit(1);
  }
  fs.writeFileSync(f + '.bak-sacarbeta', src);
  lines.splice(from, to - from + 1);
  fs.writeFileSync(f, lines.join('\n'));
  tocados++;
  console.log('✅ Barra beta eliminada de:', f, '(líneas', from + 1, 'a', to + 1, ') · backup en', f + '.bak-sacarbeta');
}
if (!tocados) {
  console.error('❌ No encontré ningún archivo con la barra "Beta privada … pestaña". Revisá si el banner está en otro lado (pasame el texto exacto que ves).');
  process.exit(1);
}
console.log('🎉 Listo: el editor recupera ese espacio vertical. BETA_PLUS_UNLOCK sigue en true (resoluciones desbloqueadas).');