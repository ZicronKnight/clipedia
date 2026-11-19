// fix-cola-negra2.mjs — el proyecto dura lo que dice: negro real después de V1 (idempotente)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-cola2', src);
const done = []; const skip = []; const fails = [];
const has = (s) => src.includes(s);
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { fails.push(name + '(' + c + ')'); return; }
  src = src.replace(search, () => replace); done.push(name);
}
function softRe(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n === 0) { skip.push(name); return; }
  src = src.replace(g, fn); done.push(name + (n > 1 ? '×' + n : ''));
}

/* ── 1) referencia al final real de V1 ── */
if (!has('videoTotalRef')) {
  softRe('ref-total', /const videoStartsRef = useRef<number\[\]>\(\[\]\);/, (m) => m + '\nconst videoTotalRef = useRef(0);');
} else skip.push('ref-total-ya');
if (!has('videoTotalRef.current = videoTotal;')) {
  rep('set-total', 'videoStartsRef.current = videoStarts;', 'videoStartsRef.current = videoStarts;\nvideoTotalRef.current = videoTotal;');
} else skip.push('set-total-ya');

/* ── 2) helpers de cola negra ── */
if (!has('function blankVideoIfPastEnd')) {
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
} else skip.push('helpers-ya');

/* ── 3) tick: no re-sembrar el último clip en la cola ── */
softRe('tick-guard', /if \(v && list\.length > 0\) \{/, () => 'if (v && list.length > 0 && !blankVideoIfPastEnd(t)) {');

/* ── 4) pausa/scrub: negro en la cola y alpha real al volver al video ── */
if (!has('COLA NEGRA EN PREVIEW')) {
  rep('efecto-cola', '// Con reproducción pausada (scrub, zoom, edits), el DOM se sincroniza desde el state',
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
} else skip.push('efecto-cola-ya');

/* ── 5) seek apaga el video al caer en la cola ── */
if (!has('blankVideoIfPastEnd(clamped)')) {
  rep('seek-cola', 'const clamped = Math.min(Math.max(t, 0), total);', 'const clamped = Math.min(Math.max(t, 0), total);\nblankVideoIfPastEnd(clamped);');
} else skip.push('seek-cola-ya');

/* ── 6) el badge de proxy no flota sobre el negro ── */
if (!has('const pastVideoEnd =')) {
  rep('flag-past', 'const activeUsesProxy = activeClip ? previewSrc(activeClip) !== activeClip.url : false;',
    'const activeUsesProxy = activeClip ? previewSrc(activeClip) !== activeClip.url : false;\nconst pastVideoEnd = clips.length > 0 && playhead >= videoTotal - 0.0005;');
  rep('badge-proxy', '{activeUsesProxy && (', '{activeUsesProxy && !pastVideoEnd && (');
} else skip.push('flag-past-ya');

/* ── 7) la miniatura del export también muestra negro en la cola ── */
softRe('captura-cola', /if \(loc\.index >= 0\) \{/, () => 'if (loc.index >= 0 && atTime < videoTotal - 0.0005) {');

/* ── 8) EXPORT CLÁSICO: negro ANTES de los overlays ── */
if (!has('needsBlackTail')) {
  rep('export-clasico', "let currentVideoLabel = 'basev';",
`const videoTailGap = projectDuration - videoTotal;
const needsBlackTail = videoLabels.length > 0 && videoTailGap > 0.04;
if (needsBlackTail) {
filterComplex += \`[basev]tpad=stop_duration=\${videoTailGap.toFixed(6)}:color=black[basepad];\`;
}
let currentVideoLabel = needsBlackTail ? 'basepad' : 'basev';`);
} else skip.push('export-clasico-ya');

/* ── 9) CHUNKED: fragmento enteramente en la cola = fuente negra ── */
if (!has('[cvblack]')) {
  rep('chunk-negro', "if (inChunk.length === 1) currentVideoLabel = 'cv0';",
`if (inChunk.length === 0) {
fc += \`color=c=black:s=\${REF_WIDTH}x\${REF_HEIGHT}:d=\${(ce - cs).toFixed(6)}:r=\${FPS}[cvblack];\`;
currentVideoLabel = 'cvblack';
} else if (inChunk.length === 1) currentVideoLabel = 'cv0';`);
} else skip.push('chunk-negro-ya');

/* ── 10) CHUNKED: fragmento que cruza el final se completa con negro ── */
if (!has('[cvtail]')) {
  rep('chunk-tail', '// Overlays EN ORDEN DE TIMELINE (fila de arriba = al frente = se encadena último)',
`// COLA NEGRA DEL CHUNK: si se extiende más allá de V1, se completa con negro
if (inChunk.length > 0) {
const vidCover = Math.max(0, Math.min(ce, videoTotal) - cs);
const tailGap = (ce - cs) - vidCover;
if (tailGap > 0.5 / FPS) {
fc += \`[\${currentVideoLabel}]tpad=stop_duration=\${tailGap.toFixed(6)}:color=black[cvtail];\`;
currentVideoLabel = 'cvtail';
}
}
// Overlays EN ORDEN DE TIMELINE (fila de arriba = al frente = se encadena último)`);
} else skip.push('chunk-tail-ya');

/* ── 11) BONUS pendiente: 480p daba 853 (impar) y mataba libx264 ── */
softRe('480p-ancho', /Math\.round\(\s*REF_WIDTH\s*\*\s*resInfo\.factor\s*\)/, () => 'Math.max(2, Math.round((REF_WIDTH * resInfo.factor) / 2) * 2)');
softRe('480p-alto', /Math\.round\(\s*REF_HEIGHT\s*\*\s*resInfo\.factor\s*\)/, () => 'Math.max(2, Math.round((REF_HEIGHT * resInfo.factor) / 2) * 2)');

if (fails.length) { console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', ')); process.exit(1); }
const need = ['videoTotalRef', 'blankVideoIfPastEnd', 'needsBlackTail', '[cvblack]', '[cvtail]'];
const missing = need.filter((m) => !has(m));
if (missing.length) { console.error('❌ Verificación falló, faltan: ' + missing.join(', ') + '. NO se tocó nada.'); process.exit(1); }
fs.writeFileSync(PATH, src);
console.log('✅ Cola negra aplicada:', done.join(', '));
if (skip.length) console.log('ℹ️ Ya estaba:', skip.join(', '));
console.log('📦 Backup:', PATH + '.bak-cola2');