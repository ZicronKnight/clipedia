// aplicar-soundlab2.mjs — SoundLab en el Studio (anclas cortas y estructurales)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
if (!fs.existsSync('components/studio/SoundLab.tsx')) {
  console.error('❌ Falta components/studio/SoundLab.tsx. Crealo primero (Pieza 1). NO se tocó nada.');
  process.exit(1);
}
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-soundlab2', src);
const ops = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { console.error('❌ [' + name + '] ancla ' + c + ' veces (esperaba 1). NO se tocó nada.'); process.exit(1); }
  src = src.replace(search, replace); ops.push(name);
}

// 1) Import (ancla corta)
if (src.includes("from './SoundLab'")) ops.push('import-ya-existia');
else rep('import', "from './commentStudio';", "from './commentStudio';\nimport { SoundLabModal } from './SoundLab';");

// 2) Estado
rep('state',
'const [commentStudioOpen, setCommentStudioOpen] = useState(false);',
'const [commentStudioOpen, setCommentStudioOpen] = useState(false);\nconst [soundLabOpen, setSoundLabOpen] = useState(false);');

// 3) Handler que recibe el WAV del SoundLab (ancla estructural)
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

// 4) Botón en Herramientas globales (ancla = el texto del botón existente)
rep('boton', '💬 Generador de comentarios</button>',
'💬 Generador de comentarios</button>\n<button onClick={() => setSoundLabOpen(true)} className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20" title="Editor de audio multipista: importá, cortá, mezclá y mandá el resultado a la timeline">🎚️ Clipedia SoundLab</button>');

// 5) Portal (ancla corta: el nombre de la const)
rep('portal', 'const commentStudioUI',
`const soundLabUI = soundLabOpen && typeof document !== 'undefined' ? createPortal(
<SoundLabModal onClose={() => setSoundLabOpen(false)} onSend={(blob, name) => addSoundLabAudio(blob, name)} />,
document.body
) : null;
const commentStudioUI`);

// 6) Render del portal
rep('render', '{commentStudioUI}', '{soundLabUI}\n{commentStudioUI}');

fs.writeFileSync(PATH, src);
console.log('✅ SoundLab conectado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-soundlab2');