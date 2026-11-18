// aplicar-chroma-imagenes.mjs — Chroma Key para imágenes importadas (paridad con capas de video)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-chromaimg', src);
const ops = [];
const fails = [];
function rep(name, search, replace) {
  const c = src.split(search).length - 1;
  if (c !== 1) { fails.push(name + '(' + c + ')'); return; }
  src = src.replace(search, () => replace); ops.push(name);
}
function repRe(name, re, fn) {
  const c = (src.match(new RegExp(re.source, 'g')) || []).length;
  if (c !== 1) { fails.push(name + '(' + c + ')'); return; }
  src = src.replace(re, fn); ops.push(name);
}
function span(name, start, end, content) {
  const s = src.indexOf(start);
  const e = s < 0 ? -1 : src.indexOf(end, s);
  if (s < 0 || e < 0) { fails.push(name + '(span)'); return; }
  src = src.slice(0, s) + content + src.slice(e + end.length); ops.push(name);
}

/* 1 ── El modelo de imagen gana los mismos campos de chroma que las capas de video */
rep('modelo', 'type ImageOverlay = {',
`type ImageOverlay = {
chroma?: boolean; chromaColor?: string; chromaSimilarity?: number; chromaBlend?: number;`);

/* 2 ── El emisor FFmpeg acepta imagen o video (mismos 4 campos, misma matemática) */
rep('emisor-ff', 'function chromaFilterFF(vo: VideoOverlay): string {',
'function chromaFilterFF(vo: { chroma?: boolean; chromaColor?: string; chromaSimilarity?: number; chromaBlend?: number }): string {');

/* 3 ── Auto-detectar: sirve para <video> y para <img> (y para un frame del sprite) */
span('auto-detect', 'function sampleCornerHex(', 'function ChromaVideoCanvas({',
`function sampleCornerHex(
  el: HTMLVideoElement | HTMLImageElement | undefined | null,
  rect?: { x: number; y: number; w: number; h: number }
): string | null {
  if (!el) return null;
  const isVid = typeof HTMLVideoElement !== 'undefined' && el instanceof HTMLVideoElement;
  const sw = isVid ? (el as HTMLVideoElement).videoWidth : (el as HTMLImageElement).naturalWidth;
  const sh = isVid ? (el as HTMLVideoElement).videoHeight : (el as HTMLImageElement).naturalHeight;
  if (!sw || !sh) return null;
  try {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    if (rect && rect.w > 0 && rect.h > 0) ctx.drawImage(el, rect.x, rect.y, rect.w, rect.h, 0, 0, 16, 16);
    else ctx.drawImage(el, 0, 0, 16, 16);
    // Promediamos un bloque 4x4 de la esquina superior izquierda (lejos del sujeto central)
    const data = ctx.getImageData(1, 1, 4, 4).data;
    let r = 0, g = 0, b = 0, count = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
    }
    r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}
`);

/* 4 ── Canvas de chroma para imágenes: distancia euclidiana RGB, idéntica al video */
rep('canvas-img', 'function getEffectiveWords(txt: TextOverlay): WordTiming[] {',
`function ChromaImageCanvas({ src, color, similarity, blend, frame }: {
  src: string;
  color: string;
  similarity: number;
  blend: number;
  frame?: { frames: number; fw: number; fh: number; index: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let dead = false;
    setReady(false);
    const im = new Image();
    im.onload = () => { if (!dead) { imgRef.current = im; setReady(true); } };
    im.onerror = () => { if (!dead) { imgRef.current = null; setReady(false); } };
    im.src = src;
    return () => { dead = true; };
  }, [src]);
  useEffect(() => {
    const cv = canvasRef.current;
    const im = imgRef.current;
    if (!cv || !im || !ready) return;
    const sx = frame ? frame.index * frame.fw : 0;
    const sw = frame ? frame.fw : im.naturalWidth;
    const sh = frame ? frame.fh : im.naturalHeight;
    if (!sw || !sh) return;
    const w = Math.max(2, Math.min(768, sw));
    const h = Math.max(2, Math.round((w * sh) / sw));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(im, sx, 0, sw, sh, 0, 0, w, h);
    const [kr, kg, kb] = hexToRgb255(color);
    const maxDist = 441.67295593;
    const simDist = clamp(similarity, 0.01, 0.6) * maxDist;
    const blendDist = clamp(blend, 0, 0.4) * maxDist;
    const simSq = simDist * simDist;
    const outerSq = (simDist + blendDist) * (simDist + blendDist);
    const fr = ctx.getImageData(0, 0, w, h);
    const d = fr.data;
    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - kr;
      const dg = d[i + 1] - kg;
      const db = d[i + 2] - kb;
      const distSq = dr * dr + dg * dg + db * db;
      if (distSq <= simSq) {
        d[i + 3] = 0;
      } else if (blendDist > 0.5 && distSq < outerSq) {
        d[i + 3] = Math.round(d[i + 3] * (Math.sqrt(distSq) - simDist) / blendDist);
      }
    }
    ctx.putImageData(fr, 0, 0);
  }, [ready, src, color, similarity, blend, frame?.index, frame?.fw, frame?.fh, frame?.frames]);
  return <canvas ref={canvasRef} className="pointer-events-none block h-auto w-full" />;
}
function getEffectiveWords(txt: TextOverlay): WordTiming[] {`);

/* 5 ── Las imágenes ahora tienen pestaña Estilo */
rep('tab-estilo',
"if (selectedClip || selectedText || selectedVo) tabs.push({ id: 'estilo'",
"if (selectedClip || selectedText || selectedVo || selectedImage) tabs.push({ id: 'estilo'");

/* 6 ── Panel de Chroma Key para imágenes (mismos controles que las capas) */
rep('panel-estilo', "{propsTab === 'estilo' && selectedVo && (<>",
`{propsTab === 'estilo' && selectedImage && (<>
<p className="text-[11px] font-semibold text-pink-200">🖼️ Imagen: <span className="normal-case text-pink-300">{selectedImage.name}</span></p>
<div className="space-y-2.5 border-t border-slate-800 pt-3">
<div className="flex items-center justify-between gap-2">
<p className="truncate text-[10px] font-black uppercase tracking-wider text-emerald-300">🟩 Chroma Key</p>
<button onClick={async () => {
const nextOn = !selectedImage.chroma;
let autoHex: string | null = null;
if (nextOn && !selectedImage.chromaColor) {
const im = new Image();
im.src = selectedImage.url;
await new Promise<void>((res) => { im.onload = () => res(); im.onerror = () => res(); });
const stk = selectedImage.sticker;
autoHex = sampleCornerHex(im, stk ? { x: 0, y: 0, w: stk.fw, h: stk.fh } : undefined);
}
updateImageOverlay(selectedImage.id, {
chroma: nextOn,
chromaColor: selectedImage.chromaColor || autoHex || '#00ff00',
chromaSimilarity: selectedImage.chromaSimilarity ?? 0.16,
chromaBlend: selectedImage.chromaBlend ?? 0.05,
});
}}
className={cx('shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-bold transition', selectedImage.chroma ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200')}>
{selectedImage.chroma ? 'Activo ✓' : 'Desactivado'}
</button>
</div>
{selectedImage.chroma && (
<div className="space-y-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5">
<div className="space-y-1.5">
<div className="flex items-center justify-between">
<span className="text-[11px] font-semibold text-slate-300">Color de fondo:</span>
<button
type="button"
onClick={async () => {
const im = new Image();
im.src = selectedImage.url;
await new Promise<void>((res) => { im.onload = () => res(); im.onerror = () => res(); });
const stk = selectedImage.sticker;
const detected = sampleCornerHex(im, stk ? { x: 0, y: 0, w: stk.fw, h: stk.fh } : undefined);
if (detected) {
updateImageOverlay(selectedImage.id, { chromaColor: detected });
showToast('💧 Color de fondo detectado: ' + detected, 'info');
} else {
showToast('⚠️ No se pudo leer la imagen para detectar el color', 'warn');
}
}}
className="rounded border border-emerald-400/50 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-200 transition hover:bg-emerald-500/25"
title="Detecta automáticamente el color de la esquina de la imagen">
💧 Auto-detectar
</button>
</div>
<div className="grid grid-cols-4 gap-1.5">
{[
{ hex: '#00ff00', label: 'Verde' },
{ hex: '#0055ff', label: 'Azul' },
{ hex: '#000000', label: 'Negro' },
{ hex: '#ffffff', label: 'Blanco' },
].map((p) => (
<button key={p.hex} type="button" onClick={() => updateImageOverlay(selectedImage.id, { chromaColor: p.hex })}
className={cx('truncate rounded-md border py-1 text-center text-[10px] font-bold transition', (selectedImage.chromaColor || '#00ff00').toLowerCase() === p.hex ? 'border-emerald-300 bg-emerald-500/25 text-emerald-100' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500')}>
{p.label}
</button>
))}
</div>
<label className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 transition hover:border-emerald-400" title="Elegir color libre">
<input type="color" value={selectedImage.chromaColor || '#00ff00'} onChange={(e) => updateImageOverlay(selectedImage.id, { chromaColor: e.target.value })}
className="h-5 w-8 cursor-pointer border-0 bg-transparent p-0" />
<span className="font-mono text-[10px] font-bold text-emerald-200">{(selectedImage.chromaColor || '#00ff00').toUpperCase()}</span>
</label>
</div>
<label className="block select-none text-xs text-slate-400">
Tolerancia (Similitud): <span className="font-mono text-emerald-300">{Math.round((selectedImage.chromaSimilarity ?? 0.16) * 100)}%</span>
<input type="range" min={0.02} max={0.5} step={0.01} value={selectedImage.chromaSimilarity ?? 0.16}
onChange={(e) => updateImageOverlay(selectedImage.id, { chromaSimilarity: Number(e.target.value) })}
className="mt-1 w-full accent-emerald-400" />
</label>
<label className="block select-none text-xs text-slate-400">
Suavizado de bordes: <span className="font-mono text-emerald-300">{Math.round((selectedImage.chromaBlend ?? 0.05) * 100)}%</span>
<input type="range" min={0} max={0.3} step={0.01} value={selectedImage.chromaBlend ?? 0.05}
onChange={(e) => updateImageOverlay(selectedImage.id, { chromaBlend: Number(e.target.value) })}
className="mt-1 w-full accent-emerald-400" />
</label>
<p className="text-[10px] leading-relaxed text-slate-500">Quita el fondo liso en el preview y aplica colorkey de FFmpeg al exportar (mismo espacio RGB: paridad 1:1).</p>
</div>
)}
</div>
</>)}
{propsTab === 'estilo' && selectedVo && (<>`);

/* 7 ── Preview: una sola ruta que respeta chroma, sprite animado e imagen normal */
repRe('preview',
/\{activeImage\.sticker \? \(\(\) => \{[\s\S]*?draggable=\{false\} \/>\s*\)\}/,
() => `{(() => {
const st = activeImage.sticker;
const liw = playhead - activeImage.start;
const fi = st ? (st.loop ? ((Math.floor(liw * st.fps) % st.frames) + st.frames) % st.frames : Math.min(st.frames - 1, Math.max(0, Math.floor(liw * st.fps)))) : 0;
if (activeImage.chroma) {
return (
<ChromaImageCanvas
src={activeImage.url}
color={activeImage.chromaColor || '#00ff00'}
similarity={activeImage.chromaSimilarity ?? 0.16}
blend={activeImage.chromaBlend ?? 0.05}
frame={st ? { frames: st.frames, fw: st.fw, fh: st.fh, index: fi } : undefined}
/>
);
}
if (st) {
const pct = st.frames > 1 ? (fi / (st.frames - 1)) * 100 : 0;
return (
<div className="pointer-events-none w-full" style={{ paddingTop: (st.fh / st.fw) * 100 + '%', backgroundImage: 'url(' + activeImage.url + ')', backgroundSize: (st.frames * 100) + '% 100%', backgroundPosition: pct + '% 0%', backgroundRepeat: 'no-repeat' }} />
);
}
return <img src={activeImage.url} alt="Overlay" className="pointer-events-none h-auto w-full" draggable={false} />;
})()}`);

/* 8-11 ── Export: colorkey entra justo después de format=rgba / scale, ANTES de fades */
rep('exp-cls-sticker',
"+ sW + ':-2,' + sf + 'trim=0:'",
"+ sW + ':-2,' + chromaFilterFF(simg) + sf + 'trim=0:'");
rep('exp-cls-img',
'format=rgba,${fades}${irot}trim=0:',
'format=rgba,${chromaFilterFF(img)}${fades}${irot}trim=0:');
rep('exp-chk-sticker',
"+ cW + ':-2,' + cf + rotOf(cimg.rotate)",
"+ cW + ':-2,' + chromaFilterFF(cimg) + cf + rotOf(cimg.rotate)");
rep('exp-chk-img',
'format=rgba,${fades}${rotOf(img.rotate)}trim=',
'format=rgba,${chromaFilterFF(img)}${fades}${rotOf(img.rotate)}trim=');

/* 12 ── La captura del modal de export también keya (y recorta el frame del sprite) */
span('captura',
'const an = animOffsets(img, atTime, REF_WIDTH, REF_HEIGHT);',
'ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);',
`const an = animOffsets(img, atTime, REF_WIDTH, REF_HEIGHT);
const ist = img.sticker;
const ilw = atTime - img.start;
const ifi = ist ? (ist.loop ? ((Math.floor(ilw * ist.fps) % ist.frames) + ist.frames) % ist.frames : Math.min(ist.frames - 1, Math.max(0, Math.floor(ilw * ist.fps)))) : 0;
const isx = ist ? ifi * ist.fw : 0;
const isw = ist ? ist.fw : im.naturalWidth;
const ish = ist ? ist.fh : im.naturalHeight;
const dw = (img.size / 100) * REF_WIDTH * k;
const dh = dw * (ish / Math.max(1, isw));
let isrc: CanvasImageSource = im;
let irx = isx; let irw = isw; let irh = ish;
if (img.chroma) {
const ioff = document.createElement('canvas');
ioff.width = Math.max(2, Math.round(dw)); ioff.height = Math.max(2, Math.round(dh));
const ioctx = ioff.getContext('2d', { willReadFrequently: true });
if (ioctx) {
ioctx.drawImage(im, isx, 0, isw, ish, 0, 0, ioff.width, ioff.height);
const irgb = hexToRgb255(img.chromaColor || '#00ff00');
const iMax = 441.67295593;
const iSim = clamp(img.chromaSimilarity ?? 0.16, 0.01, 0.6) * iMax;
const iBl = clamp(img.chromaBlend ?? 0.05, 0, 0.4) * iMax;
const iSimSq = iSim * iSim;
const iOutSq = (iSim + iBl) * (iSim + iBl);
const ifr = ioctx.getImageData(0, 0, ioff.width, ioff.height);
const idd = ifr.data;
for (let p = 0; p < idd.length; p += 4) {
const dr = idd[p] - irgb[0], dg = idd[p + 1] - irgb[1], db = idd[p + 2] - irgb[2];
const q = dr * dr + dg * dg + db * db;
if (q <= iSimSq) idd[p + 3] = 0;
else if (iBl > 0.5 && q < iOutSq) idd[p + 3] = Math.round(idd[p + 3] * (Math.sqrt(q) - iSim) / iBl);
}
ioctx.putImageData(ifr, 0, 0);
isrc = ioff; irx = 0; irw = ioff.width; irh = ioff.height;
}
}
ctx.save();
ctx.globalAlpha = fadeAlpha(img) * ((an as any).alphaMul ?? 1);
ctx.translate(img.x * k + an.dx * k, img.y * k + an.dy * k);
ctx.scale(an.f, an.f);
ctx.rotate((img.rotate * Math.PI) / 180);
ctx.drawImage(isrc, irx, 0, irw, irh, -dw / 2, -dh / 2, dw, dh);`);

if (fails.length) {
  console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', '));
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ Chroma Key en imágenes aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-chromaimg');