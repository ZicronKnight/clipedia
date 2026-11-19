// fix-cola-negra4.mjs — cola negra con anclas tolerantes a espaciado y grupos atómicos
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
const original = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-cola4', original);

// Aplica un set de ops sobre un draft; si ALGUNA falla, devuelve null (grupo atómico)
function tryGroup(src, ops) {
  let out = src;
  const applied = [];
  for (const [name, re, fn] of ops) {
    const g = new RegExp(re.source, 'g');
    const n = (out.match(g) || []).length;
    if (n !== 1) return { ok: false, failed: name + '(' + n + ')', src, applied: [] };
    out = out.replace(g, fn);
    applied.push(name);
  }
  return { ok: true, src: out, applied, failed: null };
}
function soft(src, name, re, fn, log) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { log.skip.push(name); return src; }
  log.done.push(name + (n > 1 ? '×' + n : ''));
  return src.replace(g, fn);
}

const log = { done: [], skip: [], failed: [] };
let src = original;

/* ═══ GRUPO A · PREVIEW (atómico: todo o nada) ═══ */
const previewOps = [
  ['ref-total',
   /const videoStartsRef\s*=\s*useRef\s*<\s*number\s*\[\s*\]\s*>\s*\(\s*\[\s*\]\s*\)\s*;/,
   (m) => m + '\nconst videoTotalRef = useRef(0);'],
  ['set-total',
   /videoStartsRef\s*\.\s*current\s*=\s*videoStarts\s*;/,
   (m) => m + '\nvideoTotalRef.current = videoTotal;'],
  ['helpers',
   /function\s+applyClipVisualsToDom\s*\(\s*clip\s*:\s*Clip\s*\)\s*\{/,
   (m) => `// ===== COLA NEGRA: pasado el final de V1 el lienzo es negro, no el último frame =====
function isPastVideoEnd(t: number) {
return clipsRef.current.length > 0 && t >= videoTotalRef.current - 0.0005;
}
function blankVideoIfPastEnd(t: number): boolean {
const past = isPastVideoEnd(t);
const v = videoRef.current;
if (past && v) {
if (!v.paused) v.pause();
v.muted = true;
v.style.opacity = '0';
}
return past;
}
` + m],
  ['tick-guard',
   /if\s*\(\s*v\s*&&\s*list\s*\.\s*length\s*>\s*0\s*\)\s*\{/,
   () => 'if (v && list.length > 0 && !blankVideoIfPastEnd(t)) {'],
  ['efecto-cola',
   /\/\/ Con reproducción pausada/,
   (m) => `// ===== COLA NEGRA EN PREVIEW (pausa / scrub) =====
useEffect(() => {
const v = videoRef.current;
if (!v || clips.length === 0) return;
if (playingRef.current) return;
if (isPastVideoEnd(playhead)) { blankVideoIfPastEnd(playhead); return; }
const { index, localProj } = locateVideo(playhead, clips, videoStarts);
if (index < 0) return;
const c = clips[index];
const len = effLen(c);
let a = 1;
if (c.fadeIn > 0 && localProj < c.fadeIn) a = Math.max(localProj / c.fadeIn, 0);
if (c.fadeOut > 0 && localProj > len - c.fadeOut) a = Math.max((len - localProj) / c.fadeOut, 0);
v.style.opacity = String(a);
v.muted = c.muted;
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [playhead, clips, videoTotal, playing]);
` + m],
  ['seek-cola',
   /const\s+clamped\s*=\s*Math\s*\.\s*min\s*\(\s*Math\s*\.\s*max\s*\(\s*t\s*,\s*0\s*\)\s*,\s*total\s*\)\s*;/,
   (m) => m + '\nblankVideoIfPastEnd(clamped);'],
];

if (original.includes('function blankVideoIfPastEnd')) {
  log.skip.push('preview-ya-aplicado');
} else {
  const A = tryGroup(src, previewOps);
  if (A.ok) { src = A.src; log.done.push(...A.applied); }
  else log.failed.push('GRUPO PREVIEW: ' + A.failed);
}

/* ═══ GRUPO B · EXPORT (atómico, independiente) ═══ */
const exportOps = [
  ['export-clasico',
   /let\s+currentVideoLabel\s*=\s*'basev'\s*;/,
   () => `const videoTailGap = projectDuration - videoTotal;
const needsBlackTail = videoLabels.length > 0 && videoTailGap > 0.04;
if (needsBlackTail) {
filterComplex += \`[basev]tpad=stop_mode=add:stop_duration=\${videoTailGap.toFixed(6)}:color=black[basepad];\`;
}
let currentVideoLabel = needsBlackTail ? 'basepad' : 'basev';`],
  ['chunk-negro',
   /if\s*\(\s*inChunk\s*\.\s*length\s*===\s*1\s*\)\s*currentVideoLabel\s*=\s*'cv0'\s*;/,
   () => `if (inChunk.length === 0) {
fc += \`color=c=black:s=\${REF_WIDTH}x\${REF_HEIGHT}:d=\${(ce - cs).toFixed(6)}:r=\${FPS}[cvblack];\`;
currentVideoLabel = 'cvblack';
} else if (inChunk.length === 1) currentVideoLabel = 'cv0';`],
  ['chunk-tail',
   /\/\/ Overlays EN ORDEN DE TIMELINE/,
   (m) => `// COLA NEGRA DEL CHUNK: si se extiende más allá de V1, se completa con negro
if (inChunk.length > 0) {
const vidCover = Math.max(0, Math.min(ce, videoTotal) - cs);
const tailGap = (ce - cs) - vidCover;
if (tailGap > 0.5 / FPS) {
fc += \`[\${currentVideoLabel}]tpad=stop_mode=add:stop_duration=\${tailGap.toFixed(6)}:color=black[cvtail];\`;
currentVideoLabel = 'cvtail';
}
}
` + m],
];

if (original.includes('needsBlackTail')) {
  log.skip.push('export-ya-aplicado');
} else {
  const B = tryGroup(src, exportOps);
  if (B.ok) { src = B.src; log.done.push(...B.applied); }
  else log.failed.push('GRUPO EXPORT: ' + B.failed);
}

/* ═══ OPCIONALES (independientes, no bloquean) ═══ */
src = soft(src, 'captura-cola',
  /if\s*\(\s*loc\s*\.\s*index\s*>=\s*0\s*\)\s*\{/,
  () => 'if (loc.index >= 0 && atTime < videoTotal - 0.0005) {', log);

if (!original.includes('const pastVideoEnd =')) {
  const badgeOps = [
    ['flag-past',
     /const\s+activeUsesProxy\s*=\s*activeClip\s*\?\s*previewSrc\s*\(\s*activeClip\s*\)\s*!==\s*activeClip\s*\.\s*url\s*:\s*false\s*;/,
     (m) => m + '\nconst pastVideoEnd = clips.length > 0 && playhead >= videoTotal - 0.0005;'],
    ['badge-proxy',
     /\{\s*activeUsesProxy\s*&&\s*\(/,
     () => '{activeUsesProxy && !pastVideoEnd && ('],
  ];
  const C = tryGroup(src, badgeOps);
  if (C.ok) { src = C.src; log.done.push(...C.applied); }
  else log.skip.push('badge-proxy(' + C.failed + ')');
} else log.skip.push('badge-ya');

src = soft(src, '480p-ancho',
  /Math\s*\.\s*round\s*\(\s*REF_WIDTH\s*\*\s*resInfo\s*\.\s*factor\s*\)/,
  () => 'Math.max(2, Math.round((REF_WIDTH * resInfo.factor) / 2) * 2)', log);
src = soft(src, '480p-alto',
  /Math\s*\.\s*round\s*\(\s*REF_HEIGHT\s*\*\s*resInfo\s*\.\s*factor\s*\)/,
  () => 'Math.max(2, Math.round((REF_HEIGHT * resInfo.factor) / 2) * 2)', log);

/* ═══ VERIFICACIÓN ═══ */
if (src === original) {
  console.error('❌ Nada aplicado. Grupos que fallaron:');
  log.failed.forEach((f) => console.error('   · ' + f));
  console.error('NO se tocó el archivo.');
  process.exit(1);
}
// Sin referencias huérfanas: si se usa blankVideoIfPastEnd, debe estar declarado
const usaBlank = src.includes('blankVideoIfPastEnd(');
const hayBlank = src.includes('function blankVideoIfPastEnd');
if (usaBlank && !hayBlank) {
  console.error('❌ Verificación: referencia huérfana a blankVideoIfPastEnd. NO se tocó nada.');
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Aplicado (' + log.done.length + '):', log.done.join(', '));
if (log.skip.length) console.log('ℹ️ Omitido:', log.skip.join(', '));
if (log.failed.length) { console.log('⚠️ No entró:'); log.failed.forEach((f) => console.log('   · ' + f)); }
console.log('📦 Backup:', PATH + '.bak-cola4');