// fix-cola-negra3.mjs — el export dura lo que dura el PROYECTO, no lo que dura V1
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-cola3', src);
const ops = []; const fails = [];
const has = (s) => src.includes(s);

function rep(name, search, replace) {
  if (has(replace.split('\n')[0]) && has(search) === false) { ops.push(name + '-ya'); return; }
  const c = src.split(search).length - 1;
  if (c !== 1) { fails.push(name + '(' + c + ')'); return; }
  src = src.replace(search, () => replace); ops.push(name);
}
function repRe(name, re, fn, expect = 1) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n !== expect) { fails.push(name + '(' + n + '≠' + expect + ')'); return; }
  src = src.replace(g, fn); ops.push(name + (n > 1 ? '×' + n : ''));
}
function softRe(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { ops.push(name + '-omitido'); return; }
  src = src.replace(g, fn); ops.push(name + (n > 1 ? '×' + n : ''));
}

/* 1 ── referencia al final real de V1 (ancla = la línea siguiente) */
rep('ref-total',
'const previewTransitionsRef = useRef(false);',
'const videoTotalRef = useRef(0);\nconst previewTransitionsRef = useRef(false);');

/* 2 ── mantenerla al día en cada render */
rep('set-total',
'videoStartsRef.current = videoStarts;',
'videoStartsRef.current = videoStarts;\nvideoTotalRef.current = videoTotal;');

/* 3 ── helpers de cola negra */
rep('helpers',
'function applyClipVisualsToDom(clip: Clip) {',
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

/* 4 ── tick: no re-sembrar ni reproducir el último clip en la cola */
repRe('tick-guard', /if \(v && list\.length > 0\) \{/,
  () => 'if (v && list.length > 0 && !blankVideoIfPastEnd(t)) {');

/* 5 ── pausa/scrub: negro en la cola y alpha real al volver al video */
rep('efecto-cola',
'// Con reproducción pausada (scrub, zoom, edits), el DOM se sincroniza desde el state',
`// ===== COLA NEGRA EN PREVIEW (pausa / scrub) =====
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

/* 6 ── seek apaga el video al caer en la cola */
rep('seek-cola',
'const clamped = Math.min(Math.max(t, 0), total);',
'const clamped = Math.min(Math.max(t, 0), total);\nblankVideoIfPastEnd(clamped);');

/* 7 ── EXPORT CLÁSICO: negro ANTES de encadenar overlays */
rep('export-clasico',
"let currentVideoLabel = 'basev';",
`const videoTailGap = projectDuration - videoTotal;
const needsBlackTail = videoLabels.length > 0 && videoTailGap > 0.04;
if (needsBlackTail) {
filterComplex += \`[basev]tpad=stop_mode=add:stop_duration=\${videoTailGap.toFixed(6)}:color=black[basepad];\`;
}
let currentVideoLabel = needsBlackTail ? 'basepad' : 'basev';`);

/* 8 ── CHUNKED: fragmento enteramente en la cola = fuente negra (antes crasheaba) */
rep('chunk-negro',
"if (inChunk.length === 1) currentVideoLabel = 'cv0';",
`if (inChunk.length === 0) {
fc += \`color=c=black:s=\${REF_WIDTH}x\${REF_HEIGHT}:d=\${(ce - cs).toFixed(6)}:r=\${FPS}[cvblack];\`;
currentVideoLabel = 'cvblack';
} else if (inChunk.length === 1) currentVideoLabel = 'cv0';`);

/* 9 ── CHUNKED: fragmento que cruza el final se completa con negro */
rep('chunk-tail',
'// Overlays EN ORDEN DE TIMELINE (fila de arriba = al frente = se encadena último)',
`// COLA NEGRA DEL CHUNK: si se extiende más allá de V1, se completa con negro
if (inChunk.length > 0) {
const vidCover = Math.max(0, Math.min(ce, videoTotal) - cs);
const tailGap = (ce - cs) - vidCover;
if (tailGap > 0.5 / FPS) {
fc += \`[\${currentVideoLabel}]tpad=stop_mode=add:stop_duration=\${tailGap.toFixed(6)}:color=black[cvtail];\`;
currentVideoLabel = 'cvtail';
}
}
// Overlays EN ORDEN DE TIMELINE (fila de arriba = al frente = se encadena último)`);

/* 10 ── la miniatura del export también muestra negro en la cola */
softRe('captura-cola', /if \(loc\.index >= 0\) \{/,
  () => 'if (loc.index >= 0 && atTime < videoTotal - 0.0005) {');

/* 11 ── 480p: 1920×(480/1080)=853 impar mataba libx264+yuv420p */
softRe('480p-ancho', /Math\.round\(REF_WIDTH \* resInfo\.factor\)/,
  () => 'Math.max(2, Math.round((REF_WIDTH * resInfo.factor) / 2) * 2)');
softRe('480p-alto', /Math\.round\(REF_HEIGHT \* resInfo\.factor\)/,
  () => 'Math.max(2, Math.round((REF_HEIGHT * resInfo.factor) / 2) * 2)');

if (fails.length) {
  console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', '));
  process.exit(1);
}
const need = ['videoTotalRef.current = videoTotal', 'function blankVideoIfPastEnd', 'needsBlackTail', '[cvblack]', '[cvtail]'];
const missing = need.filter((m) => !has(m));
if (missing.length) {
  console.error('❌ Verificación falló, faltan: ' + missing.join(', ') + '. NO se tocó nada.');
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Cola negra aplicada (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-cola3');