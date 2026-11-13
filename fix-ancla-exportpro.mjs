// fix-ancla-exportpro.mjs — convierte el ancla classic-reset a UNA sola línea
import fs from 'node:fs';
const P = 'aplicar-export-modal-pro.mjs';
let s = fs.readFileSync(P, 'utf8');
const BAD = '\\nsetExporting(true);'; // el \n literal dentro del string del script
const c = s.split(BAD).length - 1;
if (c !== 2) {
  console.error('❌ Esperaba 2 ocurrencias de "\\nsetExporting(true);" y encontré ' + c + '. No toqué el script.');
  process.exit(1);
}
fs.writeFileSync(P + '.bak', s);
s = s.split(BAD).join('');
fs.writeFileSync(P, s);
console.log('✅ Ancla classic-reset arreglada (ahora es de una sola línea, inmune a CRLF).');
console.log('📦 Backup del script en:', P + '.bak');