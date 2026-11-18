// aplicar-soundlab.mjs — botón + modal SoundLab en el Studio (anclas de 1 línea, CRLF-safe)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
if (!fs.existsSync('components/studio/SoundLab.tsx')) {
  console.error('❌ Falta components/studio/SoundLab.tsx. Crealo primero (Pieza 1). NO se tocó nada.');
  process.exit(1);
}
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-soundlab', src);
const ops = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { console.error('❌ [' + name + '] ancla ' + c + ' veces (esperaba 1). NO se tocó nada.'); process.exit(1); }
  src = src.replace(search, replace); ops.push(name);
}
function repRe(name, re, replace) {
  const c = (src.match(new RegExp(re.source, 'g')) || []).length;
  if (c !== 1) { console.error('❌ [' + name + '] ancla ' + c + ' veces (esperaba 1). NO se tocó nada.'); process.exit(1); }
  src = src.replace(re, replace); ops.push(name);
}

rep('import', "import { CommentStudioModal } from './commentStudio';",
  "import { CommentStudioModal } from './commentStudio';\nimport { SoundLabModal } from './SoundLab';");

rep('state', 'const [commentStudioOpen, setCommentStudioOpen] = useState(false);',
  'const [commentStudioOpen, setCommentStudioOpen] = useState(false);\nconst [soundLabOpen, setSoundLabOpen] = useState(false);');

rep('handler', 'async function addCommentResult(blob: Blob) {',
`async function addSoundLabAudio(blob: Blob, name: string) {
const url = URL.createObjectURL(blob);
const assetId = uid();
try { await putAsset(assetId, blob); } catch (e) { console.error('[SoundLab] No se pudo guardar el asset:', e); }
const decoded = await decodeAudioBlob(blob);
const dur = decoded?.duration ?? 0;
if (!dur) { showToast('⚠️ No se pudo decodificar el audio del SoundLab', 'warn'); return; }
const id = uid();
audioDataMap.set(id, { channelData: decoded.channelData, sampleRate: decoded.sampleRate });
const sibs = getSiblingsIntervals('audio', activeLaneIds.audio, new Set());
const { start: s0 } = resolveMagneticSlot(playheadRef.current, dur, sibs, [playheadRef.current], 0.05);
const track: AudioTrack = { id, assetId, name, url, duration: dur, offset: 0, start: s0, volume: 1, fadeIn: 0, fadeOut: 0, muted: false, peaks: getPeaksForSegment(id, 0, dur), released: true, laneId: activeLaneIds.audio };
setAudioTracks((prev) => [...prev, track]);
selectOnly(id, 'audio');
setSoundLabOpen(false);
showToast('🎚️ Audio del SoundLab agregado a la pista de audio', 'info');
}
async function addCommentResult(blob: Blob) {`);

repRe('boton', /<button onClick=\{\(\) => setCommentStudioOpen\(true\)\}[^>]*>💬 Generador de comentarios<\/button>/,
  (m) => m + '\n<button onClick={() => setSoundLabOpen(true)} className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20" title="Editor de audio multipista: importá, cortá, mezclá y mandá el resultado a la timeline">🎚️ Clipedia SoundLab</button>');

repRe('portal', /const commentStudioUI = commentStudioOpen\s*&&\s*typeof document !== 'undefined'\s*&&\s*createPortal\(/,
  (m) => `const soundLabUI = soundLabOpen && typeof document !== 'undefined' ? createPortal(
<SoundLabModal onClose={() => setSoundLabOpen(false)} onSend={(blob, name) => addSoundLabAudio(blob, name)} />,
document.body
) : null;
` + m);

rep('render', '{commentStudioUI}', '{soundLabUI}\n{commentStudioUI}');

fs.writeFileSync(PATH, src);
console.log('✅ SoundLab conectado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-soundlab');