// aplicar-fades-default2.mjs — fades por defecto con fuente única (anclas tolerantes)
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-fades2', src);
const done = []; const skip = [];
const has = (s) => src.includes(s);
function soft(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { skip.push(name); return; }
  src = src.replace(g, fn); done.push(name + (n > 1 ? '×' + n : ''));
}

// 1) Fuente única de verdad
if (!has('const DEFAULT_FADE_IN')) {
  soft('constantes', /const REC_STORAGE_KEY = 'clipedia_medialib_recents_v1';/, (m) => m + `
// Fades por defecto. Stickers: entrada suave y salida sin "pop".
// SFX: los samples ya vienen masterizados con su envolvente; sólo un
// micro-declick al final para que no corten en seco.
const DEFAULT_FADE_IN = 0.2;
const DEFAULT_FADE_OUT = 0.3;
const DEFAULT_SFX_FADE_IN = 0;
const DEFAULT_SFX_FADE_OUT = 0.05;
const SFX_FADE_MAX_SHARE = 0.3;`);
} else skip.push('constantes-ya');

// 2) Estado inicial: acepta CUALQUIER número actual
soft('state-in',  /const \[fadeIn, setFadeIn\] = useState\(\s*[0-9.]+\s*\);/,
  () => 'const [fadeIn, setFadeIn] = useState(DEFAULT_FADE_IN);');
soft('state-out', /const \[fadeOut, setFadeOut\] = useState\(\s*[0-9.]+\s*\);/,
  () => 'const [fadeOut, setFadeOut] = useState(DEFAULT_FADE_OUT);');

// 3) Reset: sólo literales numéricos (los sliders usan +e.target.value y no se tocan)
soft('reset-in',  /setFadeIn\(\s*[0-9.]+\s*\);/,
  () => "setFadeIn(tab === 'sfx' ? DEFAULT_SFX_FADE_IN : DEFAULT_FADE_IN);");
soft('reset-out', /setFadeOut\(\s*[0-9.]+\s*\);/,
  () => "setFadeOut(tab === 'sfx' ? DEFAULT_SFX_FADE_OUT : DEFAULT_FADE_OUT);");

// 4) Al cambiar de pestaña, cada medio arranca con sus fades naturales
if (!has("setFadeIn(t === 'sfx'")) {
  soft('tab-fades', /setTab\(t\);\s*setQuery\(''\);/,
    () => `setTab(t);
               setQuery('');
               setFadeIn(t === 'sfx' ? DEFAULT_SFX_FADE_IN : DEFAULT_FADE_IN);
               setFadeOut(t === 'sfx' ? DEFAULT_SFX_FADE_OUT : DEFAULT_FADE_OUT);`);
} else skip.push('tab-fades-ya');

// 5) Fusible: un fade jamás se come el sonido entero
if (!has('SFX_FADE_MAX_SHARE;')) {
  soft('sfx-clamp', /onSfx\(\{ blob, name: sfx\.name, duration, volume: vol, fadeIn, fadeOut \}\);/,
    () => `const fadeCap = Math.max(0, duration) * SFX_FADE_MAX_SHARE;
onSfx({ blob, name: sfx.name, duration, volume: vol, fadeIn: Math.min(fadeIn, fadeCap), fadeOut: Math.min(fadeOut, fadeCap) });`);
} else skip.push('sfx-clamp-ya');

if (!has('const DEFAULT_FADE_IN')) {
  console.error('❌ No se pudieron definir las constantes. NO se tocó nada.');
  process.exit(1);
}
if (done.length === 0) {
  console.log('ℹ️ Todo ya estaba aplicado. No se tocó nada.');
  process.exit(0);
}
fs.writeFileSync(PATH, src);
console.log('✅ Fades por defecto aplicados:', done.join(', '));
if (skip.length) console.log('ℹ️ Ya estaba / no aplica:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-fades2');