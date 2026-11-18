// aplicar-medialib-fix.mjs — play visible fuera de la miniatura + logos SVG reales por categoría
import fs from 'node:fs';
const PATH = 'components/studio/mediaLibrary.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-mlfix', src);
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
function span(name, start, end, content) {
  const s = src.indexOf(start); const e = src.indexOf(end, s + 1);
  if (s === -1 || e === -1) { fails.push(name + '(span)'); return; }
  src = src.slice(0, s) + content + src.slice(e); ops.push(name);
}

/* 1 ── Paleta por categoría + set de logos SVG (mismos glifos del Generador de Comentarios) */
rep('cat-icons',
"const ACCENTS = ['#ff0050', '#22d3ee', '#a855f7', '#4ade80', '#fbbf24', '#f43f5e'];",
`const ACCENTS = ['#ff0050', '#22d3ee', '#a855f7', '#4ade80', '#fbbf24', '#f43f5e'];

const CAT_HUE: Record<string, string> = {
  'Todos': '#22d3ee',
  'TikTok': '#ff0050',
  'TikTok & Viral': '#ff0050',
  'YouTube': '#ff3b30',
  'Redes': '#e1306c',
  'UI': '#38bdf8',
  'Interfaz': '#38bdf8',
  'Transiciones': '#a855f7',
  'Notificaciones': '#fbbf24',
  'Impactos': '#f43f5e',
  'Comedia': '#4ade80',
  'Favoritos': '#f472b6',
  'Recientes': '#f59e0b',
};

function CatIcon({ cat, className = 'h-4 w-4' }: { cat: string; className?: string }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (cat) {
    case 'TikTok':
    case 'TikTok & Viral':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
        </svg>
      );
    case 'YouTube':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.12 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    case 'Redes':
      return (
        <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden="true">
          <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
        </svg>
      );
    case 'Transiciones':
      return (
        <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden="true">
          <path d="M3 8h14" /><path d="m14 5 3 3-3 3" />
          <path d="M21 16H7" /><path d="m10 13-3 3 3 3" />
        </svg>
      );
    case 'Notificaciones':
      return (
        <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      );
    case 'Impactos':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 1.5 14 8l6.5-2.5L17 11l5.5 3.5L16 15l2 6.5-6-4-6 4 2-6.5-6.5-.5L7 11 3.5 5.5 10 8z" />
        </svg>
      );
    case 'Comedia':
      return (
        <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14.5s1.5 2 4 2 4-2 4-2" />
          <line x1="9" x2="9.01" y1="9.5" y2="9.5" />
          <line x1="15" x2="15.01" y1="9.5" y2="9.5" />
        </svg>
      );
    case 'Interfaz':
      return (
        <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden="true">
          <path d="m4 3 7.5 17 2.2-6.8 6.8-2.2z" /><path d="m13.5 13.5 5.5 5.5" />
        </svg>
      );
    case 'UI':
      return (
        <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden="true">
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
        </svg>
      );
    case 'Favoritos':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 21s-7.5-4.7-9.4-9A5.4 5.4 0 0 1 12 6.6 5.4 5.4 0 0 1 21.4 12c-1.9 4.3-9.4 9-9.4 9z" />
        </svg>
      );
    case 'Recientes':
      return (
        <svg viewBox="0 0 24 24" {...stroke} className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.4 2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M12 2.5 13.9 9 20.5 11l-6.6 2L12 19.5 10.1 13 3.5 11 10.1 9z" />
          <path d="M19 3.2 19.8 5.4 22 6.2l-2.2.8L19 9.2l-.8-2.2L16 6.2l2.2-.8z" />
        </svg>
      );
  }
}`);

/* 2 ── Badge de categoría: logo real + color de la propia categoría */
span('cat-badge',
'const renderCatBadgeIcon = (catName: string)',
'return createPortal(',
`const renderCatBadgeIcon = (catName: string, active = false) => {
    const hue = CAT_HUE[catName] || '#22d3ee';
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition"
        style={{
          background: hue + (active ? '38' : '1c'),
          borderColor: hue + (active ? 'aa' : '44'),
          color: hue,
          boxShadow: active ? '0 0 10px ' + hue + '66' : undefined,
        }}
      >
        <CatIcon cat={catName} className="h-3.5 w-3.5" />
      </span>
    );
  };

  `);
rep('badge-cat', '{renderCatBadgeIcon(cat)}', '{renderCatBadgeIcon(cat, active)}');
rep('badge-special', '{renderCatBadgeIcon(special)}', '{renderCatBadgeIcon(special, active)}');

/* 3 ── Chips móviles con logo y color de categoría */
repRe('chips',
/<button\s+key=\{c\}\s+onClick=\{\(\) => setActiveCat\(c\)\}[\s\S]*?\{c\} \(\{catCounts\[c\] \?\? 0\}\)\s*<\/button>/,
() => `<button
                 key={c}
                 onClick={() => setActiveCat(c)}
                 className={cx(
                   'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition active:scale-95',
                   active ? 'text-white' : 'border-[#223f63] bg-[#0a1729] text-slate-400 hover:text-slate-200'
                 )}
                 style={active ? { borderColor: (CAT_HUE[c] || '#22d3ee') + 'cc', background: (CAT_HUE[c] || '#22d3ee') + '26', boxShadow: '0 0 10px ' + (CAT_HUE[c] || '#22d3ee') + '40' } : undefined}
               >
                 <span style={{ color: CAT_HUE[c] || '#22d3ee' }} className="flex items-center"><CatIcon cat={c} className="h-3.5 w-3.5" /></span>
                 {c} ({catCounts[c] ?? 0})
               </button>`);

/* 4 ── Fuente de audio con stop real (play/stop conmutables) */
rep('sfx-ref',
'const colorInputRef = useRef<HTMLInputElement>(null);',
'const colorInputRef = useRef<HTMLInputElement>(null);\n  const sfxSourceRef = useRef<AudioBufferSourceNode | null>(null);');

span('sfx-toggle',
'const previewAudio = useCallback(',
'const insertSfx = async () => {',
`const stopSfx = useCallback(() => {
    const s = sfxSourceRef.current;
    if (s) {
      try { s.onended = null; s.stop(); } catch { /* ya terminó */ }
      sfxSourceRef.current = null;
    }
    setPlayingAudioId(null);
  }, []);

  const previewAudio = useCallback(
    async (def: SfxDef) => {
      markRecent(def.id);
      if (playingAudioId === def.id) { stopSfx(); return; }
      stopSfx();
      if (muted) return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!acRef.current) acRef.current = new AudioCtx();
      const ac = acRef.current;
      if (ac.state === 'suspended') await ac.resume();
      setPlayingAudioId(def.id);
      try {
        const { blob } = await renderSfx(def, tune, vol);
        const buf = await ac.decodeAudioData(await blob.arrayBuffer());
        const s = ac.createBufferSource();
        s.buffer = buf;
        s.connect(ac.destination);
        sfxSourceRef.current = s;
        s.onended = () => {
          if (sfxSourceRef.current === s) {
            sfxSourceRef.current = null;
            setPlayingAudioId((p) => (p === def.id ? null : p));
          }
        };
        s.start();
      } catch {
        sfxSourceRef.current = null;
        setPlayingAudioId(null);
      }
    },
    [muted, tune, vol, markRecent, playingAudioId, stopSfx]
  );

  useEffect(() => { if (muted) stopSfx(); }, [muted, stopSfx]);

  `);

/* 5 ── Tarjeta de SFX: miniatura limpia + botón de play grande y visible afuera */
repRe('sfx-card',
/<div className="relative flex h-20 w-full[\s\S]*?\{s\.cat\} · \{s\.dur\.toFixed\(2\)\}s\s*<\/p>\s*<\/div>/,
() => `<div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] bg-gradient-to-b from-[#08132a] to-[#050d1c] px-2">
                     <SfxWaveform def={s} active={isSel} playing={isPlay} barsCount={26} />
                     <span className="pointer-events-none absolute bottom-1.5 left-2 rounded bg-[#040b17]/85 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300/90">{s.dur.toFixed(2)}s</span>
                     <button
                       type="button"
                       onClick={(e) => toggleFav(s.id, e)}
                       title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                       aria-label="Favorito"
                       className={cx(
                         'absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border text-[12px] transition active:scale-90',
                         isFav
                           ? 'border-pink-400/70 bg-pink-500/25 text-pink-400'
                           : 'border-white/10 bg-[#071122]/75 text-slate-400 opacity-80 hover:text-pink-300 group-hover:opacity-100'
                       )}
                     >
                       {isFav ? '♥' : '♡'}
                     </button>
                     {isPlay && <span className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-cyan-400/70" />}
                   </div>
                   <div className="mt-2 flex items-center gap-2 px-0.5">
                     <button
                       type="button"
                       onClick={(e) => { e.stopPropagation(); setSelS(s.id); void previewAudio(s); }}
                       title={isPlay ? 'Detener' : 'Escuchar ' + s.name}
                       aria-label={isPlay ? 'Detener' : 'Escuchar'}
                       className={cx(
                         'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition active:scale-90',
                         isPlay
                           ? 'border-cyan-200 bg-gradient-to-br from-cyan-300 to-sky-400 text-[#04101f] shadow-[0_0_14px_rgba(34,211,238,0.65)]'
                           : 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200 hover:border-cyan-300 hover:bg-cyan-500/30'
                       )}
                     >
                       {isPlay ? (
                         <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                       ) : (
                         <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4"><path d="M8 5v14l11-7z" /></svg>
                       )}
                     </button>
                     <div className="min-w-0 flex-1">
                       <p className="truncate text-[12px] font-extrabold text-slate-100">{s.name}</p>
                       <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{s.cat}</p>
                     </div>
                   </div>`);

/* 6 ── Botón grande del monitor: stop en vez de spinner eterno */
rep('monitor-stop',
'<span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />',
'<svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>');

if (fails.length) { console.error('❌ NO se tocó nada. Anclas fallidas: ' + fails.join(', ')); process.exit(1); }
fs.writeFileSync(PATH, src);
console.log('✅ mediaLibrary arreglada (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup:', PATH + '.bak-mlfix');