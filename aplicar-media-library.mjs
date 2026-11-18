// aplicar-media-library.mjs — Biblioteca de Medios (SFX + stickers animados con alpha)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
if (!fs.existsSync('components/studio/mediaLibrary.tsx')) { console.error('❌ Falta components/studio/mediaLibrary.tsx'); process.exit(1); }
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-medialib', src);
const ops = [];
const fails = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { fails.push(name + '(' + c + ')'); return; }
  src = src.replace(search, replace); ops.push(name);
}
function repRe(name, re, fn) {
  const c = (src.match(new RegExp(re.source, 'g')) || []).length;
  if (c !== 1) { fails.push(name + '(' + c + ')'); return; }
  src = src.replace(re, fn); ops.push(name);
}
if (src.includes("from './mediaLibrary'")) ops.push('import-ya');
else rep('import', "import { CommentStudioModal } from './commentStudio';",
  "import { CommentStudioModal } from './commentStudio';\nimport { MediaLibraryModal, SfxResult, StickerResult } from './mediaLibrary';");
rep('state', 'const [commentStudioOpen, setCommentStudioOpen] = useState(false);',
  'const [commentStudioOpen, setCommentStudioOpen] = useState(false);\nconst [mediaLibOpen, setMediaLibOpen] = useState(false);');
rep('type', 'type ImageOverlay = {',
  'type ImageOverlay = {\nsticker?: { frames: number; fps: number; fw: number; fh: number; loop: boolean };');
rep('handlers', 'async function addCommentResult(blob: Blob) {',
`async function addSfxResult(r: SfxResult) {
const assetId = uid();
try { await putAsset(assetId, r.blob); } catch (e) { console.error('[MediaLib] asset sfx:', e); }
const url = URL.createObjectURL(r.blob);
const id = uid();
const dec = await decodeAudioBlob(r.blob);
if (dec) audioDataMap.set(id, { channelData: dec.channelData, sampleRate: dec.sampleRate });
const dur = dec?.duration || r.duration;
const sibs = getSiblingsIntervals('audio', activeLaneIds.audio, new Set());
const { start: s0 } = resolveMagneticSlot(playheadRef.current, dur, sibs, [playheadRef.current], 0.05);
const t: AudioTrack = { id, assetId, name: r.name, url, duration: dur, offset: 0, start: s0, volume: clamp(r.volume, 0, 1), fadeIn: r.fadeIn, fadeOut: r.fadeOut, muted: false, peaks: dec ? getPeaksForSegment(id, 0, dur) : [], released: true, laneId: activeLaneIds.audio };
setAudioTracks((prev) => [...prev, t]);
selectOnly(id, 'audio');
setMediaLibOpen(false);
showToast('🔊 "' + r.name + '" agregado a la pista de audio', 'info');
}
async function addStickerResult(r: StickerResult) {
const assetId = uid();
try { await putAsset(assetId, r.blob); } catch (e) { console.error('[MediaLib] asset sticker:', e); }
const url = URL.createObjectURL(r.blob);
const sibs = getSiblingsIntervals('image', activeLaneIds.image, new Set());
const { start: s0 } = resolveMagneticSlot(playheadRef.current, r.duration, sibs, [playheadRef.current], 0.05);
const ov: ImageOverlay = { id: uid(), assetId, name: r.name, url, start: s0, end: s0 + r.duration, x: REF_WIDTH * r.x, y: REF_HEIGHT * r.y, size: r.size, rotate: 0, fadeIn: r.fadeIn, fadeOut: r.fadeOut, laneId: activeLaneIds.image, sticker: { frames: r.frames, fps: r.fps, fw: r.fw, fh: r.fh, loop: r.loop } };
setImageOverlays((prev) => [...prev, ov]);
selectOnly(ov.id, 'image');
setMediaLibOpen(false);
showToast('✨ Sticker "' + r.name + '" agregado (' + r.frames + ' frames con alpha)', 'info');
}
async function addCommentResult(blob: Blob) {`);
rep('boton', '💬 Generador de comentarios</button>',
  '💬 Generador de comentarios</button>\n<button onClick={() => setMediaLibOpen(true)} className="w-full rounded-lg border border-cyan-500/40 bg-cyan-500/10 py-2 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20" title="Sonidos y stickers animados listos para usar, generados en tu navegador">🎬 Biblioteca de medios</button>');
rep('portal', 'const commentStudioUI',
`const mediaLibUI = mediaLibOpen && typeof document !== 'undefined' ? createPortal(
<MediaLibraryModal onClose={() => setMediaLibOpen(false)} onSfx={(r) => addSfxResult(r)} onSticker={(r) => addStickerResult(r)} refW={REF_WIDTH} refH={REF_HEIGHT} />,
document.body
) : null;
const commentStudioUI`);
rep('render', '{commentStudioUI}', '{mediaLibUI}\n{commentStudioUI}');
rep('preview', '<img src={activeImage.url} alt="Overlay" className="pointer-events-none h-auto w-full" draggable={false} />',
`{activeImage.sticker ? (() => { const st = activeImage.sticker; const liw = playhead - activeImage.start; const fi = st.loop ? ((Math.floor(liw * st.fps) % st.frames) + st.frames) % st.frames : Math.min(st.frames - 1, Math.max(0, Math.floor(liw * st.fps))); const pct = st.frames > 1 ? (fi / (st.frames - 1)) * 100 : 0; return (
<div className="pointer-events-none w-full" style={{ paddingTop: (st.fh / st.fw) * 100 + '%', backgroundImage: 'url(' + activeImage.url + ')', backgroundSize: (st.frames * 100) + '% 100%', backgroundPosition: pct + '% 0%', backgroundRepeat: 'no-repeat' }} />
); })() : (
<img src={activeImage.url} alt="Overlay" className="pointer-events-none h-auto w-full" draggable={false} />
)}`);
repRe('export-cls', /const appendImage = \(i: number, cur: string\): string => \{/, (m) => m + `
const simg = imageOverlays[i];
if (simg.sticker) {
const st = simg.sticker;
const sIdx = clips.length + i;
const sW = Math.round((simg.size / 100) * REF_WIDTH);
const sD = simg.end - simg.start;
const fx = st.loop ? 'mod(floor(t*' + st.fps + '),' + st.frames + ')' : 'min(' + (st.frames - 1) + ',max(0,floor(t*' + st.fps + ')))';
let sf = '';
if (simg.fadeIn > 0) sf += 'fade=t=in:st=0:d=' + simg.fadeIn + ':alpha=1,';
if (simg.fadeOut > 0) sf += 'fade=t=out:st=' + Math.max(sD - simg.fadeOut, 0) + ':d=' + simg.fadeOut + ':alpha=1,';
filterComplex += '[' + sIdx + ':v]format=rgba,crop=w=' + st.fw + ':h=' + st.fh + ":x='" + fx + '*' + st.fw + "':y=0,scale=" + sW + ':-2,' + sf + 'trim=0:' + sD + ',setpts=PTS+' + simg.start + '/TB[img' + i + '_f];';
filterComplex += '[' + cur + '][img' + i + '_f]overlay=x=' + "'" + simg.x + '-overlay_w/2' + "'" + ':y=' + "'" + simg.y + '-overlay_h/2' + "'" + ":eof_action=pass:enable='between(t," + simg.start + ',' + simg.end + ")'[img" + i + '_out];';
return 'img' + i + '_out';
}
`);
repRe('export-chk', /if \(ov\.family === 'image'\) \{\s*const img = imageOverlays\[ov\.idx\];/, () => `if (ov.family === 'image') {
const cimg = imageOverlays[ov.idx];
if (cimg.sticker && !isLaneMuted(cimg.laneId)) {
const st = cimg.sticker;
const cS = Math.max(cimg.start, cs); const cE = Math.min(cimg.end, ce);
if (cE > cS) {
const ci = nextInput++;
inputArgs.push('-loop', '1', '-i', 'img' + ov.idx + '.png');
const shift = cS - cimg.start; const ovDur = cE - cS; const locS = cS - cs;
const cW = Math.round((cimg.size / 100) * REF_WIDTH);
const cD = cimg.end - cimg.start;
const fx = st.loop ? 'mod(floor(t*' + st.fps + '),' + st.frames + ')' : 'min(' + (st.frames - 1) + ',max(0,floor(t*' + st.fps + ')))';
let cf = '';
if (cimg.fadeIn > 0) cf += 'fade=t=in:st=0:d=' + cimg.fadeIn + ':alpha=1,';
if (cimg.fadeOut > 0) cf += 'fade=t=out:st=' + Math.max(cD - cimg.fadeOut, 0) + ':d=' + cimg.fadeOut + ':alpha=1,';
fc += '[' + ci + ':v]format=rgba,crop=w=' + st.fw + ':h=' + st.fh + ":x='" + fx + '*' + st.fw + "':y=0,scale=" + cW + ':-2,' + cf + rotOf(cimg.rotate) + 'trim=' + shift.toFixed(6) + ':' + (shift + ovDur).toFixed(6) + ',setpts=PTS-STARTPTS,setpts=PTS+' + locS.toFixed(6) + '/TB[imgc' + ov.idx + '];';
fc += '[' + currentVideoLabel + '][imgc' + ov.idx + ']overlay=x=' + "'" + cimg.x + '-overlay_w/2' + "'" + ':y=' + "'" + cimg.y + '-overlay_h/2' + "'" + ":eof_action=pass:enable='between(t," + locS.toFixed(6) + ',' + (locS + ovDur).toFixed(6) + ")'[imgo" + ov.idx + '];';
currentVideoLabel = 'imgo' + ov.idx;
}
continue;
}
const img = imageOverlays[ov.idx];`);
if (fails.length) { console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', ')); process.exit(1); }
fs.writeFileSync(PATH, src);
console.log('✅ Biblioteca de Medios aplicada (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-medialib');