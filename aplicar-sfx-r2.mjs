// aplicar-sfx-r2.mjs — mediaLibrary cambia SFX sintetizados por los MP3 reales de R2
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
if (!fs.existsSync('components/studio/sfxLibrary.tsx')) { console.error('❌ Falta components/studio/sfxLibrary.tsx (Pieza 1)'); process.exit(1); }
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-sfxr2', src);
const ops = []; const fails = [];

// span que CORTA EN e (preserva el ancla de cierre — regla del manual)
function span(name, start, end, content) {
  const s = src.indexOf(start);
  const e = s < 0 ? -1 : src.indexOf(end, s + start.length);
  if (s < 0 || e < 0) { fails.push(name + '(span)'); return; }
  src = src.slice(0, s) + content + src.slice(e); ops.push(name);
}
function rep(name, search, replace, expect = 1) {
  const c = src.split(search).length - 1;
  if (c !== expect) { fails.push(name + '(' + c + '≠' + expect + ')'); return; }
  src = src.split(search).join(replace); ops.push(name);
}
function repRe(name, re, fn) {
  const g = new RegExp(re.source, 'g');
  const n = (src.match(g) || []).length;
  if (n < 1) { fails.push(name + '(0)'); return; }
  src = src.replace(g, fn); ops.push(name + (n > 1 ? '×' + n : ''));
}
function soft(name, search, replace) {
  if (!src.includes(search)) { ops.push(name + '-omitido'); return; }
  src = src.split(search).join(replace); ops.push(name);
}

/* 1 ── import del módulo R2 */
rep('import', "import { createPortal } from 'react-dom';",
`import { createPortal } from 'react-dom';
import { SfxDef, EMPTY_SFX, useSfxLibrary, SfxWaveform, playSfxFile, renderSfxFile, sfxDuration } from './sfxLibrary';`);

/* 2 ── fuera el motor DSP + el catálogo sintetizado (stickers intactos) */
span('fuera-dsp', 'function encodeWav(buf: AudioBuffer): Blob {', 'export type StickerDef = {',
`/* ============================================================================
SFX: biblioteca real servida desde Cloudflare R2 → ver sfxLibrary.tsx
============================================================================ */

/* ============================================================================
STICKERS ANIMADOS HD (TIKTOK, YOUTUBE, REDES, UI)
============================================================================ */
`);

/* 3 ── fuera el render sintetizado */
span('fuera-rendersfx', 'async function renderSfx(def: SfxDef, tune: number, gain: number)', 'function buildSheet(', '');

/* 4 ── fuera la onda sintetizada */
span('fuera-wave', 'const waveCache = new Map<string, number[]>();', 'function StickerCardPreview(', '');

/* 5 ── SR ya no se usa acá */
soft('fuera-sr', 'const SR = 44100;\n', '');
soft('fuera-sr-crlf', 'const SR = 44100;\r\n', '');

/* 6 ── renombrar los usos del catálogo estático al estado cargado */
repRe('rename-cats', /\bSFX_CATS\b/, () => 'sfxCats');
repRe('rename-sfx', /\bSFX\b/, () => 'sfxLib');

/* 7 ── estado: hook del manifest + paginación + reset */
rep('estado', 'const [selK, setSelK] = useState(STICKERS[1].id);',
`const [selK, setSelK] = useState(STICKERS[1].id);
const { items: sfxLib, cats: sfxCats, loading: sfxLoading, error: sfxError, retry: sfxRetry, manifestUrl: sfxManifestUrl } = useSfxLibrary();
const [sfxLimit, setSfxLimit] = useState(60);
useEffect(() => { if (sfxLib.length && !sfxLib.some((s) => s.id === selS)) setSelS(sfxLib[0].id); }, [sfxLib, selS]);
useEffect(() => { setSfxLimit(60); }, [catS, query, sortBy, tab]);`);

/* 8 ── selección inicial vacía (el catálogo llega por red) */
rep('sels-init', "const [selS, setSelS] = useState(sfxLib[1].id);", "const [selS, setSelS] = useState('');");

/* 9 ── placeholder mientras carga: la UI existente no necesita guards */
rep('sfx-fallback',
'const sfx = useMemo(() => sfxLib.find((s) => s.id === selS) || sfxLib[0], [selS]);',
'const sfx = useMemo(() => sfxLib.find((s) => s.id === selS) || sfxLib[0] || EMPTY_SFX, [sfxLib, selS]);');

/* 10 ── dependencias de los memos que ahora dependen del catálogo remoto */
rep('deps-counts', '}, [tab, favs, recents]);', '}, [tab, favs, recents, sfxLib, sfxCats]);');
rep('deps-list', '}, [catS, query, favs, recents, sortBy]);', '}, [sfxLib, catS, query, favs, recents, sortBy]);');

/* 11 ── paginación: 1004 tarjetas DOM de una matarían el celular */
rep('grilla-limit', 'sfxList.map((s) => {', 'sfxList.slice(0, sfxLimit).map((s) => {');

/* 12 ── botón "+60" al lado del orden */
repRe('cargar-mas', /<select\s+value=\{sortBy\}[\s\S]*?<\/select>/, (m) =>
`<div className="flex shrink-0 items-center gap-1.5">
           {tab === 'sfx' && sfxList.length > sfxLimit && (
             <button
               type="button"
               onClick={() => setSfxLimit((n) => n + 60)}
               className="h-9 shrink-0 rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-2.5 text-[11px] font-black text-cyan-200 transition hover:bg-cyan-500/20 active:scale-95"
               title={'Mostrando ' + Math.min(sfxLimit, sfxList.length) + ' de ' + sfxList.length}
             >
               +60
             </button>
           )}
           ${m}
           </div>`);

/* 13 ── preview con el archivo real */
span('preview-real', 'const { blob } = await renderSfx(def, tune, vol);', '} catch {',
`const node = await playSfxFile(def, tune, vol);
sfxSourceRef.current = node;
node.onended = () => {
if (sfxSourceRef.current === node) {
sfxSourceRef.current = null;
setPlayingAudioId((p) => (p === def.id ? null : p));
}
};
`);

/* 14 ── inserción con el archivo real */
rep('insert-real', 'const { blob, duration } = await renderSfx(sfx, tune, 1);', 'const { blob, duration } = await renderSfxFile(sfx, tune, 1);');

/* 15 ── azar y botones protegidos mientras carga */
rep('azar-guard', 'const p = sfxLib[Math.floor(Math.random() * sfxLib.length)];',
'if (!sfxLib.length) return;\nconst p = sfxLib[Math.floor(Math.random() * sfxLib.length)];');
rep('insert-disabled', 'disabled={busy}', "disabled={busy || (tab === 'sfx' && !sfx.id)}", 2);

/* 16 ── duración real medida cuando el manifest no la trae */
repRe('dur-card', /\{s\.dur\.toFixed\(2\)\}s/, () => '{sfxDuration(s).toFixed(2)}s');
repRe('dur-preview', /sfx\.dur\.toFixed\(2\)/, () => 'sfxDuration(sfx).toFixed(2)');

/* 17 ── estado vacío honesto: cargando / error de red / sin resultados */
rep('empty-state',
`<p className="col-span-full py-10 text-center text-[12px] text-slate-500">
               No hay sonidos en esta vista.
             </p>`,
`<div className="col-span-full flex flex-col items-center gap-3 py-10 text-center">
               {sfxLoading ? (
                 <>
                   <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                   <p className="text-[12px] font-bold text-cyan-200">Cargando biblioteca de sonidos…</p>
                 </>
               ) : sfxError ? (
                 <>
                   <p className="text-[12px] font-bold text-rose-300">No se pudo cargar la biblioteca</p>
                   <p className="max-w-[420px] text-[10px] leading-relaxed text-slate-500">{sfxError}</p>
                   <p className="max-w-[420px] break-all font-mono text-[9px] text-slate-600">{sfxManifestUrl}</p>
                   <button type="button" onClick={sfxRetry} className="rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-black text-cyan-200 transition hover:bg-cyan-500/20">↺ Reintentar</button>
                 </>
               ) : (
                 <p className="text-[12px] text-slate-500">No hay sonidos en esta vista.</p>
               )}
             </div>`);

/* 18 ── la interfaz no miente: los sonidos ahora vienen del CDN */
soft('copy-header', 'Stickers TikTok & SFX HD · 100% local', 'Stickers HD locales · SFX profesionales');
soft('copy-local-title', '<span>100% LOCAL</span>', '<span>TUS ARCHIVOS, LOCAL</span>');
soft('copy-local-body', 'Sin conexión. Tus archivos, tu privacidad.', 'Stickers generados en tu navegador. Tus archivos nunca salen de esta pestaña.');
soft('copy-footer', 'Masterizado con compresor + reverb estéreo · Royalty-free', 'Audio profesional royalty-free · Sin tono ni volumen se entrega el MP3 original');

if (fails.length) { console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', ')); process.exit(1); }
fs.writeFileSync(PATH, src);
console.log('✅ SFX de R2 conectados (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-sfxr2');