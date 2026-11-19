'use client';
import React, { useEffect, useRef, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   CLIPEDIA · SFX desde Cloudflare R2
   ⚠️ ÚNICA LÍNEA A AJUSTAR si tu dominio/bucket tiene otro nombre.
   El manifest lo genera scripts/publish-sfx-r2.mjs en <base>/sfx/manifest.json
   ═══════════════════════════════════════════════════════════════ */
export const SFX_CDN_BASE = 'https://sfx.clipedia.net';
const MANIFEST_URL = SFX_CDN_BASE.replace(/\/+$/, '') + '/sfx/manifest.json';

export type SfxDef = { id: string; name: string; cat: string; dur: number; url: string; bytes?: number };
export const EMPTY_SFX: SfxDef = { id: '', name: 'Cargando biblioteca…', cat: '', dur: 0, url: '' };

const SR = 44100;
const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const cx = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(' ');

/* ─────────── manifest (una sola descarga por sesión) ─────────── */
let cache: { items: SfxDef[]; cats: string[] } | null = null;
let pending: Promise<{ items: SfxDef[]; cats: string[] }> | null = null;

export function loadSfxManifest(): Promise<{ items: SfxDef[]; cats: string[] }> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' al leer el manifest');
        return r.json();
      })
      .then((j) => {
        const items: SfxDef[] = Array.isArray(j?.items) ? j.items.filter((x: SfxDef) => x && x.id && x.url) : [];
        if (!items.length) throw new Error('El manifest no contiene sonidos');
        const cats: string[] = Array.isArray(j?.cats) && j.cats.length
          ? j.cats
          : [...new Set(items.map((i) => i.cat))].sort((a, b) => a.localeCompare(b));
        cache = { items, cats };
        return cache;
      })
      .catch((e) => { pending = null; throw e; });
  }
  return pending;
}

export function useSfxLibrary() {
  const [items, setItems] = useState<SfxDef[]>(cache?.items || []);
  const [cats, setCats] = useState<string[]>(cache?.cats || []);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    loadSfxManifest()
      .then((m) => { if (!dead) { setItems(m.items); setCats(m.cats); setLoading(false); } })
      .catch((e) => { if (!dead) { setError(String(e?.message || e)); setLoading(false); } });
    return () => { dead = true; };
  }, []);
  const retry = () => {
    cache = null; pending = null; setLoading(true); setError(null);
    loadSfxManifest()
      .then((m) => { setItems(m.items); setCats(m.cats); setLoading(false); })
      .catch((e) => { setError(String(e?.message || e)); setLoading(false); });
  };
  return { items, cats, loading, error, retry, manifestUrl: MANIFEST_URL };
}

/* ─────────── audio compartido + cachés ─────────── */
let sharedCtx: AudioContext | null = null;
function ac(): AudioContext {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return sharedCtx;
}
const peakCache = new Map<string, number[]>();
const durCache = new Map<string, number>();
const peakJobs = new Map<string, Promise<number[]>>();
const bytesCache = new Map<string, ArrayBuffer>();

export function sfxDuration(def: SfxDef): number {
  return durCache.get(def.id) || def.dur || 0;
}

async function fileBytes(def: SfxDef): Promise<ArrayBuffer> {
  const hit = bytesCache.get(def.id);
  if (hit) return hit;
  const res = await fetch(def.url);
  if (!res.ok) throw new Error('No se pudo leer "' + def.name + '" (HTTP ' + res.status + ')');
  const ab = await res.arrayBuffer();
  if (bytesCache.size >= 24) {
    const oldest = bytesCache.keys().next().value as string;
    bytesCache.delete(oldest);
  }
  bytesCache.set(def.id, ab);
  return ab;
}

function placeholderBars(seed: string, bars: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const r = ((h >>> 8) & 0xffff) / 65535;
    const env = Math.sin((i / Math.max(1, bars - 1)) * Math.PI);
    out.push(clamp(0.16 + r * 0.55 * (0.3 + env), 0.1, 1));
  }
  return out;
}

async function peaksFor(def: SfxDef, bars: number): Promise<number[]> {
  const key = def.id + ':' + bars;
  const hit = peakCache.get(key);
  if (hit) return hit;
  const job = peakJobs.get(key);
  if (job) return job;
  const p = (async () => {
    const ab = await fileBytes(def);
    const buf = await ac().decodeAudioData(ab.slice(0));
    durCache.set(def.id, buf.duration);
    const d = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(d.length / bars));
    const raw: number[] = [];
    let max = 0.01;
    for (let i = 0; i < bars; i++) {
      let m = 0;
      const a = i * step, b = Math.min(d.length, a + step);
      for (let j = a; j < b; j++) { const v = Math.abs(d[j] || 0); if (v > m) m = v; }
      raw.push(m); if (m > max) max = m;
    }
    const norm = raw.map((v) => clamp(v / max, 0.1, 1));
    peakCache.set(key, norm);
    peakJobs.delete(key);
    return norm;
  })().catch(() => { peakJobs.delete(key); return placeholderBars(def.id, bars); });
  peakJobs.set(key, p);
  return p;
}

/* ─────────── onda de la tarjeta: solo se calcula si entra en pantalla ─────────── */
export function SfxWaveform({ def, active, playing, barsCount = 26, tall = false }: {
  def: SfxDef; active: boolean; playing: boolean; barsCount?: number; tall?: boolean;
}) {
  const key = def.id + ':' + barsCount;
  const [bars, setBars] = useState<number[]>(() => peakCache.get(key) || placeholderBars(def.id, barsCount));
  const [real, setReal] = useState(!!peakCache.get(key));
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = peakCache.get(key);
    if (cached) { setBars(cached); setReal(true); return; }
    setBars(placeholderBars(def.id, barsCount));
    setReal(false);
    const el = boxRef.current;
    if (!el || !def.url) return;
    let dead = false;
    let io: IntersectionObserver | null = null;
    const load = () => { void peaksFor(def, barsCount).then((p) => { if (!dead) { setBars(p); setReal(true); } }); };
    if (typeof IntersectionObserver === 'undefined') load();
    else {
      io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io?.disconnect(); io = null; load(); }
      }, { rootMargin: '240px' });
      io.observe(el);
    }
    return () => { dead = true; io?.disconnect(); };
  }, [key, def, barsCount]);

  const maxH = tall ? 46 : 28;
  return (
    <div ref={boxRef} className={cx('flex items-center justify-center gap-[3px]', tall ? 'h-12' : 'h-8')} aria-hidden="true">
      {bars.map((v, i) => (
        <span
          key={i}
          className={cx(
            'w-[3px] rounded-full transition-all duration-150',
            playing
              ? 'animate-pulse bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.8)]'
              : active
                ? 'bg-gradient-to-t from-fuchsia-400 to-cyan-300'
                : 'bg-slate-600/80 group-hover:bg-cyan-400/70',
            !real && 'opacity-40'
          )}
          style={{ height: Math.max(4, Math.round(v * maxH)) + 'px', animationDelay: (i * 22) + 'ms' }}
        />
      ))}
    </div>
  );
}

/* ─────────── WAV PCM16 (solo cuando hay tono/ganancia aplicada) ─────────── */
function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels, len = buf.length;
  const ab = new ArrayBuffer(44 + len * ch * 2);
  const dv = new DataView(ab);
  const s = (o: number, t: string) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
  s(0, 'RIFF'); dv.setUint32(4, 36 + len * ch * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true);
  dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); s(36, 'data'); dv.setUint32(40, len * ch * 2, true);
  const cs: Float32Array[] = []; for (let c = 0; c < ch; c++) cs.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const v = clamp(cs[c][i], -1, 1);
    dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/** Reproduce el archivo real con tono y volumen en vivo. Devuelve el nodo para poder cortarlo. */
export async function playSfxFile(def: SfxDef, tune: number, gain: number): Promise<AudioBufferSourceNode> {
  if (!def.url) throw new Error('Elegí un sonido primero');
  const ctx = ac();
  if (ctx.state === 'suspended') await ctx.resume();
  const ab = await fileBytes(def);
  const buf = await ctx.decodeAudioData(ab.slice(0));
  durCache.set(def.id, buf.duration);
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.playbackRate.value = Math.pow(2, tune / 12);
  const g = ctx.createGain();
  g.gain.value = clamp(gain, 0, 1.5);
  node.connect(g).connect(ctx.destination);
  node.start();
  return node;
}

/** Para la timeline: sin tono ni ganancia entrega el MP3 ORIGINAL intacto (cero recompresión). */
export async function renderSfxFile(def: SfxDef, tune: number, gain: number): Promise<{ blob: Blob; duration: number }> {
  if (!def.url) throw new Error('Elegí un sonido primero');
  const ab = await fileBytes(def);
  if (tune === 0 && Math.abs(gain - 1) < 0.001) {
    let d = durCache.get(def.id);
    if (!d) { d = (await ac().decodeAudioData(ab.slice(0))).duration; durCache.set(def.id, d); }
    return { blob: new Blob([ab], { type: 'audio/mpeg' }), duration: d };
  }
  const src = await ac().decodeAudioData(ab.slice(0));
  durCache.set(def.id, src.duration);
  const rate = Math.pow(2, tune / 12);
  const oc = new OfflineAudioContext(2, Math.max(1, Math.ceil(src.length / rate)), SR);
  const node = oc.createBufferSource();
  node.buffer = src;
  node.playbackRate.value = rate;
  const g = oc.createGain();
  g.gain.value = clamp(gain, 0, 1.5);
  node.connect(g).connect(oc.destination);
  node.start(0);
  const out = await oc.startRendering();
  return { blob: encodeWav(out), duration: out.duration };
}