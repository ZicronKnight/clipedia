// fix-fragmento.mjs — balancea el fragmento del portal de mediaLibrary
import fs from 'node:fs';
const P = 'components/studio/mediaLibrary.tsx';
let s = fs.readFileSync(P, 'utf8');
fs.writeFileSync(P + '.bak-frag', s);

const count = (re) => (s.match(re) || []).length;
let opens = count(/<>/g);
let closes = count(/<\/>/g);
console.log('Antes → abre: ' + opens + ' · cierra: ' + closes);

if (closes > opens) {
  const MARK = 'return createPortal(';
  const i = s.lastIndexOf(MARK);
  if (i < 0) { console.error('❌ No encontré "return createPortal(". NO se tocó nada.'); process.exit(1); }
  const at = i + MARK.length;
  const falta = closes - opens;
  s = s.slice(0, at) + '\n' + '<>'.repeat(falta) + s.slice(at);
  fs.writeFileSync(P, s);
  console.log('✅ Insertado ' + falta + ' fragmento(s) de apertura tras createPortal(');
} else if (opens > closes) {
  console.error('❌ Sobran aperturas (' + opens + ' vs ' + closes + '). Restaurá el backup y avisame.');
  process.exit(1);
} else {
  console.log('ℹ️ Ya estaba balanceado: no se tocó nada.');
}

// Verificación releyendo del disco
const check = fs.readFileSync(P, 'utf8');
const o2 = (check.match(/<>/g) || []).length;
const c2 = (check.match(/<\/>/g) || []).length;
console.log('Después → abre: ' + o2 + ' · cierra: ' + c2);
if (o2 !== c2) { console.error('❌ Sigue desbalanceado.'); process.exit(1); }

const j = check.lastIndexOf('return createPortal(');
console.log('\n── Así quedó el arranque del portal ──');
console.log(check.slice(j, j + 160));
console.log('───────────────────────────────────────');
console.log('\n✅ Listo. Borrá la carpeta .next y reiniciá el dev server.');