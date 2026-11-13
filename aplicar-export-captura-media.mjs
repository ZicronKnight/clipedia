// aplicar-export-captura-media.mjs — miniatura del export = captura estática del medio del proyecto
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-shot', src);
const ops = [];

// ---------- 1) Retirar restos del mini-reproductor / poster viejo ----------
const before = src;
src = src.replace(/[ \t]*const expPreviewRef = useRef<HTMLVideoElement>\(null\);[ \t]*\r?\n?/, '');
src = src.replace(/[ \t]*const expPreviewBarRef = useRef<HTMLDivElement>\(null\);[ \t]*\r?\n?/, '');
src = src.replace(/[ \t]*const \[expPreviewPlaying, setExpPreviewPlaying\] = useState\(false\);[ \t]*\r?\n?/, '');
src = src.replace(/useEffect\(\(\) => \{\s*const v = expPreviewRef\.current;[\s\S]*?function openExportModal\(\) \{/, 'function openExportModal() {');
src = src.replace(/[ \t]*const expPreviewSrc = [^\r\n]*\r?\n?/, '');
src = src.replace(/[ \t]*const expPreviewStart = [^\r\n]*\r?\n?/, '');
src = src.replace(/[ \t]*const expThumb = [^\r\n]*\r?\n?/, '');
if (src !== before) ops.push('restos-retirados');

// ---------- 2) Estado de la captura ----------
const A_STATE = 'const [exportProgress, setExportProgress] = useState<ExportProgress>(null);';
if (src.split(A_STATE).length - 1 !== 1) { console.error('❌ [state] ancla no única. NO se tocó nada.'); process.exit(1); }
src = src.replace(A_STATE, A_STATE + '\nconst [exportThumb, setExportThumb] = useState<string | null>(null);\nconst [exportThumbBusy, setExportThumbBusy] = useState(false);');
ops.push('state');

// ---------- 3) Compositor de frame + efecto ----------
const A_FN = 'function openExportModal() {';
if (src.split(A_FN).length - 1 !== 1) { console.error('❌ [capture] ancla no única. NO se tocó nada.'); process.exit(1); }
const CAPTURE = `// ===== CAPTURA DEL PUNTO MEDIO: miniatura estática real del proyecto =====
async function captureProjectFrame(atTime: number, token: { cancelled: boolean }): Promise<string | null> {
const W = 480;
const H = Math.max(2, Math.round((W * REF_HEIGHT) / REF_WIDTH));
const k = W / REF_WIDTH;
const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');
if (!ctx) return null;
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, W, H);
const opened: HTMLVideoElement[] = [];
const grabFrame = async (url: string, t: number): Promise<HTMLVideoElement | null> => {
const v = document.createElement('video');
opened.push(v);
v.muted = true; v.playsInline = true; v.preload = 'auto';
v.src = url;
await new Promise<void>((res) => { const done = () => res(); v.onloadedmetadata = done; v.onerror = done; window.setTimeout(done, 5000); });
if (token.cancelled || !v.videoWidth) return null;
await new Promise<void>((res) => { const done = () => res(); v.onseeked = done; v.onerror = done; try { v.currentTime = Math.min(Math.max(t, 0), Math.max(0, (v.duration || t) - 0.05)); } catch (e) { done(); } window.setTimeout(done, 5000); });
if (token.cancelled || !v.videoWidth) return null;
return v;
};
const fadeAlpha = (o: { start: number; end: number; fadeIn: number; fadeOut: number }) => {
const wl = o.end - o.start; const liw = atTime - o.start;
let a = 1;
if (o.fadeIn > 0 && liw < o.fadeIn) a = Math.max(liw / o.fadeIn, 0);
if (o.fadeOut > 0 && liw > wl - o.fadeOut) a = Math.max((wl - liw) / o.fadeOut, 0);
return a;
};
try {
const loc = locateVideo(atTime, clips, videoStarts);
if (loc.index >= 0) {
const clip = clips[loc.index];
const len = effLen(clip);
let alpha = 1;
if (clip.fadeIn > 0 && loc.localProj < clip.fadeIn) alpha = Math.max(loc.localProj / clip.fadeIn, 0);
if (clip.fadeOut > 0 && loc.localProj > len - clip.fadeOut) alpha = Math.max((len - loc.localProj) / clip.fadeOut, 0);
const v = await grabFrame(previewSrc(clip), Math.min(loc.localFile, clip.trimEnd));
if (v) {
const rot = clip.rotate;
const swap = rot === 90 || rot === 270;
const ew = swap ? H : W;
const eh = swap ? W : H;
const s = exportSettings.fit === 'recortar' ? Math.max(ew / v.videoWidth, eh / v.videoHeight) : Math.min(ew / v.videoWidth, eh / v.videoHeight);
const dw = v.videoWidth * s;
const dh = v.videoHeight * s;
const posX = rot === 90 ? clip.cropY : rot === 180 ? 1 - clip.cropX : rot === 270 ? 1 - clip.cropY : clip.cropX;
const posY = rot === 90 ? 1 - clip.cropX : rot === 180 ? 1 - clip.cropY : rot === 270 ? clip.cropX : clip.cropY;
const css = specToCss(effSpec(clip), k);
ctx.save();
ctx.globalAlpha = alpha;
ctx.translate(W / 2, H / 2);
ctx.rotate((rot * Math.PI) / 180);
if (css !== 'none') ctx.filter = css;
ctx.drawImage(v, -ew / 2 - (dw - ew) * posX, -eh / 2 - (dh - eh) * posY, dw, dh);
ctx.restore();
}
}
if (token.cancelled) return null;
const shots: { key: number; run: () => Promise<void> }[] = [];
imageOverlays.forEach((img, i) => {
if (atTime < img.start || atTime > img.end || isLaneMuted(img.laneId)) return;
shots.push({ key: paintKeyOf(img.laneId, 'image', i), run: async () => {
const im = new Image();
im.src = img.url;
await new Promise<void>((res) => { im.onload = () => res(); im.onerror = () => res(); window.setTimeout(res, 4000); });
if (token.cancelled || !im.naturalWidth) return;
const an = animOffsets(img, atTime, REF_WIDTH, REF_HEIGHT);
const dw = (img.size / 100) * REF_WIDTH * k;
const dh = dw * (im.naturalHeight / im.naturalWidth);
ctx.save();
ctx.globalAlpha = fadeAlpha(img) * ((an as any).alphaMul ?? 1);
ctx.translate(img.x * k + an.dx * k, img.y * k + an.dy * k);
ctx.scale(an.f, an.f);
ctx.rotate((img.rotate * Math.PI) / 180);
ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
ctx.restore();
} });
});
textOverlays.forEach((txt, i) => {
if (atTime < txt.start || atTime > txt.end || isLaneMuted(txt.laneId)) return;
const fam: 'subtitle' | 'text' = txt.kind === 'subtitulo' ? 'subtitle' : 'text';
shots.push({ key: paintKeyOf(txt.laneId, fam, i), run: async () => {
const an = animOffsets(txt, atTime, REF_WIDTH, REF_HEIGHT);
const mode = txt.subStyle || 'static';
const words = mode === 'static' ? [] : getEffectiveWords(txt);
const activeIdx = words.findIndex((w) => atTime >= w.start && atTime <= w.end);
const hi = txt.highlightColor || '#facc15';
let label = txt.text;
let fs = txt.size;
if (mode === 'single-word' && words.length) { label = words[activeIdx >= 0 ? activeIdx : 0].word; fs = Math.round(txt.size * 1.28); }
if (mode === 'static' && txt.animIn === 'typewriter') {
const liw = atTime - txt.start;
const p = clamp(liw / Math.max(0.1, txt.animInDur ?? 0.6), 0, 1);
label = txt.text.slice(0, Math.max(1, Math.ceil(p * txt.text.length)));
}
const fontPx = Math.max(4, fs * k);
ctx.save();
ctx.globalAlpha = fadeAlpha(txt) * ((an as any).alphaMul ?? 1);
ctx.translate(txt.x * k + an.dx * k, txt.y * k + an.dy * k);
ctx.scale(an.f, an.f);
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.font = (txt.bold ? '700 ' : '400 ') + fontPx + 'px ' + FONT_STACKS[txt.font];
const paint = (s: string, cx: number, color: string, boxed: boolean) => {
if (boxed) {
const bw = ctx.measureText(s).width;
ctx.fillStyle = hi;
ctx.fillRect(cx - bw / 2 - fontPx * 0.22, -fontPx * 0.62, bw + fontPx * 0.44, fontPx * 1.24);
}
if (txt.shadow) {
ctx.shadowColor = txt.shadowColor || '#000000';
ctx.shadowBlur = fontPx * 0.35;
ctx.shadowOffsetX = (txt.shadowX ?? 4) * k;
ctx.shadowOffsetY = (txt.shadowY ?? 4) * k;
} else {
ctx.shadowColor = 'rgba(0,0,0,0.85)';
ctx.shadowBlur = fontPx * 0.2;
ctx.shadowOffsetY = 2 * k;
}
if (txt.outline && !boxed) {
ctx.lineWidth = Math.max(1, fontPx * 0.09);
ctx.strokeStyle = '#000000';
ctx.strokeText(s, cx, 0);
}
ctx.shadowColor = 'transparent';
ctx.fillStyle = color;
ctx.fillText(s, cx, 0);
};
if ((mode === 'karaoke-color' || mode === 'karaoke-box') && words.length) {
const gap = fontPx * 0.28;
const widths = words.map((w) => ctx.measureText(w.word).width);
const total = widths.reduce((x, y) => x + y, 0) + gap * Math.max(0, words.length - 1);
let cursor = -total / 2;
words.forEach((w, wi) => {
const act = wi === activeIdx;
const col = mode === 'karaoke-box' ? (act ? '#0f1419' : txt.color) : (act ? hi : txt.color);
paint(w.word, cursor + widths[wi] / 2, col, mode === 'karaoke-box' && act);
cursor += widths[wi] + gap;
});
} else {
paint(label, 0, mode === 'single-word' ? hi : txt.color, false);
}
ctx.restore();
} });
});
videoOverlays.forEach((vo, i) => {
if (atTime < vo.start || atTime > vo.end || isLaneMuted(vo.laneId)) return;
shots.push({ key: paintKeyOf(vo.laneId, 'video', i), run: async () => {
const v = await grabFrame(vo.url, vo.offset + (atTime - vo.start));
if (!v || token.cancelled) return;
const an = animOffsets(vo, atTime, REF_WIDTH, REF_HEIGHT);
const dw = Math.max(2, (vo.size / 100) * REF_WIDTH * k);
const dh = Math.max(2, dw * (v.videoHeight / v.videoWidth));
const off = document.createElement('canvas');
off.width = Math.round(dw); off.height = Math.round(dh);
const octx = off.getContext('2d', { willReadFrequently: !!vo.chroma });
if (!octx) return;
octx.drawImage(v, 0, 0, off.width, off.height);
if (vo.chroma) {
const rgb = hexToRgb255(vo.chromaColor || '#00ff00');
const maxDist = 441.67295593;
const simDist = clamp(vo.chromaSimilarity ?? 0.16, 0.01, 0.6) * maxDist;
const blendDist = clamp(vo.chromaBlend ?? 0.05, 0, 0.4) * maxDist;
const simSq = simDist * simDist;
const outerSq = (simDist + blendDist) * (simDist + blendDist);
const fr = octx.getImageData(0, 0, off.width, off.height);
const d = fr.data;
for (let p = 0; p < d.length; p += 4) {
const dr = d[p] - rgb[0], dg = d[p + 1] - rgb[1], db = d[p + 2] - rgb[2];
const q = dr * dr + dg * dg + db * db;
if (q <= simSq) d[p + 3] = 0;
else if (blendDist > 0.5 && q < outerSq) d[p + 3] = Math.round(d[p + 3] * (Math.sqrt(q) - simDist) / blendDist);
}
octx.putImageData(fr, 0, 0);
}
ctx.save();
ctx.globalAlpha = fadeAlpha(vo) * ((an as any).alphaMul ?? 1);
ctx.translate(vo.x * k + an.dx * k, vo.y * k + an.dy * k);
ctx.scale(an.f, an.f);
ctx.rotate((vo.rotate * Math.PI) / 180);
if (vo.shape === 'circle') {
ctx.beginPath(); ctx.ellipse(0, 0, dw / 2, dh / 2, 0, 0, Math.PI * 2); ctx.clip();
} else if (vo.shape === 'round') {
const r = Math.min(dw, dh) * 0.1;
ctx.beginPath();
ctx.moveTo(-dw / 2 + r, -dh / 2);
ctx.arcTo(dw / 2, -dh / 2, dw / 2, dh / 2, r);
ctx.arcTo(dw / 2, dh / 2, -dw / 2, dh / 2, r);
ctx.arcTo(-dw / 2, dh / 2, -dw / 2, -dh / 2, r);
ctx.arcTo(-dw / 2, -dh / 2, dw / 2, -dh / 2, r);
ctx.closePath(); ctx.clip();
}
ctx.drawImage(off, -dw / 2, -dh / 2, dw, dh);
ctx.restore();
} });
});
shots.sort((a, b) => a.key - b.key);
for (const s of shots) { if (token.cancelled) return null; await s.run(); }
if (token.cancelled) return null;
return canvas.toDataURL('image/jpeg', 0.85);
} finally {
for (const v of opened) { try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} }
}
}
useEffect(() => {
if (!showExportModal || exporting) return;
const token = { cancelled: false };
setExportThumbBusy(true);
const timer = window.setTimeout(() => {
captureProjectFrame(projectDuration / 2, token)
.then((url) => { if (!token.cancelled && url) setExportThumb(url); })
.catch((e) => { console.warn('[ExportShot] No se pudo generar la captura:', e); })
.finally(() => { if (!token.cancelled) setExportThumbBusy(false); });
}, 240);
return () => { token.cancelled = true; window.clearTimeout(timer); };
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [showExportModal, exporting, projectDuration, clips, imageOverlays, textOverlays, videoOverlays, exportSettings.ratio, exportSettings.fit, proxyVersion]);
function openExportModal() {`;
src = src.replace(A_FN, CAPTURE);
ops.push('captura+efecto');

// ---------- 4) Miniatura estática (sin play) ----------
const mark = src.indexOf('h-24 w-36 shrink-0');
if (mark === -1) { console.error('❌ [thumb] no encontré la miniatura del modal PRO. NO se tocó nada.'); process.exit(1); }
const start = Math.max(src.lastIndexOf('<div', mark), src.lastIndexOf('<button', mark));
const endRe = /<div\s+className="min-w-0 flex-1 text-xs sm:text-sm"\s*>/g;
endRe.lastIndex = mark;
const em = endRe.exec(src);
if (start === -1 || !em) { console.error('❌ [thumb] no pude delimitar el bloque. NO se tocó nada.'); process.exit(1); }
const THUMB = `<div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-cyan-500/40 bg-black shadow-[0_0_18px_rgba(34,211,238,0.12)] sm:h-28 sm:w-44">
{exportThumb ? <img src={exportThumb} alt="Captura del punto medio del proyecto" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-black" />}
{exportThumbBusy && (
<div className="absolute inset-0 flex items-center justify-center bg-slate-950/65">
<span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
</div>
)}
<div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/90 via-black/55 to-transparent px-1.5 pb-1 pt-4">
<span className="font-mono text-[8px] font-black tracking-wide text-cyan-200">{'📸 ' + formatTime(projectDuration / 2)}</span>
</div>
</div>
`;
src = src.slice(0, start) + THUMB + src.slice(em.index);
ops.push('miniatura-estatica');

fs.writeFileSync(PATH, src);
console.log('✅ Captura del punto medio aplicada:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-shot');