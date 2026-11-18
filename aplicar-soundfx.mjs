// aplicar-soundfx.mjs — Clipedia SoundFX en Herramientas globales (anclas cortas, CRLF-safe)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
if (!fs.existsSync('components/studio/SoundFX.tsx')) {
  console.error('❌ Falta components/studio/SoundFX.tsx. Crealo primero (Pieza 1). NO se tocó nada.');
  process.exit(1);
}
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-soundfx', src);
const ops = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { console.error('❌ [' + name + '] ancla ' + c + ' veces (esperaba 1). NO se tocó nada.'); process.exit(1); }
  src = src.replace(search, replace); ops.push(name);
}

if (src.includes("from './SoundFX'")) ops.push('import-ya-existia');
else rep('import', "from './commentStudio';", "from './commentStudio';\nimport { SoundFXModal } from './SoundFX';");

rep('state',
'const [commentStudioOpen, setCommentStudioOpen] = useState(false);',
'const [commentStudioOpen, setCommentStudioOpen] = useState(false);\nconst [soundFxOpen, setSoundFxOpen] = useState(false);');

rep('handler', 'async function addCommentResult(blob: Blob) {',
`async function addSoundFxResult(blob: Blob, name: string) {
const url = URL.createObjectURL(blob);
const assetId = uid();
try { await putAsset(assetId, blob); } catch (e) { console.error('[SoundFX] No se pudo guardar el asset:', e); }
const decoded = await decodeAudioBlob(blob);
const dur = decoded?.duration ?? 0;
if (!dur) { showToast('⚠️ No se pudo decodificar el audio de SoundFX', 'warn'); return; }
const id = uid();
audioDataMap.set(id, { channelData: decoded.channelData, sampleRate: decoded.sampleRate });
const sibs = getSiblingsIntervals('audio', activeLaneIds.audio, new Set());
const { start: s0 } = resolveMagneticSlot(playheadRef.current, dur, sibs, [playheadRef.current], 0.05);
const track: AudioTrack = { id, assetId, name, url, duration: dur, offset: 0, start: s0, volume: 1, fadeIn: 0, fadeOut: 0, muted: false, peaks: getPeaksForSegment(id, 0, dur), released: true, laneId: activeLaneIds.audio };
setAudioTracks((prev) => [...prev, track]);
selectOnly(id, 'audio');
setSoundFxOpen(false);
showToast('🎛️ SoundFX agregado a la pista de audio', 'info');
}
async function addCommentResult(blob: Blob) {`);

rep('boton', '💬 Generador de comentarios</button>',
'💬 Generador de comentarios</button>\n<button onClick={() => setSoundFxOpen(true)} className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20" title="Rack de diseño sonoro: 28 sonidos sintetizados + perillas de FX en vivo">🎛️ Clipedia SoundFX</button>');

rep('portal', 'const commentStudioUI',
`const soundFxUI = soundFxOpen && typeof document !== 'undefined' ? createPortal(
<SoundFXModal onClose={() => setSoundFxOpen(false)} onSend={(blob, name) => addSoundFxResult(blob, name)} />,
document.body
) : null;
const commentStudioUI`);

rep('render', '{commentStudioUI}', '{soundFxUI}\n{commentStudioUI}');

fs.writeFileSync(PATH, src);
console.log('✅ Clipedia SoundFX conectado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-soundlab'.replace('soundlab', 'soundfx'));