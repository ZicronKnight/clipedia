// aplicar-fades-default.mjs — fades por defecto con fuente única + valores propios para audio
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-fades', src);
const ops = []; const fails = [];
function rep(name, search, replace, expect = 1) {
  const c = src.split(search).length - 1;
  if (c !== expect) { fails.push(name + '(' + c + '≠' + expect + ')'); return; }
  src = src.split(search).join(replace); ops.push(name);
}
function repRe(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n !== 1) { fails.push(name + '(' + n + ')'); return; }
  src = src.replace(g, fn); ops.push(name);
}

// 1) Fuente única de verdad: los defaults viven en un solo lugar
rep('constantes',
"const REC_STORAGE_KEY = 'clipedia_medialib_recents_v1';",
`const REC_STORAGE_KEY = 'clipedia_medialib_recents_v1';
// Fades por defecto. Stickers: entrada suave y salida sin "pop".
// SFX: los samples ya vienen masterizados con su envolvente; sólo un
// micro-declick al final para que no corten en seco.
const DEFAULT_FADE_IN = 0.2;
const DEFAULT_FADE_OUT = 0.3;
const DEFAULT_SFX_FADE_IN = 0;
const DEFAULT_SFX_FADE_OUT = 0.05;
const SFX_FADE_MAX_SHARE = 0.3;`);

// 2) Estado inicial desde las constantes
rep('state-in', 'const [fadeIn, setFadeIn] = useState(0.15);', 'const [fadeIn, setFadeIn] = useState(DEFAULT_FADE_IN);');
rep('state-out', 'const [fadeOut, setFadeOut] = useState(0.2);', 'const [fadeOut, setFadeOut] = useState(DEFAULT_FADE_OUT);');

// 3) Reset respetando la pestaña activa (antes volvía siempre a los valores de sticker)
rep('reset-in', 'setFadeIn(0.15);', "setFadeIn(tab === 'sfx' ? DEFAULT_SFX_FADE_IN : DEFAULT_FADE_IN);");
rep('reset-out', 'setFadeOut(0.2);', "setFadeOut(tab === 'sfx' ? DEFAULT_SFX_FADE_OUT : DEFAULT_FADE_OUT);");

// 4) Al cambiar de pestaña, cada medio arranca con sus fades naturales
repRe('tab-fades', /setTab\(t\);\s*setQuery\(''\);/,
() => `setTab(t);
               setQuery('');
               setFadeIn(t === 'sfx' ? DEFAULT_SFX_FADE_IN : DEFAULT_FADE_IN);
               setFadeOut(t === 'sfx' ? DEFAULT_SFX_FADE_OUT : DEFAULT_FADE_OUT);`);

// 5) Fusible: un fade jamás se come el sonido entero
rep('sfx-clamp',
'onSfx({ blob, name: sfx.name, duration, volume: vol, fadeIn, fadeOut });',
`const fadeCap = Math.max(0, duration) * SFX_FADE_MAX_SHARE;
onSfx({ blob, name: sfx.name, duration, volume: vol, fadeIn: Math.min(fadeIn, fadeCap), fadeOut: Math.min(fadeOut, fadeCap) });`);

if (fails.length) { console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', ')); process.exit(1); }
fs.writeFileSync(PATH, src);
console.log('✅ Fades por defecto aplicados (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-fades');