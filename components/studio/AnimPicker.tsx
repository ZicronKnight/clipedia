'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type AnimAccent = 'fuchsia' | 'pink' | 'amber' | 'cyan';
type Dir = 'in' | 'out';

function cx(...p: (string | false | null | undefined)[]) { return p.filter(Boolean).join(' '); }
function cleanLabel(s: string) { return String(s || '').replace(/^[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]+/, '').trim(); }

const ACCENT: Record<AnimAccent, { ring: string; open: string; slot: string; row: string; check: string; grad: string; head: string }> = {
  fuchsia: { ring: 'focus-visible:ring-fuchsia-400/70', open: 'border-fuchsia-400/70 bg-fuchsia-500/10', slot: 'border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300', row: 'bg-fuchsia-500/15 text-fuchsia-100', check: 'text-fuchsia-300', grad: 'from-fuchsia-400 to-violet-500', head: 'text-fuchsia-300' },
  pink: { ring: 'focus-visible:ring-pink-400/70', open: 'border-pink-400/70 bg-pink-500/10', slot: 'border-pink-400/30 bg-pink-500/10 text-pink-300', row: 'bg-pink-500/15 text-pink-100', check: 'text-pink-300', grad: 'from-pink-400 to-rose-500', head: 'text-pink-300' },
  amber: { ring: 'focus-visible:ring-amber-400/70', open: 'border-amber-400/70 bg-amber-500/10', slot: 'border-amber-400/30 bg-amber-500/10 text-amber-300', row: 'bg-amber-500/15 text-amber-100', check: 'text-amber-300', grad: 'from-amber-400 to-orange-500', head: 'text-amber-300' },
  cyan: { ring: 'focus-visible:ring-cyan-400/70', open: 'border-cyan-400/70 bg-cyan-500/10', slot: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-300', row: 'bg-cyan-500/15 text-cyan-100', check: 'text-cyan-300', grad: 'from-cyan-400 to-violet-500', head: 'text-cyan-300' },
};

const CSS = `
.ap-scroll{scrollbar-width:thin;scrollbar-color:#8b5cf6 #0b1220}
.ap-scroll::-webkit-scrollbar{width:9px}
.ap-scroll::-webkit-scrollbar-track{background:#0b1220;border-radius:9px;margin:5px}
.ap-scroll::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#22d3ee,#8b5cf6);border-radius:9px;border:2px solid #0b1220}
.ap-scroll::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#67e8f9,#a78bfa)}
@keyframes apInLeft{0%{transform:translateX(-8px);opacity:.15}55%,100%{transform:translateX(0);opacity:1}}
@keyframes apInRight{0%{transform:translateX(8px);opacity:.15}55%,100%{transform:translateX(0);opacity:1}}
@keyframes apInTop{0%{transform:translateY(-8px);opacity:.15}55%,100%{transform:translateY(0);opacity:1}}
@keyframes apInBottom{0%{transform:translateY(8px);opacity:.15}55%,100%{transform:translateY(0);opacity:1}}
@keyframes apOutLeft{0%{transform:translateX(0);opacity:1}70%,100%{transform:translateX(-8px);opacity:.12}}
@keyframes apOutRight{0%{transform:translateX(0);opacity:1}70%,100%{transform:translateX(8px);opacity:.12}}
@keyframes apOutTop{0%{transform:translateY(0);opacity:1}70%,100%{transform:translateY(-8px);opacity:.12}}
@keyframes apOutBottom{0%{transform:translateY(0);opacity:1}70%,100%{transform:translateY(8px);opacity:.12}}
@keyframes apZoomIn{0%{transform:scale(.45);opacity:.25}65%,100%{transform:scale(1);opacity:1}}
@keyframes apZoomOut{0%{transform:scale(1);opacity:1}70%,100%{transform:scale(.45);opacity:.2}}
@keyframes apPop{0%{transform:scale(.35);opacity:0}45%{transform:scale(1.2);opacity:1}72%{transform:scale(.93)}100%{transform:scale(1)}}
@keyframes apElastic{0%{transform:scale(.3)}48%{transform:scale(1.26)}70%{transform:scale(.87)}86%{transform:scale(1.07)}100%{transform:scale(1)}}
@keyframes apPulse{0%,100%{transform:scale(1)}28%{transform:scale(1.17)}52%{transform:scale(.96)}74%{transform:scale(1.06)}}
@keyframes apDrop{0%{transform:translateY(-9px)}42%{transform:translateY(0)}60%{transform:translateY(-3.4px)}78%{transform:translateY(0)}89%{transform:translateY(-1.2px)}100%{transform:translateY(0)}}
@keyframes apBounceY{0%{transform:translateY(7px)}38%{transform:translateY(-3.2px)}62%{transform:translateY(1.6px)}82%{transform:translateY(-.9px)}100%{transform:translateY(0)}}
@keyframes apBounceYInv{0%{transform:translateY(-7px)}38%{transform:translateY(3.2px)}62%{transform:translateY(-1.6px)}82%{transform:translateY(.9px)}100%{transform:translateY(0)}}
@keyframes apBounceX{0%{transform:translateX(-7px)}38%{transform:translateX(3.2px)}62%{transform:translateX(-1.6px)}82%{transform:translateX(.9px)}100%{transform:translateX(0)}}
@keyframes apBounceXInv{0%{transform:translateX(7px)}38%{transform:translateX(-3.2px)}62%{transform:translateX(1.6px)}82%{transform:translateX(-.9px)}100%{transform:translateX(0)}}
@keyframes apShake{0%,100%{transform:translateX(0)}18%{transform:translateX(-2.6px)}36%{transform:translateX(2.6px)}54%{transform:translateX(-1.9px)}72%{transform:translateX(1.9px)}88%{transform:translateX(-.9px)}}
@keyframes apSwing{0%,100%{transform:rotate(-17deg)}50%{transform:rotate(17deg)}}
@keyframes apNeon{0%,100%{opacity:1}10%{opacity:.12}20%{opacity:1}30%{opacity:.18}42%{opacity:1}56%{opacity:.3}66%{opacity:1}}
@keyframes apNeonOut{0%{opacity:1}14%{opacity:.2}26%{opacity:.9}40%{opacity:.15}58%{opacity:.6}100%{opacity:.12}}
@keyframes apDraw{0%{stroke-dashoffset:12}68%,100%{stroke-dashoffset:0}}
@keyframes apCaret{0%,48%{opacity:1}49%,100%{opacity:0}}
`;

let injected = false;
function ensureStyles() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const el = document.createElement('style');
  el.setAttribute('data-anim-picker', 'true');
  el.textContent = CSS;
  document.head.appendChild(el);
}

type Parts = { fixed?: React.ReactNode; move?: React.ReactNode; anim?: string; origin?: string };

function parts(id: string, dir: Dir): Parts {
  const wallL = <path d="M3.5 4v16" opacity={0.5} />;
  const wallR = <path d="M20.5 4v16" opacity={0.5} />;
  const wallT = <path d="M4 3.5h16" opacity={0.5} />;
  const wallB = <path d="M4 20.5h16" opacity={0.5} />;
  const arrowR = <><path d="M7 12h9" /><path d="m12.5 8 4 4-4 4" /></>;
  const arrowL = <><path d="M17 12H8" /><path d="m11.5 8-4 4 4 4" /></>;
  const arrowD = <><path d="M12 7v9" /><path d="m8 12.5 4 4 4-4" /></>;
  const arrowU = <><path d="M12 17V8" /><path d="m8 11.5 4-4 4 4" /></>;
  const box = <rect x="8.5" y="8.5" width="7" height="7" rx="1.6" />;
  const dashBox = <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" strokeDasharray="3 2.6" opacity={0.4} />;
  const bolt = <path d="M13.2 2.5 5.5 13.2h5.2l-1.1 8.3 7.9-11.2h-5.1z" />;

  switch (id) {
    case 'none': return { fixed: <><circle cx="12" cy="12" r="8.2" opacity={0.5} /><path d="M6.6 17.4 17.4 6.6" opacity={0.5} /></> };
    case 'from-left': return { fixed: wallL, move: arrowR, anim: 'apInLeft 1.35s cubic-bezier(.22,1,.36,1) infinite' };
    case 'from-right': return { fixed: wallR, move: arrowL, anim: 'apInRight 1.35s cubic-bezier(.22,1,.36,1) infinite' };
    case 'from-top': return { fixed: wallT, move: arrowD, anim: 'apInTop 1.35s cubic-bezier(.22,1,.36,1) infinite' };
    case 'from-bottom': return { fixed: wallB, move: arrowU, anim: 'apInBottom 1.35s cubic-bezier(.22,1,.36,1) infinite' };
    case 'to-left': return { fixed: wallL, move: arrowL, anim: 'apOutLeft 1.35s ease-in infinite' };
    case 'to-right': return { fixed: wallR, move: arrowR, anim: 'apOutRight 1.35s ease-in infinite' };
    case 'to-top': return { fixed: wallT, move: arrowU, anim: 'apOutTop 1.35s ease-in infinite' };
    case 'to-bottom': return { fixed: wallB, move: arrowD, anim: 'apOutBottom 1.35s ease-in infinite' };
    case 'zoom-in': return { fixed: <>{dashBox}<path d="M6 6 4 4M18 6l2-2M6 18l-2 2M18 18l2 2" opacity={0.7} /></>, move: box, anim: 'apZoomIn 1.4s cubic-bezier(.22,1,.36,1) infinite' };
    case 'zoom-out': return { fixed: <>{dashBox}<path d="M4 4l2 2M20 4l-2 2M4 20l2-2M20 20l-2-2" opacity={0.7} /></>, move: box, anim: 'apZoomOut 1.4s ease-in infinite' };
    case 'pop-bounce': return { fixed: <path d="M12 2.4v2.3M12 19.3v2.3M2.4 12h2.3M19.3 12h2.3M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" opacity={0.6} />, move: <circle cx="12" cy="12" r="4" />, anim: 'apPop 1.3s ease-out infinite' };
    case 'pop-elastic': return { fixed: <circle cx="12" cy="12" r="8.6" strokeDasharray="2.6 2.6" opacity={0.4} />, move: <circle cx="12" cy="12" r="4" />, anim: 'apElastic 1.5s ease-out infinite' };
    case 'pulse-in': return { move: <path d="M2.5 12h4l2.2-5.6 3.2 11.2 2.4-5.6h7.2" />, anim: 'apPulse 1.2s ease-in-out infinite' };
    case 'pop-down': return { fixed: <><path d="M3.5 20.5h17" opacity={0.5} /><path d="M6.2 18.4 4.6 20M17.8 18.4l1.6 1.6" opacity={0.45} /></>, move: <rect x="8" y="6" width="8" height="8" rx="1.8" />, anim: 'apDrop 1.5s ease-out infinite' };
    case 'drop-bounce': return { fixed: <><path d="M3.5 20.5h17" opacity={0.5} /><path d="M4 20.5q2.2-7 4.4 0q1.6-4.6 3.2 0q1.1-2.8 2.2 0" opacity={0.5} /></>, move: <circle cx="17.4" cy="18" r="2.3" />, anim: 'apDrop 1.6s ease-out infinite' };
    case 'bounce-bottom': return { fixed: <><path d="M3.5 20.5h17" opacity={0.5} /><path d="M12 20c-4-3 4-6 0-9" opacity={0.45} /></>, move: <circle cx="12" cy="7.4" r="2.7" />, anim: 'apBounceY 1.5s ease-out infinite' };
    case 'bounce-top': return { fixed: <><path d="M3.5 3.5h17" opacity={0.5} /><path d="M12 4c4 3-4 6 0 9" opacity={0.45} /></>, move: <circle cx="12" cy="16.6" r="2.7" />, anim: 'apBounceYInv 1.5s ease-out infinite' };
    case 'bounce-left': return { fixed: <><path d="M3.5 3.5v17" opacity={0.5} /><path d="M4 12c3-4 6 4 9 0" opacity={0.45} /></>, move: <circle cx="16.6" cy="12" r="2.7" />, anim: 'apBounceX 1.5s ease-out infinite' };
    case 'bounce-right': return { fixed: <><path d="M20.5 3.5v17" opacity={0.5} /><path d="M20 12c-3 4-6-4-9 0" opacity={0.45} /></>, move: <circle cx="7.4" cy="12" r="2.7" />, anim: 'apBounceXInv 1.5s ease-out infinite' };
    case 'bounce-out-left': return { fixed: <><path d="M3.5 3.5v17" opacity={0.5} /><path d="M20 12c-3-4-6 4-9 0" opacity={0.45} /></>, move: <circle cx="7.4" cy="12" r="2.7" />, anim: 'apBounceXInv 1.5s ease-in infinite' };
    case 'bounce-out-right': return { fixed: <><path d="M20.5 3.5v17" opacity={0.5} /><path d="M4 12c3 4 6-4 9 0" opacity={0.45} /></>, move: <circle cx="16.6" cy="12" r="2.7" />, anim: 'apBounceX 1.5s ease-in infinite' };
    case 'bounce-out-top': return { fixed: <><path d="M3.5 3.5h17" opacity={0.5} /><path d="M12 20c-4-3 4-6 0-9" opacity={0.45} /></>, move: <circle cx="12" cy="7.4" r="2.7" />, anim: 'apBounceY 1.5s ease-in infinite' };
    case 'bounce-out-bottom': return { fixed: <><path d="M3.5 20.5h17" opacity={0.5} /><path d="M12 4c4 3-4 6 0 9" opacity={0.45} /></>, move: <circle cx="12" cy="16.6" r="2.7" />, anim: 'apBounceYInv 1.5s ease-in infinite' };
    case 'shake-in': return { fixed: <><path d="M2 9l2 1.5-2 1.5 2 1.5" opacity={0.6} /><path d="M22 9l-2 1.5 2 1.5-2 1.5" opacity={0.6} /></>, move: box, anim: 'apShake 1.1s ease-in-out infinite' };
    case 'shake-out': return { fixed: <><path d="M2 9l2 1.5-2 1.5 2 1.5" opacity={0.6} /><path d="M22 9l-2 1.5 2 1.5-2 1.5" opacity={0.6} /></>, move: <rect x="8.5" y="8.5" width="7" height="7" rx="1.6" strokeDasharray="2.4 2" />, anim: 'apShake 1.1s ease-in-out infinite' };
    case 'swing-in': return { fixed: <><circle cx="12" cy="4" r="1.3" fill="currentColor" stroke="none" /><path d="M5.5 15.5a7.5 7.5 0 0 1 13 0" strokeDasharray="2.5 2.5" opacity={0.4} /></>, move: <><path d="M12 4.8 16.6 15" /><circle cx="17" cy="16.6" r="2.6" /></>, anim: 'apSwing 1.6s ease-in-out infinite', origin: '0% 0%' };
    case 'neon-in': return { fixed: <path d="M4 4.5 5.6 6M20 4.5 18.4 6M2.6 12h1.9M19.5 12h1.9" opacity={0.55} />, move: bolt, anim: 'apNeon 1.6s linear infinite' };
    case 'neon-out': return { move: <path d="M13.2 2.5 5.5 13.2h5.2l-1.1 8.3 7.9-11.2h-5.1z" strokeDasharray="3 2.2" />, anim: 'apNeonOut 1.6s linear infinite' };
    case 'typewriter': return {
      fixed: <><path d="M3.5 6.5h13" opacity={0.3} /><path d="M3.5 17.5h9" opacity={0.3} /></>,
      move: <><path d="M3.5 12h12" strokeDasharray="12" data-ap="draw" /><rect x="16.6" y="9.6" width="2.6" height="4.8" rx="0.6" fill="currentColor" stroke="none" data-ap="caret" /></>,
    };
    default: return { fixed: <path d="M12 3.5 13.9 9.6 20 11.5l-6.1 1.9L12 19.5l-1.9-6.1L4 11.5l6.1-1.9z" opacity={0.7} /> };
  }
}

function Glyph({ id, dir, live }: { id: string; dir: Dir; live: boolean }) {
  const p = parts(id, dir);
  const drawStyle = live ? { animation: 'apDraw 1.7s steps(12,end) infinite' } : undefined;
  const caretStyle = live ? { animation: 'apCaret 1s step-end infinite' } : undefined;
  const move = React.isValidElement(p.move) || Array.isArray(p.move)
    ? (Array.isArray(p.move) ? p.move : [p.move])
    : [];
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className="h-full w-full" aria-hidden="true">
      {p.fixed}
      <g style={{ transformBox: 'fill-box', transformOrigin: p.origin || 'center', animation: live && p.anim ? p.anim : undefined }}>
        {id === 'typewriter'
          ? (p.move as any) && React.Children.map((p.move as any).props.children, (child: any, i: number) =>
              React.cloneElement(child, { style: child.props['data-ap'] === 'draw' ? drawStyle : caretStyle, key: i })
            )
          : move}
      </g>
    </svg>
  );
}

const GROUPS_IN = [
  { title: 'Deslizamientos', ids: ['from-left', 'from-right', 'from-top', 'from-bottom'] },
  { title: 'Rebotes', ids: ['bounce-bottom', 'bounce-top', 'bounce-left', 'bounce-right', 'drop-bounce'] },
  { title: 'Zoom y pop', ids: ['zoom-in', 'zoom-out', 'pop-bounce', 'pop-elastic', 'pulse-in'] },
  { title: 'Efectos', ids: ['shake-in', 'swing-in', 'neon-in', 'typewriter'] },
];
const GROUPS_OUT = [
  { title: 'Deslizamientos', ids: ['to-left', 'to-right', 'to-top', 'to-bottom'] },
  { title: 'Rebotes', ids: ['bounce-out-left', 'bounce-out-right', 'bounce-out-top', 'bounce-out-bottom'] },
  { title: 'Zoom y pop', ids: ['zoom-in', 'zoom-out', 'pop-down'] },
  { title: 'Efectos', ids: ['shake-out', 'neon-out'] },
];

export function AnimPicker({
  value, options, labels, onChange, direction, accent = 'fuchsia',
}: {
  value: string;
  options: string[];
  labels: Record<string, string>;
  onChange: (v: string) => void;
  direction: Dir;
  accent?: AnimAccent;
}) {
  const a = ACCENT[accent];
  const [open, setOpen] = useState(false);
  const [hoverTrig, setHoverTrig] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; max: number; ready: boolean }>({ left: -9999, top: -9999, width: 260, max: 340, ready: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => { ensureStyles(); }, []);

  const groups = useMemo(() => {
    const src = direction === 'in' ? GROUPS_IN : GROUPS_OUT;
    const set = new Set(options);
    const out = src.map((g) => ({ title: g.title, ids: g.ids.filter((i) => set.has(i)) })).filter((g) => g.ids.length);
    const covered = new Set(out.flatMap((g) => g.ids));
    const rest = options.filter((o) => o !== 'none' && !covered.has(o));
    if (rest.length) out.push({ title: 'Otros', ids: rest });
    return out;
  }, [options, direction]);

  const flat = useMemo(() => {
    const l: string[] = options.includes('none') ? ['none'] : [];
    groups.forEach((g) => l.push(...g.ids));
    return l;
  }, [groups, options]);

  const place = useCallback(() => {
    const b = btnRef.current, el = popRef.current;
    if (!b || !el) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight, m = 8;
    const width = Math.min(Math.max(r.width, 268), vw - m * 2);
    const max = Math.min(360, vh - m * 2);
    el.style.width = width + 'px';
    const h = Math.min(el.scrollHeight + 2, max);
    const below = vh - r.bottom - m;
    const up = below < h + 8 && r.top > below;
    let top = up ? r.top - h - 6 : r.bottom + 6;
    top = Math.max(m, Math.min(top, vh - m - h));
    const left = Math.max(m, Math.min(r.left, vw - m - width));
    setPos({ left, top, width, max, ready: true });
  }, []);

  useLayoutEffect(() => {
    if (!open) { setPos((p) => (p.ready ? { ...p, ready: false } : p)); return; }
    place();
    const i = Math.max(0, flat.indexOf(value));
    setActive(i); setHoverIdx(-1);
    const t = window.setTimeout(() => {
      popRef.current?.focus();
      popRef.current?.querySelector('[data-idx="' + i + '"]')?.scrollIntoView({ block: 'nearest' });
    }, 0);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, place, flat, value]);

  const commit = (v: string) => { onChange(v); setOpen(false); btnRef.current?.focus(); };
  const moveActive = (d: number) => {
    const n = Math.max(0, Math.min(flat.length - 1, active + d));
    setActive(n);
    popRef.current?.querySelector('[data-idx="' + n + '"]')?.scrollIntoView({ block: 'nearest' });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btnRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); popRef.current?.querySelector('[data-idx="0"]')?.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'End') { e.preventDefault(); moveActive(flat.length); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (flat[active]) commit(flat[active]); }
    else if (e.key === 'Tab') setOpen(false);
  };

  const row = (id: string) => {
    const idx = flat.indexOf(id);
    const sel = id === value;
    const hot = hoverIdx === idx || active === idx;
    return (
      <button
        key={id}
        type="button"
        data-idx={idx}
        role="option"
        aria-selected={sel}
        onMouseEnter={() => { setHoverIdx(idx); setActive(idx); }}
        onMouseLeave={() => setHoverIdx(-1)}
        onClick={() => commit(id)}
        className={cx('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors', hot ? a.row : 'text-slate-300 hover:bg-slate-800/60')}
      >
        <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors', hot || sel ? a.slot : 'border-slate-700/70 bg-slate-900/70 text-slate-400')}>
          <span className="block h-[18px] w-[18px]"><Glyph id={id} dir={direction} live={hot} /></span>
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{cleanLabel(labels[id] || id)}</span>
        {sel && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className={cx('h-4 w-4 shrink-0', a.check)} aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
        )}
      </button>
    );
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        onMouseEnter={() => setHoverTrig(true)}
        onMouseLeave={() => setHoverTrig(false)}
        className={cx('mt-1 flex w-full items-center gap-2 rounded-lg border bg-slate-800/90 px-2 py-2 text-slate-200 outline-none transition focus-visible:ring-2', a.ring, open ? a.open : 'border-slate-700 hover:border-slate-600')}
      >
        <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', a.slot)}>
          <span className="block h-[18px] w-[18px]"><Glyph id={value} dir={direction} live={hoverTrig || open} /></span>
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold">{cleanLabel(labels[value] || value)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className={cx('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[240]" onPointerDown={() => setOpen(false)}>
          <div
            ref={popRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onKey}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.max, visibility: pos.ready ? 'visible' : 'hidden' }}
            className="ap-scroll fixed overflow-y-auto rounded-xl border border-slate-700/90 bg-slate-950/95 p-1.5 shadow-2xl shadow-black/60 outline-none backdrop-blur-md"
          >
            <div className="mb-1 flex items-center justify-between gap-2 border-b border-slate-800 px-2 pb-1.5 pt-0.5">
              <span className={cx('text-[10px] font-black uppercase tracking-wider', a.head)}>{direction === 'in' ? 'Animación de entrada' : 'Animación de salida'}</span>
              <span className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">{flat.length}</span>
            </div>
            {options.includes('none') && row('none')}
            {groups.map((g) => (
              <div key={g.title} className="mt-1">
                <p className="px-2 pb-0.5 pt-1 text-[9px] font-black uppercase tracking-wider text-slate-500">{g.title}</p>
                {g.ids.map(row)}
              </div>
            ))}
            <p className="mt-1.5 border-t border-slate-800 px-2 pt-1.5 text-[9.5px] leading-snug text-slate-500">Pasá el mouse por un ícono para ver el movimiento · ↑↓ y Enter</p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default AnimPicker;