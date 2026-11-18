'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const SR = 44100;
const FPS = 25;
const HD_SCALE = 2.5; // Exporta los spritesheets a 2.5x para nitidez total en 1080p/4K

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const cx = (...p: (string | false | null | undefined)[]) => p.filter(Boolean).join(' ');
const ease = (p: number) => p * p * (3 - 2 * p);
const out = (p: number) => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
const back = (p: number) => {
  const c = 1.70158;
  const t = clamp(p, 0, 1) - 1;
  return 1 + (c + 1) * t * t * t + c * t * t;
};
const elastic = (p: number) => {
  const t = clamp(p, 0, 1);
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

function shadeHex(hex: string, amt: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const num = parseInt(clean, 16);
  const r = clamp(((num >> 16) & 0xff) + amt, 0, 255);
  const g = clamp(((num >> 8) & 0xff) + amt, 0, 255);
  const b = clamp((num & 0xff) + amt, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function gradFill(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, hex: string) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, shadeHex(hex, 38));
  g.addColorStop(0.55, hex);
  g.addColorStop(1, shadeHex(hex, -32));
  return g;
}

const FONT_STACK = 'system-ui, -apple-system, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

function setFittedFont(c: CanvasRenderingContext2D, text: string, maxWidth: number, baseSize: number, weight = 900) {
  let sz = baseSize;
  c.font = `${weight} ${sz}px ${FONT_STACK}`;
  const measured = c.measureText(text).width;
  if (measured > maxWidth && measured > 0) {
    sz = Math.max(11, Math.floor(baseSize * (maxWidth / measured)));
    c.font = `${weight} ${sz}px ${FONT_STACK}`;
  }
}

/* ============================================================================
   MOTOR DE AUDIO DSP (COMPRESIÓN, REVERB ESTÉREO, PANEO Y SÍNTESIS MULTI-CAPA)
============================================================================ */

function encodeWav(buf: AudioBuffer): Blob {
  const ch = buf.numberOfChannels;
  const len = buf.length;
  const ab = new ArrayBuffer(44 + len * ch * 2);
  const dv = new DataView(ab);
  const s = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i));
  };
  s(0, 'RIFF');
  dv.setUint32(4, 36 + len * ch * 2, true);
  s(8, 'WAVE');
  s(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, ch, true);
  dv.setUint32(24, buf.sampleRate, true);
  dv.setUint32(28, buf.sampleRate * ch * 2, true);
  dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true);
  s(36, 'data');
  dv.setUint32(40, len * ch * 2, true);
  const cs: Float32Array[] = [];
  for (let c = 0; c < ch; c++) cs.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const v = clamp(cs[c][i], -1, 1);
      dv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function createImpulse(ctx: BaseAudioContext, dur = 0.24, decay = 3.0): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    let seed = 1337 + ch * 7919;
    for (let i = 0; i < len; i++) {
      seed = (seed * 16807) % 2147483647;
      const white = seed / 1073741823 - 1;
      data[i] = white * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function connectMaster(ctx: BaseAudioContext, input: AudioNode, dest: AudioNode, wet = 0.16) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -13;
  comp.knee.value = 10;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.12;

  if (wet <= 0.001) {
    input.connect(comp).connect(dest);
    return;
  }

  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - wet * 0.45;
  const wetGain = ctx.createGain();
  wetGain.gain.value = wet;
  const conv = ctx.createConvolver();
  conv.buffer = createImpulse(ctx, 0.25, 3.1);

  input.connect(dryGain).connect(comp);
  input.connect(conv).connect(wetGain).connect(comp);
  comp.connect(dest);
}

function panSweep(ctx: BaseAudioContext, dest: AudioNode, pan0: number, pan1: number, dur: number): AudioNode {
  if (typeof ctx.createStereoPanner !== 'function') return dest;
  const p = ctx.createStereoPanner();
  p.pan.setValueAtTime(clamp(pan0, -1, 1), 0);
  p.pan.linearRampToValueAtTime(clamp(pan1, -1, 1), dur);
  p.connect(dest);
  return p;
}

function noise(ctx: BaseAudioContext, d: number, seed = 7) {
  const b = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * d)), ctx.sampleRate);
  const a = b.getChannelData(0);
  let s = seed;
  for (let i = 0; i < a.length; i++) {
    s = (s * 16807) % 2147483647;
    a[i] = s / 1073741823 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = b;
  return src;
}

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  f0: number,
  f1: number,
  d: number,
  g0: number,
  type: OscillatorType = 'sine',
  pm = 1
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, f0 * pm), t);
  if (f1 !== f0) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * pm), t + d * 0.92);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(g0, t + Math.min(0.01, d * 0.14));
  g.gain.exponentialRampToValueAtTime(0.0005, t + d);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + d + 0.02);
}

export type SfxDef = {
  id: string;
  name: string;
  cat: string;
  dur: number;
  wet?: number;
  build: (oc: OfflineAudioContext, d: AudioNode, pm?: number) => void;
};

export const SFX: SfxDef[] = [
  /* --- TIKTOK & VIRAL --- */
  {
    id: 'tt-pop',
    name: 'Pop Burbuja (Tap)',
    cat: 'TikTok & Viral',
    dur: 0.22,
    wet: 0.14,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 520, 1480, 0.11, 0.48, 'sine', pm);
      tone(o, d, 0.02, 1040, 2100, 0.08, 0.22, 'triangle', pm);
      const n = noise(o, 0.025, 19);
      const bp = o.createBiquadFilter();
      const g = o.createGain();
      bp.type = 'bandpass';
      bp.frequency.value = 3200 * pm;
      g.gain.setValueAtTime(0.25, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.024);
      n.connect(bp).connect(g).connect(d);
      n.start(0);
      n.stop(0.025);
    },
  },
  {
    id: 'tt-doubletap',
    name: 'Doble Tap Like',
    cat: 'TikTok & Viral',
    dur: 0.36,
    wet: 0.2,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 740, 1480, 0.12, 0.4, 'sine', pm);
      tone(o, d, 0.09, 987, 1975, 0.22, 0.44, 'sine', pm);
      tone(o, d, 0.09, 1480, 2960, 0.18, 0.16, 'triangle', pm);
    },
  },
  {
    id: 'tt-sparkle',
    name: 'Brillo / Magia',
    cat: 'TikTok & Viral',
    dur: 0.95,
    wet: 0.34,
    build: (o, d, pm = 1) => {
      const notes = [1318, 1568, 1975, 2349, 2637, 3136, 3951];
      notes.forEach((f, i) => {
        const pan = panSweep(o, d, -0.5 + i / notes.length, 0.5 - i / notes.length, 0.9);
        tone(o, pan, i * 0.055, f, f * 1.015, 0.45, 0.22 - i * 0.015, 'sine', pm);
      });
    },
  },
  {
    id: 'tt-camera',
    name: 'Flash Cámara',
    cat: 'TikTok & Viral',
    dur: 0.32,
    wet: 0.18,
    build: (o, d, pm = 1) => {
      const n1 = noise(o, 0.04, 101);
      const hp = o.createBiquadFilter();
      const g1 = o.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 2400;
      g1.gain.setValueAtTime(0.55, 0);
      g1.gain.exponentialRampToValueAtTime(0.001, 0.038);
      n1.connect(hp).connect(g1).connect(d);
      n1.start(0);
      n1.stop(0.04);

      const n2 = noise(o, 0.05, 202);
      const bp = o.createBiquadFilter();
      const g2 = o.createGain();
      bp.type = 'bandpass';
      bp.frequency.value = 4200;
      g2.gain.setValueAtTime(0.45, 0.055);
      g2.gain.exponentialRampToValueAtTime(0.001, 0.1);
      n2.connect(bp).connect(g2).connect(d);
      n2.start(0.055);
      n2.stop(0.105);

      tone(o, d, 0.06, 3600, 3200, 0.24, 0.12, 'sine', pm);
    },
  },
  {
    id: 'tt-ding-hook',
    name: 'Gancho Atención',
    cat: 'TikTok & Viral',
    dur: 0.72,
    wet: 0.25,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 1568, 1568, 0.65, 0.36, 'sine', pm);
      tone(o, d, 0, 3136, 3136, 0.38, 0.15, 'sine', pm);
      tone(o, d, 0.03, 2349, 2349, 0.5, 0.14, 'triangle', pm);
    },
  },

  /* --- TRANSICIONES --- */
  {
    id: 'whoosh',
    name: 'Whoosh Aéreo',
    cat: 'Transiciones',
    dur: 0.75,
    wet: 0.22,
    build: (o, d, pm = 1) => {
      const pan = panSweep(o, d, -0.7, 0.7, 0.75);
      const n = noise(o, 0.75, 11);
      const bp = o.createBiquadFilter();
      const g = o.createGain();
      bp.type = 'bandpass';
      bp.Q.value = 1.6;
      bp.frequency.setValueAtTime(280 * pm, 0);
      bp.frequency.exponentialRampToValueAtTime(4800 * pm, 0.38);
      bp.frequency.exponentialRampToValueAtTime(360 * pm, 0.74);
      g.gain.setValueAtTime(0.001, 0);
      g.gain.linearRampToValueAtTime(0.58, 0.32);
      g.gain.exponentialRampToValueAtTime(0.001, 0.74);
      n.connect(bp).connect(g).connect(pan);
      n.start(0);
      n.stop(0.75);
      tone(o, pan, 0.12, 110, 48, 0.45, 0.22, 'sine', pm);
    },
  },
  {
    id: 'swipe',
    name: 'Swipe Rápido',
    cat: 'Transiciones',
    dur: 0.38,
    wet: 0.15,
    build: (o, d, pm = 1) => {
      const pan = panSweep(o, d, 0.65, -0.65, 0.38);
      const n = noise(o, 0.38, 23);
      const hp = o.createBiquadFilter();
      const g = o.createGain();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(850 * pm, 0);
      hp.frequency.exponentialRampToValueAtTime(6800 * pm, 0.36);
      g.gain.setValueAtTime(0.48, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.37);
      n.connect(hp).connect(g).connect(pan);
      n.start(0);
      n.stop(0.38);
    },
  },
  {
    id: 'sweep',
    name: 'Sweep Cinemático',
    cat: 'Transiciones',
    dur: 1.4,
    wet: 0.28,
    build: (o, d, pm = 1) => {
      const n = noise(o, 1.4, 31);
      const bp = o.createBiquadFilter();
      const g = o.createGain();
      bp.type = 'bandpass';
      bp.Q.value = 3.8;
      bp.frequency.setValueAtTime(6500 * pm, 0);
      bp.frequency.exponentialRampToValueAtTime(160 * pm, 1.32);
      g.gain.setValueAtTime(0.45, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 1.38);
      n.connect(bp).connect(g).connect(d);
      n.start(0);
      n.stop(1.4);
      tone(o, d, 0, 140, 38, 1.35, 0.28, 'sine', pm);
    },
  },
  {
    id: 'riser',
    name: 'Riser Tensión',
    cat: 'Transiciones',
    dur: 2.1,
    wet: 0.25,
    build: (o, d, pm = 1) => {
      const n = noise(o, 2.1, 41);
      const bp = o.createBiquadFilter();
      const g = o.createGain();
      bp.type = 'bandpass';
      bp.Q.value = 3.2;
      bp.frequency.setValueAtTime(220 * pm, 0);
      bp.frequency.exponentialRampToValueAtTime(9200 * pm, 1.98);
      g.gain.setValueAtTime(0.02, 0);
      g.gain.linearRampToValueAtTime(0.5, 1.95);
      g.gain.exponentialRampToValueAtTime(0.001, 2.08);
      n.connect(bp).connect(g).connect(d);
      n.start(0);
      n.stop(2.1);
      tone(o, d, 0, 110, 440, 2.0, 0.18, 'sawtooth', pm);
    },
  },

  /* --- INTERFAZ --- */
  {
    id: 'ping',
    name: 'Ping Cristal',
    cat: 'Interfaz',
    dur: 0.6,
    wet: 0.24,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 1760, 1760, 0.56, 0.36, 'sine', pm);
      tone(o, d, 0, 2640, 2640, 0.34, 0.15, 'sine', pm);
    },
  },
  {
    id: 'click',
    name: 'Click Mecánico',
    cat: 'Interfaz',
    dur: 0.1,
    wet: 0.08,
    build: (o, d, pm = 1) => {
      const n = noise(o, 0.04, 61);
      const hp = o.createBiquadFilter();
      const g = o.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      g.gain.setValueAtTime(0.46, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.04);
      n.connect(hp).connect(g).connect(d);
      n.start(0);
      n.stop(0.045);
      tone(o, d, 0, 1500, 820, 0.055, 0.2, 'triangle', pm);
    },
  },
  {
    id: 'tick',
    name: 'Tick Reloj',
    cat: 'Interfaz',
    dur: 0.08,
    wet: 0.06,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 2500, 1750, 0.048, 0.34, 'triangle', pm);
    },
  },

  /* --- NOTIFICACIONES --- */
  {
    id: 'ding',
    name: 'Ding Campana',
    cat: 'Notificaciones',
    dur: 1.45,
    wet: 0.28,
    build: (o, d, pm = 1) => {
      [1046.5, 1568, 2093, 3136].forEach((f, i) =>
        tone(o, d, 0, f, f, 1.4 - i * 0.28, 0.28 - i * 0.055, 'sine', pm)
      );
    },
  },
  {
    id: 'notify',
    name: 'Notificación App',
    cat: 'Notificaciones',
    dur: 0.68,
    wet: 0.2,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 880, 880, 0.22, 0.34, 'sine', pm);
      tone(o, d, 0.12, 1318.5, 1318.5, 0.46, 0.32, 'sine', pm);
    },
  },
  {
    id: 'success',
    name: 'Éxito / Nivel',
    cat: 'Notificaciones',
    dur: 0.95,
    wet: 0.24,
    build: (o, d, pm = 1) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(o, d, i * 0.08, f, f, 0.58, 0.26, 'triangle', pm)
      );
    },
  },
  {
    id: 'coin',
    name: 'Moneda Retro',
    cat: 'Notificaciones',
    dur: 0.55,
    wet: 0.12,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 987.77, 987.77, 0.085, 0.28, 'square', pm);
      tone(o, d, 0.08, 1318.5, 1318.5, 0.44, 0.26, 'square', pm);
    },
  },

  /* --- IMPACTOS --- */
  {
    id: 'boom',
    name: 'Impacto Sub 808',
    cat: 'Impactos',
    dur: 1.75,
    wet: 0.24,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 165, 34, 1.55, 0.85, 'sine', pm);
      tone(o, d, 0, 95, 28, 1.1, 0.35, 'triangle', pm);
      const n = noise(o, 0.85, 71);
      const lp = o.createBiquadFilter();
      const g = o.createGain();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, 0);
      lp.frequency.exponentialRampToValueAtTime(160, 0.8);
      g.gain.setValueAtTime(0.45, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.84);
      n.connect(lp).connect(g).connect(d);
      n.start(0);
      n.stop(0.85);
    },
  },
  {
    id: 'hit',
    name: 'Golpe Punch',
    cat: 'Impactos',
    dur: 0.48,
    wet: 0.16,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 280, 62, 0.34, 0.68, 'sine', pm);
      const n = noise(o, 0.14, 83);
      const bp = o.createBiquadFilter();
      const g = o.createGain();
      bp.type = 'bandpass';
      bp.frequency.value = 1750;
      g.gain.setValueAtTime(0.4, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.13);
      n.connect(bp).connect(g).connect(d);
      n.start(0);
      n.stop(0.14);
    },
  },
  {
    id: 'glitch',
    name: 'Glitch Digital',
    cat: 'Impactos',
    dur: 0.65,
    wet: 0.14,
    build: (o, d, pm = 1) => {
      for (let i = 0; i < 11; i++) {
        const t = i * 0.055;
        const n = noise(o, 0.05, 97 + i * 13);
        const bp = o.createBiquadFilter();
        const g = o.createGain();
        bp.type = 'bandpass';
        bp.frequency.value = (420 + ((i * 911) % 5600)) * pm;
        bp.Q.value = 8;
        g.gain.setValueAtTime(0.38, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        n.connect(bp).connect(g).connect(d);
        n.start(t);
        n.stop(t + 0.055);
      }
    },
  },

  /* --- COMEDIA & REACCIÓN --- */
  {
    id: 'boing',
    name: 'Boing Rebote',
    cat: 'Comedia',
    dur: 0.62,
    wet: 0.16,
    build: (o, d, pm = 1) => {
      const osc = o.createOscillator();
      const g = o.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(190 * pm, 0);
      osc.frequency.exponentialRampToValueAtTime(580 * pm, 0.14);
      osc.frequency.exponentialRampToValueAtTime(260 * pm, 0.28);
      osc.frequency.exponentialRampToValueAtTime(490 * pm, 0.42);
      osc.frequency.exponentialRampToValueAtTime(340 * pm, 0.58);
      g.gain.setValueAtTime(0.45, 0);
      g.gain.exponentialRampToValueAtTime(0.001, 0.6);
      osc.connect(g).connect(d);
      osc.start(0);
      osc.stop(0.62);
    },
  },
  {
    id: 'bruh-down',
    name: 'Bajón Cómico',
    cat: 'Comedia',
    dur: 0.85,
    wet: 0.18,
    build: (o, d, pm = 1) => {
      const lp = o.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1100 * pm, 0);
      lp.frequency.exponentialRampToValueAtTime(240 * pm, 0.8);
      lp.connect(d);
      tone(o, lp, 0, 196, 92, 0.82, 0.38, 'sawtooth', pm);
      tone(o, lp, 0, 146.8, 69, 0.82, 0.32, 'sawtooth', pm);
    },
  },
  {
    id: 'error',
    name: 'Buzzer Error',
    cat: 'Comedia',
    dur: 0.52,
    wet: 0.12,
    build: (o, d, pm = 1) => {
      tone(o, d, 0, 210, 155, 0.46, 0.32, 'sawtooth', pm);
      tone(o, d, 0.01, 148, 110, 0.46, 0.28, 'square', pm);
    },
  },
];

export const SFX_CATS = ['TikTok & Viral', 'Transiciones', 'Interfaz', 'Notificaciones', 'Impactos', 'Comedia'];

/* ============================================================================
   STICKERS ANIMADOS HD (TIKTOK, YOUTUBE, REDES, UI)
============================================================================ */

export type StickerDef = {
  id: string;
  name: string;
  cat: string;
  fw: number;
  fh: number;
  frames: number;
  loop: boolean;
  defaultText?: string;
  defaultText2?: string;
  textLabel1?: string;
  textLabel2?: string;
  draw: (
    c: CanvasRenderingContext2D,
    p: number,
    accent: string,
    w: number,
    h: number,
    text?: string,
    text2?: string
  ) => void;
};

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function star(c: CanvasRenderingContext2D, cx0: number, cy0: number, r: number) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr0 = i % 2 ? r * 0.45 : r;
    c.lineTo(cx0 + Math.cos(a) * rr0, cy0 + Math.sin(a) * rr0);
  }
  c.closePath();
}

function heartPath(c: CanvasRenderingContext2D, s: number) {
  c.beginPath();
  c.moveTo(0, s * 0.85);
  c.bezierCurveTo(-s * 1.35, s * 0.05, -s * 0.98, -s * 0.92, -s * 0.4, -s * 0.74);
  c.bezierCurveTo(-s * 0.12, -s * 0.65, 0, -s * 0.4, 0, -s * 0.28);
  c.bezierCurveTo(0, -s * 0.4, s * 0.12, -s * 0.65, s * 0.4, -s * 0.74);
  c.bezierCurveTo(s * 0.98, -s * 0.92, s * 1.35, s * 0.05, 0, s * 0.85);
  c.closePath();
}

function drawGlossyHeart(c: CanvasRenderingContext2D, s: number, color: string) {
  c.fillStyle = gradFill(c, 0, -s, 0, s, color);
  heartPath(c, s);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = Math.max(1.5, s * 0.06);
  c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.42)';
  c.beginPath();
  c.ellipse(-s * 0.42, -s * 0.34, s * 0.22, s * 0.13, -0.55, 0, Math.PI * 2);
  c.fill();
}

export const STICKERS: StickerDef[] = [
  /* --- TIKTOK & VIRAL --- */
  {
    id: 'tiktok-hearts',
    name: 'Lluvia Corazones',
    cat: 'TikTok',
    fw: 180,
    fh: 260,
    frames: 60,
    loop: true,
    draw: (c, p, a, w, h) => {
      const palette = [a, '#ff2a6d', '#ff758f', '#22d3ee', '#f43f5e', '#fb7185', '#c084fc'];
      const count = 9;
      for (let i = 0; i < count; i++) {
        const localT = (p + i / count) % 1;
        const pop = back(clamp(localT / 0.14, 0, 1));
        const fade = localT > 0.72 ? clamp(1 - (localT - 0.72) / 0.28, 0, 1) : 1;
        const sway = Math.sin(localT * Math.PI * 3.2 + i * 1.9) * (16 + (i % 3) * 7);
        const x = w * 0.52 + sway + ((i % 3) - 1) * 14;
        const y = h - 26 - ease(localT) * (h - 56);
        const tilt = Math.sin(localT * Math.PI * 2.5 + i) * 0.28;
        const size = (13 + (i % 4) * 3.5) * pop;
        const col = palette[i % palette.length];

        c.save();
        c.globalAlpha = fade;
        c.translate(x, y);
        c.rotate(tilt);
        c.shadowColor = col;
        c.shadowBlur = 12;
        drawGlossyHeart(c, size, col);
        c.restore();
      }
    },
  },
  {
    id: 'double-tap',
    name: 'Doble Tap ❤️',
    cat: 'TikTok',
    fw: 200,
    fh: 200,
    frames: 45,
    loop: false,
    draw: (c, p, a, w, h) => {
      const s = elastic(clamp(p / 0.42, 0, 1));
      const fadeOut = p > 0.76 ? clamp(1 - (p - 0.76) / 0.24, 0, 1) : 1;
      const tilt = Math.sin(clamp(p / 0.35, 0, 1) * Math.PI) * -0.18;

      c.save();
      c.globalAlpha = fadeOut;
      c.translate(w / 2, h / 2);

      if (p > 0.08 && p < 0.75) {
        const rp = (p - 0.08) / 0.67;
        c.strokeStyle = a;
        c.globalAlpha = fadeOut * (1 - rp) * 0.7;
        c.lineWidth = 4 * (1 - rp) + 1;
        c.beginPath();
        c.arc(0, 0, 26 + rp * 58, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = fadeOut;
      }

      if (p > 0.12) {
        const bp = clamp((p - 0.12) / 0.55, 0, 1);
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + 0.2;
          const dist = 36 + out(bp) * 48;
          c.fillStyle = i % 2 === 0 ? '#fff' : a;
          c.globalAlpha = fadeOut * (1 - bp);
          c.beginPath();
          c.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, 4.5 * (1 - bp) + 1, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = fadeOut;
      }

      c.rotate(tilt);
      c.scale(s, s);
      c.shadowColor = a;
      c.shadowBlur = 24;
      drawGlossyHeart(c, 42, a);
      c.restore();
    },
  },
  {
    id: 'tiktok-follow',
    name: '¡Sígueme! +',
    cat: 'TikTok',
    fw: 290,
    fh: 96,
    frames: 50,
    loop: false,
    defaultText: 'SÍGUEME',
    defaultText2: 'SIGUIENDO',
    textLabel1: 'Texto inicial',
    textLabel2: 'Texto al tocar',
    draw: (c, p, a, w, h, text, text2) => {
      const label1 = (text !== undefined ? text : 'SÍGUEME').trim().toUpperCase();
      const label2 = (text2 !== undefined ? text2 : 'SIGUIENDO').trim().toUpperCase();
      const app = back(clamp(p / 0.24, 0, 1));
      const clicked = p > 0.52;
      const cp = clamp((p - 0.52) / 0.2, 0, 1);
      const pulse = clicked ? 1 - 0.07 * Math.sin(cp * Math.PI) : 1;

      c.save();
      c.translate(w / 2, h / 2);
      c.scale(app * pulse, app * pulse);

      const bw = 246;
      const bh = 58;
      c.shadowColor = 'rgba(0,0,0,0.45)';
      c.shadowBlur = 14;
      c.shadowOffsetY = 4;
      c.fillStyle = clicked ? '#18181b' : gradFill(c, 0, -bh / 2, 0, bh / 2, a);
      rr(c, -bw / 2, -bh / 2, bw, bh, 29);
      c.fill();
      c.shadowColor = 'transparent';

      c.strokeStyle = clicked ? a : 'rgba(255,255,255,0.4)';
      c.lineWidth = 2.5;
      rr(c, -bw / 2, -bh / 2, bw, bh, 29);
      c.stroke();

      const ix = -bw / 2 + 30;
      c.fillStyle = clicked ? a : '#fff';
      c.beginPath();
      c.arc(ix, 0, 16, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = clicked ? '#fff' : a;
      c.lineWidth = 3.2;
      c.lineCap = 'round';
      c.beginPath();
      if (!clicked) {
        c.moveTo(ix - 7, 0);
        c.lineTo(ix + 7, 0);
        c.moveTo(ix, -7);
        c.lineTo(ix, 7);
      } else {
        const k = out(cp);
        c.moveTo(ix - 7, 0);
        c.lineTo(ix - 2, 5 * k);
        c.lineTo(ix + 8, -6 * k);
      }
      c.stroke();

      const currentLabel = clicked ? label2 : label1;
      c.fillStyle = '#fff';
      setFittedFont(c, currentLabel, bw - 74, 20, 900);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(currentLabel, 16, 1);
      c.restore();
    },
  },
  {
    id: 'point-down',
    name: 'Mira abajo 👇',
    cat: 'TikTok',
    fw: 160,
    fh: 180,
    frames: 50,
    loop: true,
    draw: (c, p, a, w, h) => {
      const bounce = Math.sin(p * Math.PI * 2) * 10;
      c.save();
      c.translate(w / 2, h / 2 + bounce);
      c.shadowColor = a;
      c.shadowBlur = 18;

      for (let i = 0; i < 3; i++) {
        const wave = 0.35 + 0.65 * Math.max(0, Math.sin((p * 2 - i * 0.22) * Math.PI));
        c.strokeStyle = i === 2 ? '#fff' : a;
        c.globalAlpha = wave;
        c.lineWidth = 8;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        const yOff = -36 + i * 28;
        c.beginPath();
        c.moveTo(-34, yOff);
        c.lineTo(0, yOff + 24);
        c.lineTo(34, yOff);
        c.stroke();
      }
      c.restore();
    },
  },
  {
    id: 'fire-streak',
    name: 'Fuego Viral 🔥',
    cat: 'TikTok',
    fw: 180,
    fh: 200,
    frames: 50,
    loop: true,
    draw: (c, p, a, w, h) => {
      const flick1 = Math.sin(p * Math.PI * 4) * 6;
      const flick2 = Math.cos(p * Math.PI * 6) * 5;
      c.save();
      c.translate(w / 2, h / 2 + 24);

      for (let i = 0; i < 5; i++) {
        const ep = (p + i * 0.2) % 1;
        c.fillStyle = i % 2 === 0 ? '#fde047' : a;
        c.globalAlpha = 1 - ep;
        c.beginPath();
        c.arc(Math.sin(ep * 6 + i) * 24, -40 - ep * 65, 3.5 * (1 - ep), 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;

      c.shadowColor = a;
      c.shadowBlur = 24;
      c.fillStyle = gradFill(c, 0, -90, 0, 35, a);
      c.beginPath();
      c.moveTo(0, 36);
      c.bezierCurveTo(-52, 32, -52, -25, -18, -56);
      c.quadraticCurveTo(-8, -74, flick1, -92);
      c.quadraticCurveTo(18, -68, 22, -46);
      c.bezierCurveTo(54, -18, 48, 32, 0, 36);
      c.closePath();
      c.fill();

      c.shadowBlur = 0;
      c.fillStyle = '#fb923c';
      c.beginPath();
      c.moveTo(0, 30);
      c.bezierCurveTo(-32, 26, -30, -12, -8, -36);
      c.quadraticCurveTo(0, -52, flick2, -62);
      c.quadraticCurveTo(14, -42, 16, -26);
      c.bezierCurveTo(32, -8, 28, 26, 0, 30);
      c.closePath();
      c.fill();

      c.fillStyle = '#fef08a';
      c.beginPath();
      c.moveTo(0, 24);
      c.bezierCurveTo(-16, 20, -14, -4, -2, -24);
      c.quadraticCurveTo(4, -32, 8, -16);
      c.bezierCurveTo(16, 0, 14, 20, 0, 24);
      c.closePath();
      c.fill();
      c.restore();
    },
  },
  {
    id: 'pov-badge',
    name: 'Etiqueta POV',
    cat: 'TikTok',
    fw: 320,
    fh: 94,
    frames: 45,
    loop: false,
    defaultText: 'POV: ES REAL',
    textLabel1: 'Texto de etiqueta',
    draw: (c, p, a, w, h, text) => {
      const label = (text !== undefined ? text : 'POV: ES REAL').trim();
      const s = back(clamp(p / 0.25, 0, 1));
      c.save();
      c.translate(w / 2, h / 2);
      c.scale(s, s);

      const bw = 286;
      const bh = 58;
      c.shadowColor = 'rgba(0,0,0,0.48)';
      c.shadowBlur = 16;
      c.shadowOffsetY = 5;
      c.fillStyle = '#ffffff';
      rr(c, -bw / 2, -bh / 2, bw, bh, 14);
      c.fill();
      c.shadowColor = 'transparent';

      c.fillStyle = a;
      rr(c, -bw / 2 + 8, -bh / 2 + 10, 7, bh - 20, 4);
      c.fill();

      c.fillStyle = '#090d16';
      setFittedFont(c, label, bw - 38, 22, 900);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, 6, 1);
      c.restore();
    },
  },
  {
    id: 'poll-box',
    name: 'Caja Pregunta',
    cat: 'TikTok',
    fw: 300,
    fh: 126,
    frames: 50,
    loop: false,
    defaultText: 'PREGUNTA RÁPIDA',
    defaultText2: '¿QUÉ OPINAS? 👇',
    textLabel1: 'Encabezado',
    textLabel2: 'Pregunta',
    draw: (c, p, a, w, h, text, text2) => {
      const header = (text !== undefined ? text : 'PREGUNTA RÁPIDA').trim().toUpperCase();
      const body = (text2 !== undefined ? text2 : '¿QUÉ OPINAS? 👇').trim();
      const s = back(clamp(p / 0.26, 0, 1));
      c.save();
      c.translate(w / 2, h / 2);
      c.scale(s, s);

      const bw = 266;
      const bh = 96;
      c.shadowColor = 'rgba(0,0,0,0.5)';
      c.shadowBlur = 18;
      c.shadowOffsetY = 6;

      c.fillStyle = '#f8fafc';
      rr(c, -bw / 2, -bh / 2, bw, bh, 16);
      c.fill();
      c.shadowColor = 'transparent';

      c.save();
      rr(c, -bw / 2, -bh / 2, bw, bh, 16);
      c.clip();
      c.fillStyle = gradFill(c, -bw / 2, -bh / 2, bw / 2, 0, a);
      c.fillRect(-bw / 2, -bh / 2, bw, 36);
      c.restore();

      c.fillStyle = '#fff';
      setFittedFont(c, header, bw - 24, 12, 800);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(header, 0, -bh / 2 + 19);

      c.fillStyle = '#0f172a';
      setFittedFont(c, body, bw - 26, 20, 900);
      c.fillText(body, 0, 18);
      c.restore();
    },
  },
  {
    id: 'share-arrow',
    name: 'Compartir ↗',
    cat: 'TikTok',
    fw: 180,
    fh: 180,
    frames: 50,
    loop: true,
    draw: (c, p, a, w, h) => {
      const pulse = 1 + 0.1 * Math.sin(p * Math.PI * 2);
      const rp = p % 1;
      c.save();
      c.translate(w / 2, h / 2);

      c.strokeStyle = a;
      c.globalAlpha = (1 - rp) * 0.65;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, 44 + rp * 26, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;

      c.scale(pulse, pulse);
      c.shadowColor = a;
      c.shadowBlur = 18;
      c.fillStyle = gradFill(c, 0, -44, 0, 44, a);
      c.beginPath();
      c.arc(0, 0, 44, 0, Math.PI * 2);
      c.fill();
      c.shadowColor = 'transparent';

      c.fillStyle = '#fff';
      c.beginPath();
      c.moveTo(4, -20);
      c.lineTo(24, -2);
      c.lineTo(4, 16);
      c.lineTo(4, 6);
      c.quadraticCurveTo(-14, 6, -22, 20);
      c.quadraticCurveTo(-20, -10, 4, -10);
      c.closePath();
      c.fill();
      c.restore();
    },
  },
  {
    id: 'alert-ojo',
    name: '¡OJO! Alerta',
    cat: 'TikTok',
    fw: 250,
    fh: 110,
    frames: 45,
    loop: false,
    defaultText: '¡ESPERA! 🚨',
    textLabel1: 'Texto de alerta',
    draw: (c, p, a, w, h, text) => {
      const label = (text !== undefined ? text : '¡ESPERA! 🚨').trim().toUpperCase();
      const s = back(clamp(p / 0.22, 0, 1));
      const shake = p > 0.22 && p < 0.65 ? Math.sin((p - 0.22) * 48) * 0.08 : 0;
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(-0.04 + shake);
      c.scale(s, s);

      const bw = 212;
      const bh = 62;
      c.shadowColor = a;
      c.shadowBlur = 20;
      c.fillStyle = gradFill(c, 0, -bh / 2, 0, bh / 2, a);
      rr(c, -bw / 2, -bh / 2, bw, bh, 14);
      c.fill();
      c.shadowColor = 'transparent';

      c.strokeStyle = '#fff';
      c.lineWidth = 3.5;
      rr(c, -bw / 2, -bh / 2, bw, bh, 14);
      c.stroke();

      c.fillStyle = '#fff';
      setFittedFont(c, label, bw - 24, 24, 900);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, 0, 2);
      c.restore();
    },
  },

  /* --- YOUTUBE --- */
  {
    id: 'subscribe',
    name: 'Suscribirse',
    cat: 'YouTube',
    fw: 310,
    fh: 96,
    frames: 50,
    loop: false,
    defaultText: 'SUSCRIBIRSE',
    defaultText2: 'SUSCRIPTO',
    textLabel1: 'Texto inicial',
    textLabel2: 'Texto al tocar',
    draw: (c, p, a, w, h, text, text2) => {
      const label1 = (text !== undefined ? text : 'SUSCRIBIRSE').trim().toUpperCase();
      const label2 = (text2 !== undefined ? text2 : 'SUSCRIPTO').trim().toUpperCase();
      const app = back(clamp(p / 0.22, 0, 1));
      const clicked = p > 0.5;
      const cp = clamp((p - 0.5) / 0.16, 0, 1);
      const scalePulse = clicked ? 1 - 0.06 * Math.sin(cp * Math.PI) : 1;

      c.save();
      c.translate(w / 2, h / 2);
      c.scale(app * scalePulse, app * scalePulse);
      const bw = 262;
      const bh = 58;
      c.shadowColor = 'rgba(0,0,0,.48)';
      c.shadowBlur = 14;
      c.shadowOffsetY = 4;
      c.fillStyle = clicked ? '#27272a' : gradFill(c, 0, -bh / 2, 0, bh / 2, a);
      rr(c, -bw / 2, -bh / 2, bw, bh, 12);
      c.fill();
      c.shadowColor = 'transparent';

      c.strokeStyle = 'rgba(255,255,255,0.28)';
      c.lineWidth = 2;
      rr(c, -bw / 2, -bh / 2, bw, bh, 12);
      c.stroke();

      if (!clicked && p > 0.24 && p < 0.5) {
        const sp = (p - 0.24) / 0.26;
        c.save();
        rr(c, -bw / 2, -bh / 2, bw, bh, 12);
        c.clip();
        const g = c.createLinearGradient(-bw / 2 + sp * bw * 1.4 - 60, 0, -bw / 2 + sp * bw * 1.4 + 60, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,.38)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(-bw / 2, -bh / 2, bw, bh);
        c.restore();
      }

      const currentLabel = clicked ? label2 : label1;
      c.fillStyle = clicked ? '#d4d4d8' : '#fff';
      setFittedFont(c, currentLabel, clicked ? bw - 56 : bw - 28, 20, 800);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(currentLabel, clicked ? -12 : 0, 1);

      if (clicked) {
        const k = out(cp);
        c.strokeStyle = '#4ade80';
        c.lineWidth = 3.5;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(86, 0);
        c.lineTo(86 + 7 * k, 7 * k);
        c.lineTo(86 + 18 * k, -9 * k);
        c.stroke();
      }
      if (p > 0.5 && p < 0.78) {
        const rp = (p - 0.5) / 0.28;
        c.strokeStyle = `rgba(255,255,255,${0.55 * (1 - rp)})`;
        c.lineWidth = 3;
        rr(c, -bw / 2 - rp * 22, -bh / 2 - rp * 22, bw + rp * 44, bh + rp * 44, 14 + rp * 12);
        c.stroke();
      }
      c.restore();
    },
  },
  {
    id: 'bell',
    name: 'Campanita',
    cat: 'YouTube',
    fw: 180,
    fh: 180,
    frames: 50,
    loop: false,
    draw: (c, p, a, w, h) => {
      const app = back(clamp(p / 0.2, 0, 1));
      const sw = p > 0.2 ? Math.sin((p - 0.2) * 26) * Math.max(0, 1 - (p - 0.2) / 0.6) * 0.42 : 0;
      c.save();
      c.translate(w / 2, h / 2 - 6);
      c.scale(app, app);
      for (let i = 0; i < 3; i++) {
        const rp = clamp((p - 0.3 - i * 0.1) / 0.4, 0, 1);
        if (rp > 0 && rp < 1) {
          c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - rp)})`;
          c.lineWidth = 3;
          c.beginPath();
          c.arc(0, 0, 44 + rp * 34, -0.9, 0.9);
          c.stroke();
          c.beginPath();
          c.arc(0, 0, 44 + rp * 34, Math.PI - 0.9, Math.PI + 0.9);
          c.stroke();
        }
      }
      c.rotate(sw);
      c.shadowColor = a;
      c.shadowBlur = 18;
      c.fillStyle = gradFill(c, 0, -36, 0, 22, '#ffffff');
      c.beginPath();
      c.moveTo(-30, 22);
      c.quadraticCurveTo(-30, -14, -14, -24);
      c.quadraticCurveTo(-14, -36, 0, -36);
      c.quadraticCurveTo(14, -36, 14, -24);
      c.quadraticCurveTo(30, -14, 30, 22);
      c.closePath();
      c.fill();
      c.fillStyle = gradFill(c, -34, 22, 34, 30, a);
      rr(c, -34, 22, 68, 8, 4);
      c.fill();
      c.beginPath();
      c.arc(Math.sin(sw) * 8, 38, 8, 0, Math.PI * 2);
      c.fill();
      c.shadowColor = 'transparent';
      c.restore();
    },
  },

  /* --- REDES --- */
  {
    id: 'like',
    name: 'Me gusta 👍',
    cat: 'Redes',
    fw: 180,
    fh: 180,
    frames: 45,
    loop: false,
    draw: (c, p, a, w, h) => {
      const s = back(clamp(p / 0.26, 0, 1));
      c.save();
      c.translate(w / 2, h / 2 + 4);
      if (p > 0.2) {
        const bp = clamp((p - 0.2) / 0.5, 0, 1);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const d = 30 + bp * 46;
          c.fillStyle = `rgba(255,255,255,${0.75 * (1 - bp)})`;
          c.beginPath();
          c.arc(Math.cos(ang) * d, Math.sin(ang) * d, 4 * (1 - bp) + 1, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.scale(s, s);
      c.shadowColor = a;
      c.shadowBlur = 20;
      c.fillStyle = gradFill(c, 0, -30, 0, 32, a);
      c.beginPath();
      c.moveTo(-26, -2);
      c.lineTo(-10, -2);
      c.lineTo(2, -26);
      c.quadraticCurveTo(12, -30, 12, -18);
      c.lineTo(8, -4);
      c.lineTo(26, -4);
      c.quadraticCurveTo(34, -4, 32, 6);
      c.lineTo(26, 26);
      c.quadraticCurveTo(24, 32, 16, 32);
      c.lineTo(-10, 32);
      c.lineTo(-10, 0);
      c.closePath();
      c.fill();
      c.fillStyle = '#fff';
      rr(c, -34, -2, 16, 34, 4);
      c.fill();
      c.shadowColor = 'transparent';
      c.restore();
    },
  },
  {
    id: 'heart',
    name: 'Corazón latido',
    cat: 'Redes',
    fw: 180,
    fh: 180,
    frames: 50,
    loop: true,
    draw: (c, p, a, w, h) => {
      const beat = 1 + 0.14 * Math.max(0, Math.sin(p * Math.PI * 4)) * Math.exp(-((p % 0.5) * 4));
      c.save();
      c.translate(w / 2, h / 2 + 4);
      c.scale(beat, beat);
      c.shadowColor = a;
      c.shadowBlur = 24;
      drawGlossyHeart(c, 36, a);
      c.restore();
    },
  },
  {
    id: 'stars',
    name: '5 Estrellas ⭐',
    cat: 'Redes',
    fw: 300,
    fh: 90,
    frames: 55,
    loop: false,
    draw: (c, p, a, w, h) => {
      for (let i = 0; i < 5; i++) {
        const sp = clamp((p - i * 0.13) / 0.24, 0, 1);
        if (sp <= 0) continue;
        const s = back(sp);
        c.save();
        c.translate(38 + i * 56, h / 2);
        c.scale(s, s);
        c.rotate((1 - sp) * 1.2);
        c.shadowColor = a;
        c.shadowBlur = 14;
        c.fillStyle = gradFill(c, 0, -22, 0, 22, a);
        star(c, 0, 0, 22);
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.4)';
        c.lineWidth = 1.5;
        c.stroke();
        c.restore();
      }
    },
  },
  {
    id: 'counter',
    name: 'Contador Likes',
    cat: 'Redes',
    fw: 270,
    fh: 96,
    frames: 50,
    loop: false,
    defaultText: '12483',
    textLabel1: 'Cantidad objetivo',
    draw: (c, p, a, w, h, text) => {
      const raw = text !== undefined ? text : '12483';
      const parsed = parseInt(raw.replace(/\D/g, ''), 10);
      const suffix = raw.replace(/[0-9.,\s]/g, '');
      const target = Number.isFinite(parsed) && parsed > 0 ? parsed : 12483;
      const app = back(clamp(p / 0.2, 0, 1));
      const n = Math.round(ease(clamp((p - 0.15) / 0.7, 0, 1)) * target);
      const displayStr = `${n.toLocaleString('es-UY')}${suffix ? ' ' + suffix : ''}`;

      c.save();
      c.translate(w / 2, h / 2);
      c.scale(app, app);
      c.fillStyle = 'rgba(10,14,26,.92)';
      rr(c, -120, -30, 240, 60, 30);
      c.fill();
      c.strokeStyle = a;
      c.lineWidth = 2.5;
      c.stroke();

      c.save();
      c.translate(-80, 0);
      drawGlossyHeart(c, 18, a);
      c.restore();

      c.fillStyle = '#fff';
      setFittedFont(c, displayStr, 155, 25, 800);
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(displayStr, -50, 2);
      c.restore();
    },
  },

  /* --- UI --- */
  {
    id: 'check',
    name: 'Check Verificado',
    cat: 'UI',
    fw: 180,
    fh: 180,
    frames: 40,
    loop: false,
    draw: (c, p, a, w, h) => {
      c.save();
      c.translate(w / 2, h / 2);
      const cp = clamp(p / 0.45, 0, 1);
      c.strokeStyle = a;
      c.lineWidth = 8;
      c.lineCap = 'round';
      c.shadowColor = a;
      c.shadowBlur = 16;
      c.beginPath();
      c.arc(0, 0, 48, -Math.PI / 2, -Math.PI / 2 + cp * Math.PI * 2);
      c.stroke();
      if (p > 0.4) {
        const k = out(clamp((p - 0.4) / 0.35, 0, 1));
        c.strokeStyle = '#fff';
        c.lineWidth = 9;
        c.beginPath();
        c.moveTo(-22, 2);
        const m = clamp(k * 2, 0, 1);
        c.lineTo(-22 + 16 * m, 2 + 16 * m);
        if (k > 0.5) {
          const m2 = (k - 0.5) * 2;
          c.lineTo(-6 + 34 * m2, 18 - 40 * m2);
        }
        c.stroke();
      }
      c.shadowColor = 'transparent';
      c.restore();
    },
  },
  {
    id: 'badge',
    name: 'Badge NUEVO',
    cat: 'UI',
    fw: 270,
    fh: 90,
    frames: 50,
    loop: false,
    defaultText: 'NUEVO VIDEO 🔥',
    textLabel1: 'Texto del badge',
    draw: (c, p, a, w, h, text) => {
      const label = (text !== undefined ? text : 'NUEVO VIDEO 🔥').trim().toUpperCase();
      const app = out(clamp(p / 0.28, 0, 1));
      const tilt = (1 - app) * -0.35;
      c.save();
      c.translate(w / 2 - (1 - app) * 90, h / 2);
      c.rotate(tilt);
      c.globalAlpha = app;
      c.shadowColor = 'rgba(0,0,0,.45)';
      c.shadowBlur = 12;
      c.shadowOffsetY = 4;
      c.fillStyle = gradFill(c, 0, -26, 0, 26, a);
      rr(c, -110, -26, 220, 52, 26);
      c.fill();
      c.shadowColor = 'transparent';
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 2;
      rr(c, -110, -26, 220, 52, 26);
      c.stroke();

      if (p > 0.3 && p < 0.68) {
        const sp = (p - 0.3) / 0.38;
        c.save();
        rr(c, -110, -26, 220, 52, 26);
        c.clip();
        const g = c.createLinearGradient(-110 + sp * 320 - 50, 0, -110 + sp * 320 + 50, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(-110, -26, 220, 52);
        c.restore();
      }
      c.fillStyle = '#fff';
      setFittedFont(c, label, 196, 21, 800);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, 0, 1);
      c.restore();
    },
  },
  {
    id: 'spinner',
    name: 'Cargando',
    cat: 'UI',
    fw: 160,
    fh: 160,
    frames: 50,
    loop: true,
    draw: (c, p, a, w, h) => {
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(p * Math.PI * 2);
      c.strokeStyle = a;
      c.lineWidth = 9;
      c.lineCap = 'round';
      c.shadowColor = a;
      c.shadowBlur = 16;
      c.beginPath();
      c.arc(0, 0, 44, 0, Math.PI * 1.35);
      c.stroke();
      c.restore();
    },
  },
];

export const STICKER_CATS = ['TikTok', 'YouTube', 'Redes', 'UI'];
const ACCENTS = ['#ff0050', '#22d3ee', '#a855f7', '#4ade80', '#fbbf24', '#f43f5e'];

const EMOJIS = [
  '🔥', '❤️', '😍', '😂', '😱', '🤯', '🥺', '😎',
  '👇', '👆', '👉', '👈', '👏', '🙌', '👍', '💯',
  '✨', '⚡', '💥', '🎉', '🚀', '💎', '👑', '⭐',
  '🚨', '⚠️', '✅', '❌', '💬', '🔔', '🎵', '🎬',
  '👀', '💀', '😭', '🥳', '🤩', '🫶', '💪', '🎁',
];

/* ============================================================================
   INPUT CON SELECTOR DE EMOTICONES INTEGRADO
============================================================================ */

function EmojiTextInput({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 24,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const insertEmoji = (em: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = (value.slice(0, start) + em + value.slice(end)).slice(0, maxLength);
    onChange(next);
    setOpen(false);
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        const pos = Math.min(next.length, start + em.length);
        try {
          el.setSelectionRange(pos, pos);
        } catch {
          /* noop */
        }
      }
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="text"
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 min-w-0 flex-1 rounded-lg border border-[#25456b] bg-[#0a1729] px-2.5 text-[12px] font-bold text-white outline-none transition focus:border-cyan-400"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Agregar emoticon"
          aria-label="Agregar emoticon"
          className={cx(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[16px] transition active:scale-95',
            open
              ? 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.25)]'
              : 'border-[#25456b] bg-[#0a1729] hover:border-cyan-400/60 hover:bg-[#0f223d]'
          )}
        >
          😊
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-[62px] z-30 w-64 rounded-xl border border-cyan-400/50 bg-[#081529] p-2 shadow-2xl shadow-black/90">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-cyan-300">Emoticones</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-1 text-[10px] font-bold text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => insertEmoji(em)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[15px] transition hover:scale-110 hover:bg-cyan-500/20 active:scale-95"
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   RENDERIZADO DE MEDIOS (WAV MASTERIZADO + SPRITESHEET HD)
============================================================================ */

async function renderSfx(def: SfxDef, tune: number, gain: number): Promise<{ blob: Blob; duration: number }> {
  const oc = new OfflineAudioContext(2, Math.ceil(def.dur * SR), SR);
  const bus = oc.createGain();
  bus.gain.value = clamp(gain, 0, 1.5);
  connectMaster(oc, bus, oc.destination, def.wet ?? 0.16);
  const pm = Math.pow(2, tune / 12);
  def.build(oc, bus, pm);
  const rendered = await oc.startRendering();
  return { blob: encodeWav(rendered), duration: rendered.duration };
}

function buildSheet(
  def: StickerDef,
  accent: string,
  frames: number,
  customText?: string,
  customText2?: string
): Promise<Blob | null> {
  const sw = Math.round(def.fw * HD_SCALE);
  const sh = Math.round(def.fh * HD_SCALE);
  const cv = document.createElement('canvas');
  cv.width = sw * frames;
  cv.height = sh;
  const c = cv.getContext('2d');
  if (!c) return Promise.resolve(null);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';

  for (let i = 0; i < frames; i++) {
    c.save();
    c.translate(i * sw, 0);
    c.beginPath();
    c.rect(0, 0, sw, sh);
    c.clip();
    c.scale(HD_SCALE, HD_SCALE);
    def.draw(c, frames <= 1 ? 1 : i / (frames - 1), accent, def.fw, def.fh, customText, customText2);
    c.restore();
  }
  return new Promise((r) => cv.toBlob((b) => r(b), 'image/png'));
}

/* ============================================================================
   MINIATURAS REALES Y CONTROLES VISUALES
============================================================================ */

const waveCache = new Map<string, number[]>();

function SfxWaveform({ def, active, playing }: { def: SfxDef; active: boolean; playing: boolean }) {
  const [bars, setBars] = useState<number[]>(() => waveCache.get(def.id) || Array(22).fill(0.25));

  useEffect(() => {
    if (waveCache.has(def.id)) {
      setBars(waveCache.get(def.id)!);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rate = 8000;
        const oc = new OfflineAudioContext(1, Math.max(22, Math.ceil(def.dur * rate)), rate);
        def.build(oc, oc.destination, 1);
        const buf = await oc.startRendering();
        const ch = buf.getChannelData(0);
        const nBars = 22;
        const step = Math.max(1, Math.floor(ch.length / nBars));
        const peaks: number[] = [];
        let maxPeak = 0.01;
        for (let i = 0; i < nBars; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            const v = Math.abs(ch[i * step + j] || 0);
            if (v > sum) sum = v;
          }
          peaks.push(sum);
          if (sum > maxPeak) maxPeak = sum;
        }
        const norm = peaks.map((v) => clamp(v / maxPeak, 0.14, 1));
        waveCache.set(def.id, norm);
        if (!cancelled) setBars(norm);
      } catch {
        /* fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [def]);

  return (
    <div className="flex h-6 items-center gap-[2px]" aria-hidden="true">
      {bars.map((v, idx) => (
        <span
          key={idx}
          className={cx(
            'w-[2.5px] rounded-full transition-all duration-150',
            playing
              ? 'animate-pulse bg-cyan-300'
              : active
              ? 'bg-cyan-400/90'
              : 'bg-slate-600/80 group-hover:bg-cyan-500/60'
          )}
          style={{ height: `${Math.round(v * 22)}px`, animationDelay: `${idx * 25}ms` }}
        />
      ))}
    </div>
  );
}

function StickerThumb({ def, accent }: { def: StickerDef; accent: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = def.fw * dpr;
    cv.height = def.fh * dpr;
    const c = cv.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, def.fw, def.fh);
    def.draw(c, 0.42, accent, def.fw, def.fh, def.defaultText, def.defaultText2);
  }, [def, accent]);

  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1d3554] sm:w-14"
      style={{ background: 'repeating-conic-gradient(#132138 0% 25%, #0b1526 0% 50%) 0 0/10px 10px' }}
    >
      <canvas ref={ref} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

const POS_POINTS = [
  { id: 'tl', label: 'Sup. Izq', x: 0.2, y: 0.16 },
  { id: 'tc', label: 'Arriba', x: 0.5, y: 0.16 },
  { id: 'tr', label: 'Sup. Der', x: 0.8, y: 0.16 },
  { id: 'ml', label: 'Izquierda', x: 0.2, y: 0.5 },
  { id: 'mc', label: 'Centro', x: 0.5, y: 0.5 },
  { id: 'mr', label: 'Derecha', x: 0.8, y: 0.5 },
  { id: 'bl', label: 'Inf. Izq', x: 0.2, y: 0.82 },
  { id: 'bc', label: 'Abajo', x: 0.5, y: 0.82 },
  { id: 'br', label: 'Inf. Der', x: 0.8, y: 0.82 },
] as const;

type PosId = (typeof POS_POINTS)[number]['id'];

/* ============================================================================
   MODAL PRINCIPAL: GENERADOR DE MEDIOS
============================================================================ */

export type SfxResult = { blob: Blob; name: string; duration: number; volume: number; fadeIn: number; fadeOut: number };
export type StickerResult = {
  blob: Blob;
  name: string;
  frames: number;
  fps: number;
  fw: number;
  fh: number;
  loop: boolean;
  size: number;
  duration: number;
  x: number;
  y: number;
  fadeIn: number;
  fadeOut: number;
};

export function MediaLibraryModal({
  onClose,
  onSfx,
  onSticker,
  refW,
  refH,
}: {
  onClose: () => void;
  onSfx: (r: SfxResult) => void;
  onSticker: (r: StickerResult) => void;
  refW: number;
  refH: number;
}) {
  const [tab, setTab] = useState<'sfx' | 'sticker'>('sticker');
  const [query, setQuery] = useState('');
  const [catS, setCatS] = useState<string>('Todos');
  const [catK, setCatK] = useState<string>('Todos');
  const [selS, setSelS] = useState(SFX[0].id);
  const [selK, setSelK] = useState(STICKERS[0].id);
  const [accent, setAccent] = useState(ACCENTS[0]);
  const [customText, setCustomText] = useState('');
  const [customText2, setCustomText2] = useState('');
  const [vol, setVol] = useState(0.95);
  const [tune, setTune] = useState(0);
  const [size, setSize] = useState(32);
  const [dur, setDur] = useState(2.2);
  const [loop, setLoop] = useState(false);
  const [fadeIn, setFadeIn] = useState(0.15);
  const [fadeOut, setFadeOut] = useState(0.2);
  const [posId, setPosId] = useState<PosId>('mc');
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const acRef = useRef<AudioContext | null>(null);
  const prevRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const sfx = useMemo(() => SFX.find((s) => s.id === selS) || SFX[0], [selS]);
  const stk = useMemo(() => STICKERS.find((s) => s.id === selK) || STICKERS[0], [selK]);

  useEffect(() => {
    setCustomText(stk.defaultText ?? '');
    setCustomText2(stk.defaultText2 ?? '');
  }, [stk]);

  const sfxList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SFX.filter(
      (s) => (catS === 'Todos' || s.cat === catS) && (!q || s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q))
    );
  }, [catS, query]);

  const stkList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STICKERS.filter(
      (s) => (catK === 'Todos' || s.cat === catK) && (!q || s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q))
    );
  }, [catK, query]);

  const frames = Math.max(2, Math.round(dur * FPS));
  const xy = useMemo(() => POS_POINTS.find((pt) => pt.id === posId) || POS_POINTS[4], [posId]);

  useEffect(() => {
    if (tab !== 'sticker') return;
    const cv = prevRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = stk.fw * dpr;
    cv.height = stk.fh * dpr;
    const c = cv.getContext('2d');
    if (!c) return;

    const t0 = performance.now();
    const effectiveLoop = loop || stk.loop;

    const tick = () => {
      const el = (performance.now() - t0) / 1000 / Math.max(dur, 0.25);
      const p = effectiveLoop ? el % 1 : Math.min(1, el);

      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, stk.fw, stk.fh);
      stk.draw(c, p, accent, stk.fw, stk.fh, customText, customText2);

      if (!effectiveLoop && el >= 1.35) {
        rafRef.current = window.setTimeout(() => {
          rafRef.current = requestAnimationFrame(tick);
        }, 420) as unknown as number;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(rafRef.current);
    };
  }, [tab, stk, accent, dur, loop, customText, customText2]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  useEffect(
    () => () => {
      try {
        void acRef.current?.close();
      } catch {
        /* noop */
      }
    },
    []
  );

  const preview = useCallback(
    async (def: SfxDef) => {
      if (muted) return;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!acRef.current) acRef.current = new AudioCtx();
      const ac = acRef.current;
      if (ac.state === 'suspended') await ac.resume();
      setPlaying(def.id);
      try {
        const { blob } = await renderSfx(def, tune, vol);
        const buf = await ac.decodeAudioData(await blob.arrayBuffer());
        const s = ac.createBufferSource();
        s.buffer = buf;
        s.connect(ac.destination);
        s.onended = () => setPlaying((p) => (p === def.id ? null : p));
        s.start();
      } catch {
        setPlaying(null);
      }
    },
    [muted, tune, vol]
  );

  const insertSfx = async () => {
    setBusy(true);
    try {
      const { blob, duration } = await renderSfx(sfx, tune, 1);
      onSfx({ blob, name: sfx.name, duration, volume: vol, fadeIn, fadeOut });
    } finally {
      setBusy(false);
    }
  };

  const insertSticker = async () => {
    setBusy(true);
    try {
      const blob = await buildSheet(stk, accent, frames, customText, customText2);
      if (blob) {
        onSticker({
          blob,
          name: customText.trim() ? `${stk.name} (${customText.trim()})` : stk.name,
          frames,
          fps: FPS,
          fw: Math.round(stk.fw * HD_SCALE),
          fh: Math.round(stk.fh * HD_SCALE),
          loop: loop || stk.loop,
          size,
          duration: dur,
          x: xy.x,
          y: xy.y,
          fadeIn,
          fadeOut,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const randomize = () => {
    if (tab === 'sfx') {
      const p = SFX[Math.floor(Math.random() * SFX.length)];
      setCatS('Todos');
      setSelS(p.id);
      setTune(Math.round(Math.random() * 12 - 6));
      setVol(0.75 + Math.round(Math.random() * 40) / 100);
      void preview(p);
    } else {
      const p = STICKERS[Math.floor(Math.random() * STICKERS.length)];
      setCatK('Todos');
      setSelK(p.id);
      setAccent(ACCENTS[Math.floor(Math.random() * ACCENTS.length)]);
      setSize(22 + Math.round(Math.random() * 28));
      setDur(1.2 + Math.round(Math.random() * 20) / 10);
    }
  };

  const reset = () => {
    setVol(0.95);
    setTune(0);
    setSize(32);
    setDur(2.2);
    setLoop(false);
    setFadeIn(0.15);
    setFadeOut(0.2);
    setPosId('mc');
    setAccent(ACCENTS[0]);
    setCustomText(stk.defaultText ?? '');
    setCustomText2(stk.defaultText2 ?? '');
  };

  const sl = 'sfxlib-range w-full';
  const chip = (on: boolean) =>
    cx(
      'shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition active:scale-95',
      on
        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
        : 'border-[#223f63] bg-[#0a1729] text-slate-400 hover:border-[#345c8c] hover:text-slate-200'
    );
  const card = (on: boolean) =>
    cx(
      'group flex min-h-[58px] items-center gap-2 rounded-xl border p-2 text-left transition active:scale-[0.99] sm:gap-2.5 sm:p-2.5',
      on
        ? 'border-cyan-400/80 bg-gradient-to-r from-cyan-500/15 to-fuchsia-500/10 shadow-[0_0_16px_rgba(34,211,238,.18)]'
        : 'border-[#1b324f] bg-[#0a1729]/80 hover:border-[#2e5786] hover:bg-[#0d1d33]'
    );

  return createPortal(
    <div className="fixed inset-0 z-[215] flex items-end justify-center bg-black/85 backdrop-blur-sm lg:items-center lg:p-4">
      <style>{`
        .sfxlib-scroll{scrollbar-width:thin;scrollbar-color:#8b5cf6 #0a1526}
        .sfxlib-scroll::-webkit-scrollbar{width:7px;height:6px}
        .sfxlib-scroll::-webkit-scrollbar-track{background:#0a1526;border-radius:8px}
        .sfxlib-scroll::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#22d3ee,#8b5cf6);border-radius:8px}
        .sfxlib-no-bar::-webkit-scrollbar{display:none}
        .sfxlib-no-bar{-ms-overflow-style:none;scrollbar-width:none}
        .sfxlib-range{-webkit-appearance:none;appearance:none;height:6px;border-radius:99px;background:#0d1b2c;border:1px solid #1d3350;outline:none;cursor:pointer}
        .sfxlib-range::-webkit-slider-thumb{-webkit-appearance:none;width:19px;height:19px;border-radius:50%;background:linear-gradient(135deg,#67e8f9,#22d3ee);border:2px solid #061020;cursor:pointer;box-shadow:0 0 10px rgba(34,211,238,.75)}
        .sfxlib-range::-moz-range-thumb{width:19px;height:19px;border-radius:50%;background:#22d3ee;border:2px solid #061020;cursor:pointer}
        @keyframes sfxlibSheet{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
      `}</style>

      <div
        className="flex h-[94dvh] w-full max-w-[1060px] flex-col overflow-hidden rounded-t-2xl border-t-2 border-x-2 border-transparent shadow-2xl lg:h-auto lg:max-h-[88vh] lg:rounded-2xl lg:border-2"
        style={{
          background: 'linear-gradient(#050d1a,#050d1a) padding-box, linear-gradient(135deg,#22d3ee,#8b5cf6,#f43f5e) border-box',
          animation: 'sfxlibSheet 220ms cubic-bezier(.16,1,.3,1)',
        }}
      >
        {/* HEADER */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 bg-gradient-to-r from-[#0a1729] to-[#150e28] px-3 py-2.5 sm:flex-nowrap sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-black shadow-lg shadow-cyan-500/25">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-4 w-4">
                <path d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" />
              </svg>
            </span>
            <div className="min-w-0 leading-none">
              <h2 className="truncate text-[15px] font-black tracking-tight text-white sm:text-[17px]">
                Generador de <span className="bg-gradient-to-r from-cyan-300 to-fuchsia-400 bg-clip-text text-transparent">Medios</span>
              </h2>
              <p className="mt-1 truncate text-[8px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-[9px] sm:tracking-[0.2em]">
                Stickers TikTok & SFX HD · 100% local
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:order-3">
            <button
              onClick={() => setMuted((m) => !m)}
              className={cx(
                'flex h-8 w-8 items-center justify-center rounded-lg border text-[13px] font-black transition active:scale-95 sm:h-9 sm:w-9',
                muted ? 'border-rose-400 bg-rose-500/20 text-rose-200' : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
              )}
              title="Silenciar previsualización"
            >
              {muted ? '🔇' : '🔊'}
            </button>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-[#0a1729] text-[12px] font-black text-slate-300 transition hover:border-slate-400 active:scale-95 sm:h-9 sm:w-9"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="order-3 grid w-full grid-cols-2 rounded-xl border border-[#25456b] bg-[#0a1729] p-0.5 sm:order-2 sm:flex sm:w-auto">
            {(
              [
                ['sticker', '✨ Stickers'],
                ['sfx', '🔊 Sonidos'],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setQuery('');
                }}
                className={cx(
                  'min-h-[32px] rounded-lg px-3 py-1 text-[11px] font-black transition sm:min-h-[34px]',
                  tab === t ? 'bg-gradient-to-r from-cyan-500/35 to-fuchsia-500/30 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="sfxlib-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 lg:grid lg:grid-cols-[minmax(0,1fr)_345px] lg:overflow-hidden">
          {/* BLOQUE A: PERSONALIZAR + VISOR GRANDE (Arriba en móvil, Derecha en Desktop) */}
          <div className="sfxlib-scroll order-1 flex shrink-0 flex-col rounded-xl border border-[#1d3350] bg-[#081426] p-3 lg:order-2 lg:max-h-[72vh] lg:shrink lg:overflow-y-auto">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                {tab === 'sfx' ? 'Estudio de Audio' : 'Personalizar Sticker'}
              </p>
              <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-300">
                {tab === 'sfx' ? 'WAV 44.1kHz' : `HD ${Math.round(stk.fw * HD_SCALE)}×${Math.round(stk.fh * HD_SCALE)}`}
              </span>
            </div>

            {/* VISOR GRANDE RESPONSIVE */}
            {tab === 'sticker' ? (
              <div
                className="mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-xl border border-[#1a3150] p-3 sm:h-40"
                style={{ background: 'repeating-conic-gradient(#16233a 0% 25%, #0d1728 0% 50%) 0 0/16px 16px' }}
              >
                <canvas ref={prevRef} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-[#1a3150] bg-[#0b192e] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-black text-white">{sfx.name}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {sfx.cat} · {sfx.dur.toFixed(2)}s · {tune > 0 ? `+${tune}` : tune} st
                  </p>
                  <div className="mt-2">
                    <SfxWaveform def={sfx} active={true} playing={playing === sfx.id} />
                  </div>
                </div>
                <button
                  onClick={() => void preview(sfx)}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30 active:scale-95"
                  title="Reproducir"
                >
                  {playing === sfx.id ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>
            )}

            <div className="space-y-3">
              {tab === 'sfx' ? (
                <>
                  <label className="block">
                    <span className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Volumen<span className="font-mono text-cyan-300">{Math.round(vol * 100)}%</span>
                    </span>
                    <input type="range" min={0} max={1.5} step={0.01} value={vol} onChange={(e) => setVol(+e.target.value)} className={sl} />
                  </label>
                  <label className="block">
                    <span className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Tono (sin alterar velocidad)<span className="font-mono text-cyan-300">{tune > 0 ? '+' : ''}{tune} st</span>
                    </span>
                    <input type="range" min={-12} max={12} step={1} value={tune} onChange={(e) => setTune(+e.target.value)} className={sl} />
                  </label>
                </>
              ) : (
                <>
                  {/* Campos de texto con selector de emoticones */}
                  {stk.defaultText !== undefined && (
                    <div className={cx('grid gap-2', stk.defaultText2 !== undefined ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-1' : 'grid-cols-1')}>
                      <EmojiTextInput
                        label={stk.textLabel1 || 'Texto del sticker'}
                        value={customText}
                        onChange={setCustomText}
                        placeholder={stk.defaultText}
                        maxLength={24}
                      />
                      {stk.defaultText2 !== undefined && (
                        <EmojiTextInput
                          label={stk.textLabel2 || 'Segundo texto'}
                          value={customText2}
                          onChange={setCustomText2}
                          placeholder={stk.defaultText2}
                          maxLength={24}
                        />
                      )}
                    </div>
                  )}

                  <div>
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Color principal</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="color"
                        value={accent}
                        onChange={(e) => setAccent(e.target.value)}
                        className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-[#25456b] bg-[#0a1729] p-0.5"
                      />
                      {ACCENTS.map((a) => (
                        <button
                          key={a}
                          onClick={() => setAccent(a)}
                          className={cx(
                            'h-7 w-7 shrink-0 rounded-full border-2 transition hover:scale-110',
                            accent === a ? 'scale-110 border-white shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'border-slate-700'
                          )}
                          style={{ background: a }}
                          title={a}
                        />
                      ))}
                    </div>
                  </div>

                  <label className="block">
                    <span className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Tamaño en pantalla<span className="font-mono text-cyan-300">{size}%</span>
                    </span>
                    <input type="range" min={10} max={90} step={1} value={size} onChange={(e) => setSize(+e.target.value)} className={sl} />
                  </label>

                  <label className="block">
                    <span className="mb-1 flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      Duración<span className="font-mono text-cyan-300">{dur.toFixed(1)}s · {frames}f</span>
                    </span>
                    <input type="range" min={0.5} max={5} step={0.1} value={dur} onChange={(e) => setDur(+e.target.value)} className={sl} />
                  </label>

                  {/* Selector de posición cuadrado y espaciado + Botón bucle */}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[#182e4a] bg-[#0a1729] p-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="grid h-20 w-20 shrink-0 grid-cols-3 grid-rows-3 place-items-center gap-1.5 rounded-xl border border-[#2a4d78] bg-[#061020] p-2"
                        aria-label="Posición inicial"
                      >
                        {POS_POINTS.map((pt) => (
                          <button
                            key={pt.id}
                            type="button"
                            onClick={() => setPosId(pt.id)}
                            title={pt.label}
                            className={cx(
                              'h-3.5 w-3.5 rounded-full transition-all',
                              posId === pt.id
                                ? 'scale-125 bg-fuchsia-400 ring-2 ring-fuchsia-300/40 shadow-[0_0_8px_#e879f9]'
                                : 'bg-slate-700 hover:bg-cyan-400/80'
                            )}
                          />
                        ))}
                      </div>
                      <div className="leading-tight">
                        <span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">Posición</span>
                        <span className="mt-0.5 block text-[12px] font-black text-fuchsia-300">{xy.label}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setLoop((l) => !l)}
                      className={cx(
                        'min-h-[42px] shrink-0 rounded-xl border px-3 py-2 text-[11px] font-black transition active:scale-95',
                        loop || stk.loop
                          ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-200'
                          : 'border-[#25456b] bg-[#0d1d33] text-slate-300 hover:text-white'
                      )}
                    >
                      {loop || stk.loop ? '🔁 En bucle' : '➡️ Una vez'}
                    </button>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <label className="block">
                  <span className="mb-1 flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    Fade in<span className="font-mono text-cyan-300">{fadeIn.toFixed(1)}s</span>
                  </span>
                  <input type="range" min={0} max={1.5} step={0.1} value={fadeIn} onChange={(e) => setFadeIn(+e.target.value)} className={sl} />
                </label>
                <label className="block">
                  <span className="mb-1 flex justify-between text-[10px] font-bold uppercase text-slate-400">
                    Fade out<span className="font-mono text-cyan-300">{fadeOut.toFixed(1)}s</span>
                  </span>
                  <input type="range" min={0} max={1.5} step={0.1} value={fadeOut} onChange={(e) => setFadeOut(+e.target.value)} className={sl} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={randomize}
                  className="min-h-[38px] rounded-xl border border-violet-400/60 bg-violet-500/15 py-1.5 text-[11px] font-black text-violet-200 transition hover:bg-violet-500/25 active:scale-95"
                >
                  🎲 Al azar
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="min-h-[38px] rounded-xl border border-slate-600 bg-[#0a1729] py-1.5 text-[11px] font-black text-slate-300 transition hover:border-slate-400 active:scale-95"
                >
                  ↺ Reset
                </button>
              </div>

              {/* Botón Agregar en Desktop */}
              <button
                type="button"
                onClick={tab === 'sfx' ? insertSfx : insertSticker}
                disabled={busy}
                className="hidden w-full rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 py-3 text-[12px] font-black text-black shadow-lg shadow-cyan-500/25 transition hover:scale-[1.01] active:scale-95 disabled:opacity-50 lg:block"
              >
                {busy ? 'Renderizando HD…' : tab === 'sfx' ? '➕ Agregar a pista de audio' : '➕ Agregar a pista de imagen'}
              </button>

              <p className="hidden text-center text-[9px] leading-snug text-slate-500 lg:block">
                {tab === 'sfx'
                  ? 'Masterizado con compresor + reverb estéreo · Royalty-free'
                  : `${frames} frames PNG alfa (${Math.round(stk.fw * HD_SCALE)}×${Math.round(stk.fh * HD_SCALE)}px) · Lienzo ${refW}×${refH}`}
              </p>
            </div>
          </div>

          {/* BLOQUE B: EXPLORADOR (Debajo en móvil en 2 columnas, Izquierda en Desktop) */}
          <div className="order-2 flex min-w-0 flex-col rounded-xl border border-[#1a304d] bg-[#061020]/70 p-2.5 lg:order-1 lg:min-h-0 lg:border-0 lg:bg-transparent lg:p-0">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300 lg:hidden">
              {tab === 'sfx' ? 'Explorar Sonidos' : 'Explorar Stickers'}
            </p>

            <div className="mb-2 shrink-0">
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tab === 'sfx' ? 'Buscar sonido (ej. pop, whoosh, boing)...' : 'Buscar sticker (ej. corazones, pov, fuego)...'}
                  className="h-9 w-full rounded-xl border border-[#223f63] bg-[#091526] pl-8 pr-8 text-[12px] text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400"
                />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-2 rounded px-1 text-[11px] font-bold text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="sfxlib-no-bar mb-2.5 flex shrink-0 flex-nowrap gap-1.5 overflow-x-auto py-0.5">
              {['Todos', ...(tab === 'sfx' ? SFX_CATS : STICKER_CATS)].map((c) => (
                <button
                  key={c}
                  onClick={() => (tab === 'sfx' ? setCatS(c) : setCatK(c))}
                  className={chip(tab === 'sfx' ? catS === c : catK === c)}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Grilla de ítems */}
            <div
              className={cx(
                'sfxlib-scroll grid gap-2 pr-0.5 lg:max-h-[60vh] lg:overflow-y-auto',
                tab === 'sticker' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'
              )}
            >
              {tab === 'sfx' ? (
                sfxList.length > 0 ? (
                  sfxList.map((s) => {
                    const isSel = selS === s.id;
                    const isPlay = playing === s.id;
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelS(s.id);
                          void preview(s);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setSelS(s.id);
                            void preview(s);
                          }
                        }}
                        className={cx(card(isSel), 'cursor-pointer')}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 transition group-hover:bg-cyan-500/25">
                          {isPlay ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
                          ) : (
                            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3.5 w-3.5">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-[12px] font-bold text-slate-100">{s.name}</p>
                            <span className="shrink-0 font-mono text-[9px] text-slate-400">{s.dur.toFixed(2)}s</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <SfxWaveform def={s} active={isSel} playing={isPlay} />
                            <span className="rounded bg-[#11243e] px-1.5 py-0.5 text-[8px] font-bold uppercase text-slate-400">
                              {s.cat}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="col-span-full py-8 text-center text-[12px] text-slate-500">No hay sonidos que coincidan con "{query}".</p>
                )
              ) : stkList.length > 0 ? (
                stkList.map((s) => {
                  const isSel = selK === s.id;
                  return (
                    <button key={s.id} onClick={() => setSelK(s.id)} className={card(isSel)}>
                      <StickerThumb def={s} accent={accent} />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-bold text-slate-100 sm:text-[12px]">{s.name}</span>
                        <span className="mt-0.5 block truncate font-mono text-[9px] text-slate-400">
                          {s.cat} · {s.loop ? 'Bucle' : 'Animado'}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <p className="col-span-full py-8 text-center text-[12px] text-slate-500">No hay stickers que coincidan con "{query}".</p>
              )}
            </div>
          </div>
        </div>

        {/* BARRA INFERIOR FIJA EN MÓVIL (< lg) */}
        <div className="shrink-0 border-t border-cyan-500/20 bg-[#060f1e]/95 px-3 py-2.5 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={tab === 'sfx' ? insertSfx : insertSticker}
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 py-3 text-[12px] font-black text-black shadow-lg shadow-cyan-500/25 transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy
              ? 'Renderizando HD…'
              : tab === 'sfx'
              ? `➕ Agregar "${sfx.name}" a audio`
              : `➕ Agregar "${stk.name}" a video`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default MediaLibraryModal;