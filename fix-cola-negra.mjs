// fix-cola-negra.mjs — más allá del final del video: negro real en preview, captura y export
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-colanegra', src);
const ops = []; const fails = [];
function rep(name, search, replace, expect = 1) {
  const c = src.split(search).length - 1;
  if (c !== expect) { fails.push(name + '(' + c + '≠' + expect + ')'); return; }
  src = src.split(search).join(replace); ops.push(name);
}
function repRe(name, re, fn, expect = 1) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n !== expect) { fails.push(name + '(' + n + '≠' + expect + ')'); return; }
  src = src.replace(g, fn); ops.push(name);
}

/* 1 ── referencia al final real de la pista de video */
repRe('ref-total', /const videoStartsRef = useRef<number\[\]>\(\[\]\);/,
  (m) => m + '\nconst videoTotalRef = useRef(0);');
rep('set-total', 'videoStartsRef.current = videoStarts;',
  'videoStartsRef.current = videoStarts;\nvideoTotalRef.current = videoTotal;');

/* 2 ── helpers: detectar la cola y apagar el video */
rep('helpers', 'function applyClipVisualsToDom(clip: Clip) {',
`// ===== COLA NEGRA: pasado el final de V1 el lienzo es negro, no el último frame =====
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
function applyClipVisualsToDom(clip: Clip) {`);

/* 3 ── tick: no re-sembrar ni reproducir el último clip en la cola */
repRe('tick-guard', /if \(v && list\.length > 0\) \{/,
  () => 'if (v && list.length > 0 && !blankVideoIfPastEnd(t)) {');

/* 4 ── scrub/pausa: negro en la cola y restauración de alpha al volver al video */
rep('efecto-cola', '// Con reproducción pausada (scrub, zoom, edits), el DOM se sincroniza desde el state',
`// ===== COLA NEGRA EN PREVIEW (pausa / scrub): negro y vuelta limpia al video =====
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
// Con reproducción pausada (scrub, zoom, edits), el DOM se sincroniza desde el state`);

/* 5 ── seek: apaga el video al caer en la cola */
rep('seek-cola', 'const clamped = Math.min(Math.max(t, 0), total);',
  'const clamped = Math.min(Math.max(t, 0), total);\nblankVideoIfPastEnd(clamped);');

/* 6 ── badge de proxy: no flota sobre el negro */
rep('flag-past', 'const activeUsesProxy = activeClip ? previewSrc(activeClip) !== activeClip.url : false;',
  'const activeUsesProxy = activeClip ? previewSrc(activeClip) !== activeClip.url : false;\nconst pastVideoEnd = clips.length > 0 && playhead >= videoTotal - 0.0005;');
rep('badge-proxy', '{activeUsesProxy && (', '{activeUsesProxy && !pastVideoEnd && (');

/* 7 ── captura del modal de export: la cola también es negro */
repRe('captura-cola', /if \(loc\.index >= 0\) \{/,
  () => 'if (loc.index >= 0 && atTime < videoTotal - 0.0005) {');

/* 8 ── export clásico: relleno negro ANTES de los overlays (la imagen se ve encima) */
rep('export-clasico', "let currentVideoLabel = 'basev';",
`const videoTailGap = projectDuration - videoTotal;
const needsBlackTail = videoLabels.length > 0 && videoTailGap > 0.04;
if (needsBlackTail) {
filterComplex += \`[basev]tpad=stop_duration=\${videoTailGap.toFixed(6)}:color=black[basepad];\`;
}
let currentVideoLabel = needsBlackTail ? 'basepad' : 'basev';`);

/* 9 ── export chunked: chunk enteramente en la cola = fuente negra */
rep('chunk-negro', "if (inChunk.length === 1) currentVideoLabel = 'cv0';",
`if (inChunk.length === 0) {
fc += \`color=c=black:s=\${REF_WIDTH}x\${REF_HEIGHT}:d=\${(ce - cs).toFixed(6)}:r=\${FPS}[cvblack];\`;
currentVideoLabel = 'cvblack';
} else if (inChunk.length === 1) currentVideoLabel = 'cv0';`);

/* 10 ── export chunked: chunk que cruza el final se completa con negro */
rep('chunk-tail', '// Overlays EN ORDEN DE TIMELINE (fila de arriba = al frente = se encadena último)',
`// Cola negra del chunk: si se extiende más allá de V1, se completa con negro
if (inChunk.length > 0) {
const vidCover = Math.max(0, Math.min(ce, videoTotal) - cs);
const tailGap = (ce - cs) - vidCover;
if (tailGap > 0.5 / FPS) {
fc += \`[\${currentVideoLabel}]tpad=stop_duration=\${tailGap.toFixed(6)}:color=black[cvtail];\`;
currentVideoLabel = 'cvtail';
}
}
// Overlays EN ORDEN DE TIMELINE (fila de arriba = al frente = se encadena último)`);

if (fails.length) { console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', ')); process.exit(1); }
fs.writeFileSync(PATH, src);
console.log('✅ Cola negra aplicada (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-colanegra');