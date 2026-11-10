// aplicar-fullscreen-preview.mjs — preview a pantalla completa con controles
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-fs', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Estado del modo fullscreen
rep('fs-state',
'const [proxiesOn, setProxiesOn] = useState(false);',
'const [proxiesOn, setProxiesOn] = useState(false);\nconst [fsMode, setFsMode] = useState<\'none\' | \'native\' | \'css\'>(\'none\');');
// 2) Listeners: Esc / cambios de fullscreen nativo
rep('fs-effect',
'useEffect(() => { setProxiesOn(proxiesEnabled); }, []);',
'useEffect(() => { setProxiesOn(proxiesEnabled); }, []);\n// ===== PREVIEW FULLSCREEN: sincronizar estado con la API del navegador =====\nuseEffect(() => {\nconst onFsChange = () => { if (document.fullscreenElement !== previewBoxRef.current) setFsMode((m) => (m === \'native\' ? \'none\' : m)); };\nconst onKey = (e: KeyboardEvent) => { if (e.key === \'Escape\') setFsMode((m) => (m === \'css\' ? \'none\' : m)); };\ndocument.addEventListener(\'fullscreenchange\', onFsChange);\nwindow.addEventListener(\'keydown\', onKey);\nreturn () => { document.removeEventListener(\'fullscreenchange\', onFsChange); window.removeEventListener(\'keydown\', onKey); };\n}, []);');
// 3) Entrar/salir (nativo con fallback "modo teatro" para iOS)
rep('fs-funcs',
'function toggleProxies() {',
'async function enterFullscreenPreview() {\nconst el = previewBoxRef.current;\nif (!el) return;\ntry {\nif (el.requestFullscreen) { await el.requestFullscreen(); setFsMode(\'native\'); return; }\n} catch (e) { console.warn(\'[Fullscreen] nativo falló, usando modo teatro:\', e); }\nsetFsMode(\'css\');\n}\nfunction exitFullscreenPreview() {\nif (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); }\nsetFsMode(\'none\');\n}\nfunction toggleProxies() {');
// 4) La caja del preview se vuelve fixed a pantalla completa en ambos modos
rep('fs-class',
'<div ref={previewBoxRef} className="relative h-44 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-64 lg:h-auto lg:min-h-0 lg:order-2">',
'<div ref={previewBoxRef} className={fsMode !== \'none\' ? \'fixed inset-0 z-[400] h-full w-full overflow-hidden bg-black\' : \'relative h-44 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-64 lg:h-auto lg:min-h-0 lg:order-2\'}>');
// 5) Icono de expandir + X + barra de controles dentro de la caja
rep('fs-controls',
`{clips.length === 0 && imageOverlays.length === 0 && audioTracks.length === 0 && videoOverlays.length === 0 && (
<button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 transition-colors hover:text-cyan-300">
<p className="text-lg font-semibold">Arrastrá tus videos, imágenes o audios acá</p>
<p className="text-sm">Videos → pista de video · Imágenes → pista de imagen · Audios → pista de audio</p>
</button>
)}
</div>`,
`{clips.length === 0 && imageOverlays.length === 0 && audioTracks.length === 0 && videoOverlays.length === 0 && (
<button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 transition-colors hover:text-cyan-300">
<p className="text-lg font-semibold">Arrastrá tus videos, imágenes o audios acá</p>
<p className="text-sm">Videos → pista de video · Imágenes → pista de imagen · Audios → pista de audio</p>
</button>
)}
{fsMode === 'none' ? (
<button onClick={enterFullscreenPreview} className="absolute bottom-2 right-2 z-20 rounded-lg border border-slate-700 bg-slate-950/80 p-1.5 text-slate-300 backdrop-blur transition-colors hover:border-cyan-400 hover:text-cyan-300" title="Ver preview en pantalla completa">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
</button>
) : (
<>
<button onClick={exitFullscreenPreview} className="absolute right-3 top-3 z-30 rounded-lg border border-slate-700 bg-slate-950/80 p-2 text-slate-300 backdrop-blur transition-colors hover:border-red-400 hover:text-red-300" title="Salir de pantalla completa (Esc)">
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
</button>
<div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-8">
<button onClick={togglePlay} className="rounded-lg border border-slate-700 bg-slate-950/80 p-2 text-cyan-200 backdrop-blur transition-colors hover:border-cyan-400" title={playing ? 'Pausar' : 'Reproducir'}>
{playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5" />}
</button>
<button onClick={() => seek(Math.max(0, playhead - 5))} className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-[11px] font-bold text-slate-300 backdrop-blur transition-colors hover:border-cyan-400 hover:text-cyan-300" title="Retroceder 5 segundos">-5s</button>
<button onClick={() => seek(Math.min(projectDuration, playhead + 5))} className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-2 text-[11px] font-bold text-slate-300 backdrop-blur transition-colors hover:border-cyan-400 hover:text-cyan-300" title="Adelantar 5 segundos">+5s</button>
<span className="shrink-0 font-mono text-[11px] tabular-nums text-cyan-300">{formatTime(playhead)} / {formatTime(projectDuration)}</span>
<input type="range" min={0} max={Math.max(projectDuration, 0.1)} step={0.1} value={playhead} onChange={(e) => seek(Number(e.target.value))} className="w-full accent-cyan-400" />
</div>
</>
)}
</div>`);
fs.writeFileSync(PATH, src);
console.log('✅ Fullscreen preview aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-fs');