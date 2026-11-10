// aplicar-panel-tabs.mjs — Fase 6.13: panel de propiedades con pestañas (rail vertical desktop / franja móvil)
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-panel', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Ancho del panel 320 → 380
rep('grid-width', 'lg:grid-cols-[116px_1fr_320px]', 'lg:grid-cols-[116px_1fr_380px]');
// 2) Estados nuevos (pestaña activa + picks de ASR inline)
rep('states',
"const [proxiesOn, setProxiesOn] = useState(false);",
"const [proxiesOn, setProxiesOn] = useState(false);\nconst [propsTab, setPropsTab] = useState('inspector');\nconst [asrModelPick, setAsrModelPick] = useState<AsrModelId>(() => { const pref = readAsrPref(); const wanted = pref?.model ?? (IS_MOBILE ? 'tiny' : 'base'); return (ASR_MODELS.some((m) => m.id === wanted) ? wanted : 'base') as AsrModelId; });\nconst [asrLangPick, setAsrLangPick] = useState<AsrLanguage>(() => (readAsrPref()?.lang ?? 'es') as AsrLanguage);\nconst [asrRemember, setAsrRemember] = useState(true);\nconst fmtAsrEst = (s: number) => (s >= 900 ? '—' : s >= 90 ? '≈ ' + Math.round(s / 60) + ' min' : '≈ ' + Math.max(1, Math.round(s)) + ' s');");
// 3) Reset de pestaña al cambiar la selección
rep('tab-reset',
"const selectedVo = videoOverlays.find((v) => v.id === selectedVoId) ?? null;",
"const selectedVo = videoOverlays.find((v) => v.id === selectedVoId) ?? null;\nuseEffect(() => { setPropsTab('inspector'); }, [selectedId, selectedImageId, selectedTextId, selectedAudioId, selectedVoId]);");
// 4) applySilencePlan acepta id explícito (para el botón inline de la pestaña)
rep('silence-sig',
"function applySilencePlan() {\nconst clip = clips.find((c) => c.id === silenceFor);",
"function applySilencePlan(targetId?: string) {\nconst clip = clips.find((c) => c.id === (targetId || silenceFor));");
// 5) Íconos SVG de pestañas + helper cx (sin backticks en el JSX nuevo)
rep('icons',
"function WaveformCanvas(",
"function cx(...parts: (string | false | null | undefined)[]) { return parts.filter(Boolean).join(' '); }\nfunction IconPropsInspector({ className }: { className?: string }) { return (<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\" className={className} aria-hidden=\"true\"><path d=\"M4 6h8M16 6h4M4 12h2M10 12h10M4 18h7M15 18h5\" /><circle cx=\"14\" cy=\"6\" r=\"2\" /><circle cx=\"8\" cy=\"12\" r=\"2\" /><circle cx=\"13\" cy=\"18\" r=\"2\" /></svg>); }\nfunction IconPropsPalette({ className }: { className?: string }) { return (<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\" className={className} aria-hidden=\"true\"><path d=\"M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-2 2c0 1 .5 1.5.5 2.5S13.5 21 12 21Z\" /><circle cx=\"7.5\" cy=\"11.5\" r=\"1\" /><circle cx=\"10.5\" cy=\"7.5\" r=\"1\" /><circle cx=\"14.5\" cy=\"7.5\" r=\"1\" /><circle cx=\"17\" cy=\"11\" r=\"1\" /></svg>); }\nfunction IconPropsWand({ className }: { className?: string }) { return (<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\" className={className} aria-hidden=\"true\"><path d=\"m14 6 4 4L7 21l-4-4L14 6Z\" /><path d=\"m14 6 2-2 4 4-2 2\" /><path d=\"M5 3v4M3 5h4M19 3v4M17 5h4\" /></svg>); }\nfunction IconPropsCaptions({ className }: { className?: string }) { return (<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\" className={className} aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\" /><path d=\"M7 13h3M7 16h6M13 13h4M15 16h2\" /></svg>); }\nfunction IconPropsWrench({ className }: { className?: string }) { return (<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\" className={className} aria-hidden=\"true\"><path d=\"M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z\" /></svg>); }\nfunction WaveformCanvas(");
// 6) Metadatos de pestañas + lista de pestañas válidas por selección
rep('meta',
"const timelineGutterWidth = TIMELINE_GUTTER_WIDTH;",
"const propsTabMeta: Record<string, { t: string; d: string }> = {\ninspector: { t: 'Inspector', d: 'Tamaño, rotación y propiedades básicas del elemento seleccionado.' },\nestilo: { t: 'Estilo', d: 'Color, filtro de color y forma de las capas.' },\nanimacion: { t: 'Animación', d: 'Fundidos de entrada y salida del elemento.' },\nsubtitulos: { t: 'Subtítulos y voz', d: 'Whisper y recorte de silencios sin salir del panel.' },\nherramientas: { t: 'Herramientas', d: 'Acciones: ruteo de audio, dividir, eliminar.' },\n};\nconst propsTabs = (() => {\nconst tabs: { id: string; label: string; icon: React.ReactNode }[] = [{ id: 'inspector', label: 'Inspector', icon: <IconPropsInspector className=\"h-4 w-4\" /> }];\nif (selectedClip || selectedText || selectedVo) tabs.push({ id: 'estilo', label: 'Estilo', icon: <IconPropsPalette className=\"h-4 w-4\" /> });\ntabs.push({ id: 'animacion', label: 'Animación', icon: <IconPropsWand className=\"h-4 w-4\" /> });\nif (selectedClip || (selectedText && selectedText.kind === 'subtitulo')) tabs.push({ id: 'subtitulos', label: 'Subtítulos', icon: <IconPropsCaptions className=\"h-4 w-4\" /> });\ntabs.push({ id: 'herramientas', label: 'Herramientas', icon: <IconPropsWrench className=\"h-4 w-4\" /> });\nreturn tabs;\n})();\nconst propsTabTitle = (propsTabMeta[propsTab] || propsTabMeta.inspector).t;\nconst propsTabDesc = (propsTabMeta[propsTab] || propsTabMeta.inspector).d;\nconst timelineGutterWidth = TIMELINE_GUTTER_WIDTH;");
// 7) Fuera el toggle móvil viejo (la franja de pestañas lo reemplaza)
{
const cIdx = src.indexOf('{/* Toggle de propiedades (solo móvil) */}');
if (cIdx === -1) { console.error('❌ [mobile-toggle] no encontré el comentario. NO se tocó el archivo.'); process.exit(1); }
const bEnd = src.indexOf('</button>', cIdx);
if (bEnd === -1) { console.error('❌ [mobile-toggle] no encontré el cierre. NO se tocó el archivo.'); process.exit(1); }
src = src.slice(0, cIdx) + src.slice(bEnd + '</button>'.length);
ops.push('mobile-toggle');
}
// 8) Reemplazo completo del <aside> de propiedades por el panel con pestañas
{
const aIdx = src.indexOf('space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto');
if (aIdx === -1) { console.error('❌ [aside] no encontré el aside de propiedades. NO se tocó el archivo.'); process.exit(1); }
const aStart = src.lastIndexOf('<aside', aIdx);
const mIdx = src.indexOf('{/* ===== TARJETA DE HERRAMIENTAS MÓVIL', aIdx);
if (mIdx === -1) { console.error('❌ [aside] no encontré el marcador de cierre. NO se tocó el archivo.'); process.exit(1); }
const aEnd = src.lastIndexOf('</aside>', mIdx);
if (aEnd === -1 || aEnd < aStart) { console.error('❌ [aside] cierre inválido. NO se tocó el archivo.'); process.exit(1); }
const NEW_ASIDE = `
<aside className="rounded-xl border border-slate-800 bg-slate-900/50 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden">
<div className="flex shrink-0 items-center gap-1 border-b border-slate-800 p-1.5 lg:hidden">
{propsTabs.map((t) => (
<button key={t.id} onClick={() => { if (propsTab === t.id && propsOpen) { setPropsOpen(false); } else { setPropsTab(t.id); setPropsOpen(true); } }}
className={cx('flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 transition-colors', propsTab === t.id ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200')} title={t.label}>
{t.icon}<span className="w-full truncate text-center text-[8px] font-semibold leading-none">{t.label}</span>
</button>
))}
</div>
<div className={cx('min-h-0 flex-1 lg:flex', propsOpen ? 'flex' : 'hidden')}>
<div className="hidden w-[86px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-slate-950/40 p-1.5 lg:flex">
{propsTabs.map((t) => (
<button key={t.id} onClick={() => setPropsTab(t.id)}
className={cx('flex flex-col items-center gap-1 rounded-lg border py-2 transition-colors', propsTab === t.id ? 'border-cyan-400/60 bg-cyan-500/10 text-cyan-300' : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200')} title={t.label}>
{t.icon}<span className="w-full truncate px-1 text-center text-[9px] font-semibold leading-none">{t.label}</span>
</button>
))}
</div>
<div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
<div>
<h2 className="text-sm font-black text-white">{propsTabTitle}</h2>
<p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{propsTabDesc}</p>
</div>
{propsTab === 'inspector' && selectedClip && (<>
<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clip: <span className="normal-case text-cyan-300">{selectedClip.name}</span></p>
<div className="grid grid-cols-2 gap-2">
<button onClick={() => updateClip(selectedClip.id, { rotate: ((selectedClip.rotate + 90) % 360) as Clip['rotate'] })} className="rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400">⟲ Rotar ({selectedClip.rotate}°)</button>
<select value={selectedClip.speed} onChange={(e) => updateClip(selectedClip.id, { speed: Number(e.target.value) })} className="rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-cyan-400">
{[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (<option key={s} value={s}>Velocidad {s}x</option>))}
</select>
</div>
{isCover && (
<div className="space-y-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-2">
<p className="text-[11px] font-semibold text-cyan-200">✂️ Encuadre (modo Recortar)</p>
<label className="block select-none text-xs text-slate-400">Horizontal: {Math.round(selectedClip.cropX * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedClip.cropX} onChange={(e) => updateClip(selectedClip.id, { cropX: Number(e.target.value) })} className="mt-1 w-full accent-cyan-400" /></label>
<label className="block select-none text-xs text-slate-400">Vertical: {Math.round(selectedClip.cropY * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedClip.cropY} onChange={(e) => updateClip(selectedClip.id, { cropY: Number(e.target.value) })} className="mt-1 w-full accent-cyan-400" /></label>
<button onClick={() => updateClip(selectedClip.id, { cropX: 0.5, cropY: 0.5 })} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400 hover:text-cyan-400">⌖ Centrar encuadre</button>
</div>
)}
<p className="text-[11px] leading-relaxed text-slate-500">En timeline: {effLen(selectedClip).toFixed(1)}s{selectedClip.speed !== 1 ? ' · ' + selectedClip.speed + 'x' : ''}</p>
</>)}
{propsTab === 'inspector' && selectedText && (<>
<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{selectedText.kind === 'subtitulo' ? 'Subtítulo' : 'Texto'}</p>
<input type="text" value={selectedText.text} onChange={(e) => updateTextOverlay(selectedText.id, { text: e.target.value })} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-fuchsia-400" />
<select value={selectedText.font} onChange={(e) => updateTextOverlay(selectedText.id, { font: e.target.value as TextOverlay['font'] })} className="w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-fuchsia-400">
<option value="sans">Sans (Roboto)</option><option value="serif">Serif (Merriweather)</option><option value="mono">Mono (Source Code Pro)</option><option value="roboto">Roboto</option><option value="playfair">Playfair Display</option><option value="montserrat">Montserrat</option><option value="opensans">Open Sans</option><option value="lato">Lato</option><option value="oswald">Oswald</option><option value="raleway">Raleway</option><option value="poppins">Poppins</option><option value="merriweather">Merriweather</option><option value="nunito">Nunito</option>
</select>
<div className="grid grid-cols-2 gap-2">
<button onClick={() => updateTextOverlay(selectedText.id, { bold: !selectedText.bold })} className={cx('rounded-lg py-2 text-sm font-bold transition-colors', selectedText.bold ? 'bg-fuchsia-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700')}>B</button>
<label className="flex items-center rounded-lg border border-slate-700 bg-slate-900 px-2 text-[10px] font-semibold text-slate-300">Tamaño<input type="range" min={16} max={400} step={2} value={selectedText.size} onChange={(e) => updateTextOverlay(selectedText.id, { size: Number(e.target.value) })} className="ml-2 w-full accent-fuchsia-400" /></label>
</div>
<p className="text-[11px] leading-relaxed text-slate-500">De {selectedText.start.toFixed(1)}s a {selectedText.end.toFixed(1)}s</p>
</>)}
{propsTab === 'inspector' && selectedImage && (<>
<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imagen: <span className="normal-case text-pink-300">{selectedImage.name}</span></p>
<label className="block select-none text-xs text-slate-400">Tamaño: {selectedImage.size}%<input type="range" min={5} max={150} step={1} value={selectedImage.size} onChange={(e) => updateImageOverlay(selectedImage.id, { size: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>
<button onClick={() => updateImageOverlay(selectedImage.id, { rotate: ((selectedImage.rotate + 90) % 360) as ImageOverlay['rotate'] })} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-pink-400 hover:text-pink-400">⟲ Rotar imagen ({selectedImage.rotate}°)</button>
<p className="text-[11px] leading-relaxed text-slate-500">De {selectedImage.start.toFixed(1)}s a {selectedImage.end.toFixed(1)}s</p>
</>)}
{propsTab === 'inspector' && selectedVo && (<>
<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Superposición: <span className="normal-case text-amber-300">{selectedVo.name}</span></p>
<label className="block select-none text-xs text-slate-400">Tamaño: {selectedVo.size}%<input type="range" min={5} max={150} step={1} value={selectedVo.size} onChange={(e) => updateVideoOverlay(selectedVo.id, { size: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" /></label>
<button onClick={() => updateVideoOverlay(selectedVo.id, { rotate: ((selectedVo.rotate + 90) % 360) as VideoOverlay['rotate'] })} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-400 hover:text-amber-400">⟲ Rotar capa ({selectedVo.rotate}°)</button>
<p className="text-[11px] leading-relaxed text-slate-500">De {selectedVo.start.toFixed(1)}s a {selectedVo.end.toFixed(1)}s · empieza en {selectedVo.offset.toFixed(1)}s del archivo</p>
</>)}
{propsTab === 'inspector' && selectedAudio && (<>
<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audio: <span className="normal-case text-green-300">{selectedAudio.name}</span></p>
{selectedAudio.sourceVideoId && (
<div className="space-y-1">
<p className="text-[11px] text-slate-500">{selectedAudio.released ? '🔓 Liberado: edición independiente' : '🔗 Vinculado: sigue trim/move/velocidad/dividir del clip'}</p>
<button onClick={() => toggleRelease(selectedAudio.id)} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-green-400 hover:text-green-300">{selectedAudio.released ? '🔗 Re-vincular al video' : '🔓 Liberar audio'}</button>
</div>
)}
<label className="block select-none text-xs text-slate-400">Volumen: {Math.round(selectedAudio.volume * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedAudio.volume} onChange={(e) => updateAudioTrack(selectedAudio.id, { volume: Number(e.target.value) })} className="mt-1 w-full accent-green-400" /></label>
<button onClick={() => updateAudioTrack(selectedAudio.id, { muted: !selectedAudio.muted })} className={cx('w-full rounded-lg py-2 text-sm font-semibold transition-colors', selectedAudio.muted ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700')}>{selectedAudio.muted ? '🔇 Desmutear' : '🔊 Mutear'}</button>
<p className="text-[11px] leading-relaxed text-slate-500">De {selectedAudio.start.toFixed(1)}s a {(selectedAudio.start + selectedAudio.duration).toFixed(1)}s</p>
</>)}
{propsTab === 'estilo' && selectedClip && (<>
<label className="block select-none text-xs text-slate-400">🎞 Filtro de color
<select value={selectedClip.filter || 'none'} onChange={(e) => updateClip(selectedClip.id, { filter: e.target.value as FilterType })} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-cyan-400">
{FILTERS.map((f) => (<option key={f.id} value={f.id}>{f.label}</option>))}
</select>
</label>
<p className="text-[11px] leading-relaxed text-slate-500">{FILTERS.find((f) => f.id === (selectedClip.filter || 'none'))?.desc}</p>
</>)}
{propsTab === 'estilo' && selectedText && (<>
<label className="block select-none text-xs text-slate-400">Color del texto</label>
<input type="color" value={selectedText.color} onChange={(e) => updateTextOverlay(selectedText.id, { color: e.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-1" />
{selectedText.kind === 'subtitulo' && (
<button onClick={() => updateTextOverlay(selectedText.id, { outline: !selectedText.outline })} className={cx('w-full rounded-lg py-2 text-sm font-semibold transition-colors', selectedText.outline ? 'border border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200' : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700')}>{selectedText.outline ? '🔲 Contorno negro: ON' : '🔲 Contorno negro: OFF'}</button>
)}
</>)}
{propsTab === 'estilo' && selectedVo && (<>
<p className="text-[11px] font-semibold text-amber-200">Marco (efecto de forma)</p>
<div className="grid grid-cols-3 gap-1.5">
{(['none', 'round', 'circle'] as OverlayShape[]).map((sh) => (
<button key={sh} onClick={() => updateVideoOverlay(selectedVo.id, { shape: sh })}
className={cx('rounded-lg border px-2 py-1.5 text-[11px] font-bold transition', selectedVo.shape === sh ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600')}>
{sh === 'none' ? 'Rect' : sh === 'round' ? 'Redondeado' : 'Círculo'}
</button>
))}
</div>
</>)}
{propsTab === 'animacion' && selectedClip && (<>
<label className="block select-none text-xs text-slate-400">Fade in: {selectedClip.fadeIn.toFixed(1)}s<input type="range" min={0} max={3} step={0.1} value={selectedClip.fadeIn} onChange={(e) => updateClip(selectedClip.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-cyan-400" /></label>
<label className="block select-none text-xs text-slate-400">Fade out: {selectedClip.fadeOut.toFixed(1)}s<input type="range" min={0} max={3} step={0.1} value={selectedClip.fadeOut} onChange={(e) => updateClip(selectedClip.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-cyan-400" /></label>
</>)}
{propsTab === 'animacion' && selectedText && (<>
<label className="block select-none text-xs text-slate-400">Fade in: {selectedText.fadeIn.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedText.fadeIn} onChange={(e) => updateTextOverlay(selectedText.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>
<label className="block select-none text-xs text-slate-400">Fade out: {selectedText.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedText.fadeOut} onChange={(e) => updateTextOverlay(selectedText.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>
</>)}
{propsTab === 'animacion' && selectedImage && (<>
<label className="block select-none text-xs text-slate-400">Fade in: {selectedImage.fadeIn.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedImage.fadeIn} onChange={(e) => updateImageOverlay(selectedImage.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>
<label className="block select-none text-xs text-slate-400">Fade out: {selectedImage.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedImage.fadeOut} onChange={(e) => updateImageOverlay(selectedImage.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>
</>)}
{propsTab === 'animacion' && selectedVo && (<>
<label className="block select-none text-xs text-slate-400">Fade in (opacidad): {selectedVo.fadeIn.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedVo.fadeIn} onChange={(e) => updateVideoOverlay(selectedVo.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" /></label>
<label className="block select-none text-xs text-slate-400">Fade out (opacidad): {selectedVo.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedVo.fadeOut} onChange={(e) => updateVideoOverlay(selectedVo.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" /></label>
</>)}
{propsTab === 'animacion' && selectedAudio && (<>
<label className="block select-none text-xs text-slate-400">Fade in: {selectedAudio.fadeIn.toFixed(1)}s<input type="range" min={0} max={3} step={0.1} value={selectedAudio.fadeIn} onChange={(e) => updateAudioTrack(selectedAudio.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-green-400" /></label>
<label className="block select-none text-xs text-slate-400">Fade out: {selectedAudio.fadeOut.toFixed(1)}s<input type="range" min={0} max={3} step={0.1} value={selectedAudio.fadeOut} onChange={(e) => updateAudioTrack(selectedAudio.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-green-400" /></label>
</>)}
{propsTab === 'subtitulos' && selectedClip && (<>
<p className="text-[11px] font-semibold text-slate-300">🎙 Modelo de Whisper</p>
<div className="grid grid-cols-2 gap-1.5">
{ASR_MODELS.map((m) => { const dis = (m.plus && !isPlus) || (IS_MOBILE && m.factorMobile >= 999); const sel = asrModelPick === m.id; const f = IS_MOBILE ? m.factorMobile : m.factorDesktop; const e = effLen(selectedClip) * asrSpeedFactor(m.id, IS_MOBILE, f); return (
<button key={m.id} disabled={dis} onClick={() => setAsrModelPick(m.id)} className={cx('relative rounded-lg border p-2 text-left transition', sel ? 'border-fuchsia-400 bg-fuchsia-500/15 ring-1 ring-fuchsia-400' : dis ? 'border-slate-800 bg-slate-900/40 opacity-60' : 'border-slate-700 bg-slate-900/60 hover:border-slate-500')}>
{m.plus && !isPlus && <span className="absolute -right-1 -top-1 text-xs">🔒</span>}
<div className="text-[11px] font-black text-white">{m.icon} {m.label}</div>
<p className="mt-0.5 text-[9px] font-semibold text-slate-300">{asrDownloadedModels().includes(m.id) ? '✓ en tu equipo' : '↓ ~' + m.mb + 'MB'} · {f >= 999 ? '—' : fmtAsrEst(e)}</p>
</button>); })}
</div>
<label className="block text-xs font-semibold text-slate-300">Idioma del audio
<select value={asrLangPick} onChange={(e) => setAsrLangPick(e.target.value as AsrLanguage)} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-fuchsia-400">
{ASR_LANGS.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
</select>
</label>
<label className="flex items-center gap-2 text-[11px] text-slate-400">
<input type="checkbox" checked={asrRemember} onChange={(e) => setAsrRemember(e.target.checked)} className="accent-fuchsia-400" />
Recordar mi elección
</label>
<button onClick={() => { const m = ASR_MODELS.find((x) => x.id === asrModelPick); if (m && selectedClip.hasAudio) generateSubtitles(selectedClip, m, asrLangPick, asrRemember); }} disabled={!selectedClip.hasAudio || !!asrProgress} className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50">🎙 Generar subtítulos</button>
{asrProgress && (
<div className="rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 p-2">
<p className="text-[11px] font-semibold text-fuchsia-200">{asrProgress.phase === 'model' ? '⬇️ Modelo… ' + asrProgress.pct + '%' : '🎙 Transcribiendo…'}</p>
<div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"><div className={cx('h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400', asrProgress.phase === 'transcribe' && 'w-1/3 animate-pulse')} style={asrProgress.phase === 'model' ? { width: asrProgress.pct + '%' } : undefined} /></div>
</div>
)}
<div className="border-t border-slate-800 pt-3">
<p className="text-[11px] font-semibold text-amber-200">✂️ Recortar silencios</p>
<label className="mt-2 block text-xs font-semibold text-slate-300">Método
<select value={silenceCfg.method} disabled={silenceBusy} onChange={(e) => setSilenceCfg((s) => ({ ...s, method: e.target.value as 'whisper' | 'energy' }))} className="mt-1 w-full rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-amber-400">
<option value="whisper">🎙 Modo Voz (reconoce palabras)</option>
<option value="energy">⚡ Modo Audio (reconoce sonidos)</option>
</select>
</label>
<label className="mt-2 block text-xs text-slate-400">Silencio mínimo: <span className="font-mono text-amber-300">{silenceCfg.minSilence.toFixed(2)}s</span><input type="range" min={0.02} max={2} step={0.05} disabled={silenceBusy} value={silenceCfg.minSilence} onChange={(e) => setSilenceCfg((s) => ({ ...s, minSilence: Number(e.target.value) }))} className="mt-1 w-full accent-amber-400" /></label>
<label className="mt-2 block text-xs text-slate-400">Colchón: <span className="font-mono text-amber-300">{silenceCfg.pad.toFixed(2)}s</span><input type="range" min={0} max={0.5} step={0.05} disabled={silenceBusy} value={silenceCfg.pad} onChange={(e) => setSilenceCfg((s) => ({ ...s, pad: Number(e.target.value) }))} className="mt-1 w-full accent-amber-400" /></label>
{silenceMsg && (<p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">{silenceMsg}</p>)}
{silenceBusy && (<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-fuchsia-400" style={{ width: (silenceCfg.method === 'whisper' ? silencePct : 70) + '%' }} /></div>)}
{!silencePlan ? (
<button onClick={() => detectSilences(selectedClip)} disabled={silenceBusy || !selectedClip.hasAudio} className="mt-2 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-black text-black transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60">{silenceBusy ? 'Analizando…' : '🔍 Detectar silencios'}</button>
) : (<>
<p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100"><strong>{silencePlan.segments.length} tramos de habla</strong> ({silencePlan.kept.toFixed(1)}s) · se irán <strong>{silencePlan.removed.toFixed(1)}s</strong> de silencio.</p>
<div className="mt-2 flex gap-2">
<button onClick={() => setSilencePlan(null)} className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300">← Volver</button>
<button onClick={() => applySilencePlan(selectedClip.id)} className="flex-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-2 text-xs font-black text-black">✂️ Aplicar</button>
</div>
</>)}
</div>
</>)}
{propsTab === 'subtitulos' && selectedText && selectedText.kind === 'subtitulo' && (<>
<button onClick={() => applyStyleToAllSubtitles(selectedText)} className="w-full rounded-lg border border-fuchsia-400/40 bg-fuchsia-500/10 py-2 text-xs font-semibold text-fuchsia-200 transition-colors hover:bg-fuchsia-500/20" title="Copia fuente, tamaño, color, negrita, contorno, fades y posición de este subtítulo a todos los de la pista SUB">📑 Aplicar cambio a todos los subtítulos</button>
<p className="text-[11px] leading-relaxed text-slate-500">Unifica el look de toda la pista SUB con un clic.</p>
</>)}
{propsTab === 'herramientas' && selectedClip && (<>
<button onClick={() => cycleClipAudio(selectedClip)} disabled={!selectedClip.hasAudio && clipAudioMode(selectedClip) === 'integrated'} className={cx('w-full rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-40', clipAudioMode(selectedClip) === 'linked' ? 'border border-green-400/40 bg-green-500/15 text-green-300 hover:bg-green-500/25' : clipAudioMode(selectedClip) === 'released' ? 'border border-amber-400/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30' : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700')} title="Cambiar dónde vive el audio de este clip">
{clipAudioMode(selectedClip) === 'linked' ? '🔗 Audio vinculado a la pista · liberar' : clipAudioMode(selectedClip) === 'released' ? '🔓 Audio liberado · re-vincular' : clipAudioMode(selectedClip) === 'muted' ? '🔇 Clip muteado · devolver audio al video' : '🎵 Audio en el video · enviar a la pista'}
</button>
<button onClick={splitAtPlayhead} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400">✂️ Dividir en el cabezal</button>
<button onClick={deleteSelected} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">🗑 Eliminar clip</button>
</>)}
{propsTab === 'herramientas' && selectedText && (<>
<button onClick={splitAtPlayhead} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400">✂️ Dividir en el cabezal</button>
<button onClick={deleteSelected} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">🗑 Eliminar texto</button>
</>)}
{propsTab === 'herramientas' && selectedImage && (<>
<button onClick={splitAtPlayhead} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400">✂️ Dividir en el cabezal</button>
<button onClick={deleteSelected} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">🗑 Eliminar imagen</button>
</>)}
{propsTab === 'herramientas' && selectedAudio && (<>
<button onClick={splitAtPlayhead} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400">✂️ Dividir en el cabezal</button>
<button onClick={deleteSelected} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">🗑 Eliminar audio</button>
</>)}
{propsTab === 'herramientas' && selectedVo && (<>
<button onClick={() => updateVideoOverlay(selectedVo.id, { muted: !selectedVo.muted })} disabled={selectedVo.hasAudio === false} className={cx('w-full rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-40', selectedVo.muted ? 'border border-red-400/40 bg-red-500/20 text-red-300' : 'border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700')}>{selectedVo.muted ? '🔇 Sin audio (click para activar)' : '🔊 Con audio'}</button>
<button onClick={deleteSelected} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">🗑 Eliminar capa</button>
</>)}
{!selectedClip && !selectedImage && !selectedText && !selectedAudio && !selectedVo && (
<p className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-xs text-slate-500">Hacé clic en un bloque de la timeline para ver sus propiedades acá.</p>
)}
</div>
</div>
</aside>
`;
src = src.slice(0, aStart) + NEW_ASIDE + src.slice(aEnd + '</aside>'.length);
ops.push('aside-tabs');
}
fs.writeFileSync(PATH, src);
console.log('✅ Cambios aplicados (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-panel');