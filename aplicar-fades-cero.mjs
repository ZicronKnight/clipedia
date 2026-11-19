// aplicar-fades-cero.mjs — Fade in/out apagados por defecto (tolerante + idempotente)
import fs from 'node:fs';

function patchFile(PATH, ops) {
  if (!fs.existsSync(PATH)) { console.log('ℹ️ No existe ' + PATH + ' — se omite.'); return; }
  let src = fs.readFileSync(PATH, 'utf8');
  const before = src;
  fs.writeFileSync(PATH + '.bak-fadescero', src);
  const done = []; const skip = [];
  for (const [name, re, repl] of ops) {
    const g = new RegExp(re.source, 'g');
    const hits = src.match(g) || [];
    if (!hits.length) { skip.push(name); continue; }
    // idempotencia: si todos los matches ya son iguales al reemplazo, no hay trabajo
    const target = typeof repl === 'function' ? null : repl;
    if (target !== null && hits.every((h) => h === target)) { skip.push(name + '-ya'); continue; }
    src = src.replace(g, repl);
    done.push(name + (hits.length > 1 ? '×' + hits.length : ''));
  }
  if (src === before) {
    console.log('ℹ️ ' + PATH + ': todo ya estaba en cero.');
    if (skip.length) console.log('   Omitido:', skip.join(', '));
    return;
  }
  fs.writeFileSync(PATH, src);
  console.log('✅ ' + PATH + ' → ' + done.join(', '));
  if (skip.length) console.log('   Omitido:', skip.join(', '));
}

/* ═══ mediaLibrary: los dos sliders arrancan apagados ═══ */
patchFile('components/studio/mediaLibrary.tsx', [
  // constantes nombradas (si una versión previa las creó)
  ['const-in',  /const DEFAULT_FADE_IN = [^;]+;/,     'const DEFAULT_FADE_IN = 0;'],
  ['const-out', /const DEFAULT_FADE_OUT = [^;]+;/,    'const DEFAULT_FADE_OUT = 0;'],
  ['const-sfx-in',  /const DEFAULT_SFX_FADE_IN = [^;]+;/,  'const DEFAULT_SFX_FADE_IN = 0;'],
  ['const-sfx-out', /const DEFAULT_SFX_FADE_OUT = [^;]+;/, 'const DEFAULT_SFX_FADE_OUT = 0;'],

  // estado inicial: acepta número, constante o expresión
  ['estado-in',  /const \[fadeIn, setFadeIn\] = useState\([^)]*\);/,  'const [fadeIn, setFadeIn] = useState(0);'],
  ['estado-out', /const \[fadeOut, setFadeOut\] = useState\([^)]*\);/, 'const [fadeOut, setFadeOut] = useState(0);'],

  // reset(): sólo literales numéricos (los sliders usan +e.target.value y no se tocan)
  ['reset-in',  /setFadeIn\(\s*-?\d*\.?\d+\s*\);/,  'setFadeIn(0);'],
  ['reset-out', /setFadeOut\(\s*-?\d*\.?\d+\s*\);/, 'setFadeOut(0);'],

  // el label dice "Off" en vez de "0.0s": el estado apagado se ve de un vistazo
  ['label-in',  /\{fadeIn\.toFixed\(1\)\}s/,  "{fadeIn > 0 ? fadeIn.toFixed(1) + 's' : 'Off'}"],
  ['label-out', /\{fadeOut\.toFixed\(1\)\}s/, "{fadeOut > 0 ? fadeOut.toFixed(1) + 's' : 'Off'}"],
]);

/* ═══ Studio: el comentario insertado tampoco trae fades de regalo ═══ */
patchFile('components/studio/Studio.tsx', [
  ['comentario-fades', /fadeIn: 0\.3, fadeOut: 0\.3/, 'fadeIn: 0, fadeOut: 0'],
  ['comentario-toast', /\(5s, con fades\)/, '(5s)'],
]);

console.log('\n🎚️ Listo: Fade in y Fade out arrancan en Off. El usuario los sube con el slider (pasos de 0.1s).');