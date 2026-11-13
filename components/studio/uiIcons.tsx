'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const P: Record<string, string> = {
  rotate: 'M3 2v6h6M3.5 15a9 9 0 1 0 2.1-9.4L3 8',
  reset: 'M21 2v6h-6M20.5 15a9 9 0 1 1-2.1-9.4L21 8',
  crosshair: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  film: 'M3 4h18v16H3zM7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4',
  sun: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M12 1.5v2.5M12 20v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M1.5 12H4M20 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8',
  moon: 'M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5a8.6 8.6 0 1 0 11.3 11.3z',
  contrast: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 3v18M12 7.5a4.5 4.5 0 0 1 0 9',
  palette: 'M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.9s-.5-1.4-.5-2.3.6-1.6 1.6-1.6h2c1.5 0 2.9-1.1 2.9-3A9 9 0 0 0 12 3M7.5 12.6h.01M10 8.6h.01M14.6 8.1h.01',
  spectrum: 'M3.5 18a8.5 8.5 0 0 1 17 0M7 18a5 5 0 0 1 10 0M10.5 18a1.5 1.5 0 0 1 3 0',
  droplet: 'M12 2.7l5 5.4a7 7 0 1 1-10 0z',
  bulb: 'M9.5 18.5h5M10.5 21.5h3M12 2.5a6 6 0 0 0-3.5 10.9v2.6h7v-2.6A6 6 0 0 0 12 2.5z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3.5M8.5 21h7',
  chroma: 'M3.5 4.5h17v15h-17zM3.5 15.5l4.5-4.5 3.5 3.5 3-3 6 6M9 9.2a1.4 1.4 0 1 0 0-.01',
  clapper: 'M3 8.5h18V20H3zM3 8.5L5 4h14l2 4.5M7.5 4l-1 4.5M12.5 4l-1 4.5M17.5 4l-1 4.5',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16.2 16.2L21 21',
  toolbox: 'M3 8h18v12H3zM8.5 8V5h7v3M3 13h18M10 13v2.5h4V13',
  comment: 'M4 5h16v11H9.5L4 20z',
  copy: 'M9 9h11v11H9zM4.5 15V4h11',
  duplicate: 'M8 8h12v12H8zM4 16V4h12M14 11.5v5M11.5 14h5',
  paste: 'M12 3v10.5M8 9.5l4 4 4-4M4 17v3.5h16V17',
  link: 'M10.2 13.8a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M13.8 10.2a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1',
  lock: 'M5.5 11h13v9.5h-13zM9 11V7.2a3 3 0 0 1 6 0V11',
  unlock: 'M5.5 11h13v9.5h-13zM9 11V7.2a3 3 0 0 1 5.9-.8',
  volume: 'M4 9.5h3l4-4v13l-4-4H4zM15.5 9.5a3.6 3.6 0 0 1 0 5M18.2 6.8a7.5 7.5 0 0 1 0 10.4',
  volumeX: 'M4 9.5h3l4-4v13l-4-4H4zM15.5 9.5l5 5M20.5 9.5l-5 5',
  eye: 'M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12S18 17.8 12 17.8 2.5 12 2.5 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6',
  eyeOff: 'M4 4l16 16M10.4 6.5A9.6 9.6 0 0 1 12 6.2c6 0 9.5 5.8 9.5 5.8a17.6 17.6 0 0 1-3.1 3.7M6.6 8.5A17.4 17.4 0 0 0 2.5 12S6 17.8 12 17.8c1.1 0 2.2-.2 3.1-.5M9.9 9.9a3 3 0 0 0 4.2 4.2',
  arrowUp: 'M12 20V4.5M6 10.5l6-6 6 6',
  arrowDown: 'M12 4v15.5M6 13.5l6 6 6-6',
  arrowLeft: 'M20 12H4.5M10.5 6l-6 6 6 6',
  arrowRight: 'M4 12h15.5M13.5 6l6 6-6 6',
  chevD: 'm6 9 6 6 6-6',
  chevR: 'm9 6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4z',
  bolt: 'M13 2.5L4.5 14H10l-1 7.5L19.5 10H13z',
  gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19',
  x: 'M18 6L6 18M6 6l12 12',
  target: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 11.4a.6 .6 0 1 0 0 1.2 .6 .6 0 0 0 0-1.2',
  package: 'M12 3l9 4.5v9L12 21l-9-4.5v-9zM3 7.5l9 4.5 9-4.5M12 12v9',
  hourglass: 'M7 3h10M7 21h10M8 3c0 4.2 8 5 8 9s-8 4.8-8 9M16 3c0 4.2-8 5-8 9s8 4.8 8 9',
  check: 'M20 6.5L9.2 17.3l-5.2-5.2',
  chart: 'M3 20.5h18M7 20.5v-6.5M12 20.5V6M17 20.5v-9.5',
  pen: 'M16.8 3.2a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  filePlus: 'M14 3H6v18h12V7zM14 3v4h4M12 11v6M9 14h6',
  download: 'M12 3v12M7 10l5 5 5-5M4 20.5h16',
  squareOutline: 'M4 4h16v16H4zM8 8h8v8H8',
  textLines: 'M4 6h16M4 11h12M4 16h9M4 20.5h6',
  highlight: 'M4 5h16v14H4zM7.5 10h9v4h-9z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7.2v5.2l3.6 2.1',
  heart: 'M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-7.8a5.5 5.5 0 0 0 0-7.8z',
  repeat: 'M17 2.5l4 4-4 4M3 11.5v-1a4 4 0 0 1 4-4h14M7 21.5l-4-4 4-4M21 12.5v1a4 4 0 0 1-4 4H3',
  shuffle: 'M16 3.5h5v5M4 20.5L21 3.5M21 15.5v5h-5M15 15l6 5.5M4 3.5l5 5',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5',
  checkerboard: 'M4 4h16v16H4zM4 12h8v8M12 4v8h8',
  roundedSquare: 'M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z',
  badgeCheck: 'M12 2.4l2.4 1.8 3-.2 .9 2.9 2.5 1.7-1.2 2.9 1.2 2.9-2.5 1.7-.9 2.9-3-.2L12 21.6l-2.4-1.8-3 .2-.9-2.9L3.2 15.4 4.4 12.5 3.2 9.6l2.5-1.7 .9-2.9 3 .2zM8.6 12.3l2.3 2.3 4.6-4.9',
  camera: 'M4 8h3l2-3h6l2 3h3v12H4zM12 10.2a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11.2v5.6M12 7.4v.6',
  warn: 'M12 3.2l9.4 17.3H2.6zM12 9.4v4.8M12 17.2v.6',
  text: 'M5 5.5h14M12 5.5v13M9 18.5h6',
  image: 'M3.5 5h17v14h-17zM3.5 16l5-5 4 4 3-3 5 5M9 9.2a1.3 1.3 0 1 0 0-.01',
  music: 'M9 18V5.5l10-2V16M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0M19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  scissors: 'M6.5 4.5l11 11M17.5 4.5l-11 11M6 20.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2M18 20.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2',
  sparkles: 'M11 3l1.7 4.4L17 9l-4.3 1.6L11 15l-1.7-4.4L5 9l4.3-1.6zM18 14.5l.8 2.2 2.2 .8-2.2 .8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  trash: 'M4 7h16M9.5 7V4h5v3M6.5 7l1 14h9l1-14M10.5 11v6M13.5 11v6',
  dot: 'M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3',
  pop: 'M12 2.5l2.2 5.1 5.3-1.6-2.6 4.8 4.6 3-5.4 1 1 5.4-4.6-3-3.4 4.3-1.2-5.4-5.2 1.4 2.8-4.7L2 10.6l5.4-1.1L6 4.2l4.4 3z',
  bounce: 'M12 3.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8M3 20.5c3-6 6-6 9 0M12 20.5c2-4 4-4 6 0M12 11.5v3',
  drop: 'M12 2.5v9M8.5 8l3.5 3.5L15.5 8M3 20.5c2.5-4.5 5-4.5 7.5 0M10.5 20.5c2-3.5 4-3.5 6 0M16.5 20.5c1.2-2 2.4-2 3.5 0',
  shake: 'M9 5.5h6v13H9zM5.5 8.5L3 12l2.5 3.5M18.5 8.5L21 12l-2.5 3.5M7 3.5L5 5M17 3.5L19 5',
  swing: 'M12 3v3M12 6a5 5 0 0 0-5 5c0 3 2 4.5 5 4.5s5-1.5 5-4.5a5 5 0 0 0-5-5M3 20c2-2.5 4-2.5 6 0M15 20c2-2.5 4-2.5 6 0',
  keyboard: 'M3 6.5h18v11H3zM6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M6.5 13.5h.01M17 13.5h.01M9.5 13.5h5',
  cornerLeft: 'M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 5 5v4',
  cornerRight: 'M15 14l4-4-4-4M19 10h-9a5 5 0 0 0-5 5v4',
  balloon: 'M12 2.5a6 6 0 0 0-6 6c0 4 3.5 7 6 7s6-3 6-7a6 6 0 0 0-6-6M12 15.5v2M10.5 21c1-1.5 2-1.5 3 0',
  pulse: 'M2.5 12h4l2-5 3 10 2.5-5h7.5',
  zoomIn: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16.2 16.2L21 21M11 8v6M8 11h6',
  zoomOut: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M16.2 16.2L21 21M8 11h6',
  balance: 'M12 3v18M7 21h10M4 8h16M4 8l-2.5 6h5zM20 8l-2.5 6h5zM1.5 14a2.5 2.5 0 0 0 5 0M17.5 14a2.5 2.5 0 0 0 5 0',
  diamond: 'M6 3h12l4 6-10 12L2 9zM2 9h20M9 3l-3 6 6 12M15 3l3 6-6 12',
  folder: 'M3 6.5h6l2 2.5h10v11H3z',
  gauge: 'M12 20a8 8 0 1 1 8-8M12 12l5-4M20 12h1.5M12 4V2.5',
  wave: 'M2.5 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0',
};

const FILLED = new Set(['heartFilled']);

export function UiIcon({ name, className = 'h-4 w-4', strokeWidth = 1.9 }: { name: string; className?: string; strokeWidth?: number }) {
  const filled = FILLED.has(name);
  const key = filled ? name.replace('Filled', '') : name;
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" focusable="false">
      <path d={P[key] || P.dot} />
    </svg>
  );
}

export const ANIM_ICON: Record<string, string> = {
  none: 'dot',
  'pop-bounce': 'pop', 'pop-down': 'pop',
  'bounce-bottom': 'bounce', 'bounce-top': 'bounce', 'bounce-left': 'bounce', 'bounce-right': 'bounce',
  'bounce-out-bottom': 'bounce', 'bounce-out-top': 'bounce', 'bounce-out-left': 'bounce', 'bounce-out-right': 'bounce',
  'drop-bounce': 'drop',
  'shake-in': 'shake', 'shake-out': 'shake',
  'swing-in': 'swing',
  'neon-in': 'bolt', 'neon-out': 'bolt',
  typewriter: 'keyboard',
  'from-left': 'cornerLeft', 'from-right': 'cornerRight', 'from-top': 'arrowDown', 'from-bottom': 'arrowUp',
  'to-left': 'arrowLeft', 'to-right': 'arrowRight', 'to-top': 'arrowUp', 'to-bottom': 'arrowDown',
  'pop-elastic': 'balloon', 'pulse-in': 'pulse',
  'zoom-in': 'zoomIn', 'zoom-out': 'zoomOut',
};

export const TRANSITION_ICON: Record<string, string> = {
  none: 'dot', fade: 'wave', dissolve: 'droplet', fadeblack: 'squareOutline', fadewhite: 'squareOutline',
  fadegrays: 'contrast', pixelize: 'checkerboard', hblur: 'droplet',
  wipeleft: 'arrowLeft', wiperight: 'arrowRight', wipeup: 'arrowUp', wipedown: 'arrowDown',
  hlslice: 'textLines', vuslice: 'textLines', squeezeh: 'roundedSquare', squeezev: 'roundedSquare',
  slideleft: 'arrowLeft', slideright: 'arrowRight', slideup: 'arrowUp', slidedown: 'arrowDown',
  smoothleft: 'cornerLeft', smoothright: 'cornerRight',
  circleopen: 'target', circleclose: 'target', circlecrop: 'target', rectcrop: 'squareOutline',
  radial: 'reset', zoomin: 'zoomIn', diagtl: 'cornerLeft', diagbr: 'cornerRight',
};

export const ASR_ICON: Record<string, string> = {
  tiny: 'bolt', base: 'mic', small: 'mic', medium: 'gauge', large: 'sparkles', 'large-v2': 'sparkles', 'large-v3': 'sparkles', turbo: 'bolt',
};

export const SUBSTYLE_ICON: Record<string, string> = {
  static: 'textLines', 'karaoke-color': 'mic', 'karaoke-box': 'highlight', 'single-word': 'bolt',
};

const DIALOG_MAP: Record<string, string> = { trash: 'trash', new: 'filePlus', comment: 'comment', '🗑': 'trash', '🆕': 'filePlus', '💬': 'comment' };
export function DialogGlyph({ name, className = 'h-6 w-6' }: { name: string; className?: string }) {
  return <UiIcon name={DIALOG_MAP[name] || DIALOG_MAP[name.replace(/\uFE0F/g, '')] || 'info'} className={className} strokeWidth={1.8} />;
}

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
export function cleanLabel(s: string): string {
  return String(s).replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}

const ACCENTS: Record<string, { on: string; ring: string }> = {
  cyan: { on: 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200', ring: 'hover:border-cyan-400/60' },
  fuchsia: { on: 'border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200', ring: 'hover:border-fuchsia-400/60' },
  pink: { on: 'border-pink-400/60 bg-pink-500/15 text-pink-200', ring: 'hover:border-pink-400/60' },
  amber: { on: 'border-amber-400/60 bg-amber-500/15 text-amber-200', ring: 'hover:border-amber-400/60' },
};

export function IconSelect({ value, options, onChange, accent = 'cyan', ariaLabel }: {
  value: string;
  options: { id: string; label: string; icon: string }[];
  onChange: (id: string) => void;
  accent?: 'cyan' | 'fuchsia' | 'pink' | 'amber';
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0, width: 220, up: false });
  const a = ACCENTS[accent] || ACCENTS.cyan;
  const cur = options.find((o) => o.id === value) || options[0] || { id: 'none', label: '—', icon: 'dot' };

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const b = btnRef.current?.getBoundingClientRect();
      if (!b) return;
      const h = Math.min(260, options.length * 34 + 10);
      const up = b.bottom + h + 8 > window.innerHeight && b.top > h;
      setPos({ left: Math.max(8, Math.min(b.left, window.innerWidth - b.width - 8)), top: up ? b.top - h - 4 : b.bottom + 4, width: b.width, up });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey, true); };
  }, [open]);

  return (
    <>
      <button ref={btnRef} type="button" aria-label={ariaLabel} aria-expanded={open} onClick={() => setOpen((v) => !v)}
        className={'mt-1 flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none transition ' + a.ring}>
        <UiIcon name={cur.icon} className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{cur.label}</span>
        <UiIcon name="chevD" className={'h-3.5 w-3.5 shrink-0 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={popRef} role="listbox" style={{ left: pos.left, top: pos.top, width: pos.width }}
          className="fixed z-[320] max-h-[260px] overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/98 p-1 shadow-2xl shadow-black/60 backdrop-blur">
          {options.map((o) => (
            <button key={o.id} type="button" role="option" aria-selected={o.id === value}
              onClick={() => { onChange(o.id); setOpen(false); }}
              className={'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] font-semibold transition ' + (o.id === value ? a.on : 'border-transparent text-slate-300 hover:bg-slate-800')}>
              <UiIcon name={o.icon} className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.id === value && <UiIcon name="check" className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}