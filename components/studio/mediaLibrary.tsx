'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SfxDef, EMPTY_SFX, useSfxLibrary, SfxWaveform, playSfxFile, renderSfxFile, sfxDuration } from './sfxLibrary';

const FPS = 25;
const HD_SCALE = 2.5; // Exporta los spritesheets a 2.5x para nitidez total en 1080p/4K
const FAV_STORAGE_KEY = 'clipedia_medialib_favs_v1';
const REC_STORAGE_KEY = 'clipedia_medialib_recents_v1';

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

function readStoredIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(0, 40)));
  } catch {
    /* noop */
  }
}

/* ============================================================================
   MOTOR DE AUDIO DSP (COMPRESIÓN, REVERB ESTÉREO, PANEO Y SÍNTESIS MULTI-CAPA)
============================================================================ */

/* ============================================================================
sfxLib: biblioteca real servida desde Cloudflare R2 → ver sfxLibrary.tsx
============================================================================ */

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
}

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
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-xl border border-[#243f63] bg-[#091527] pl-3 pr-9 text-[12px] font-bold text-white outline-none transition focus:border-cyan-400"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Agregar emoticon"
          aria-label="Agregar emoticon"
          className={cx(
            'absolute right-1.5 flex h-6 w-6 items-center justify-center rounded-lg text-[14px] transition active:scale-95',
            open ? 'bg-cyan-500/25 ring-1 ring-cyan-400' : 'hover:bg-white/10'
          )}
        >
          😊
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-[58px] z-30 w-64 rounded-xl border border-cyan-400/50 bg-[#081529] p-2 shadow-2xl shadow-black/95">
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
   MINIATURAS Y VISUALIZADORES DE TARJETAS
============================================================================ */

function StickerCardPreview({ def, accent }: { def: StickerDef; accent: string }) {
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

  return <canvas ref={ref} className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-105" />;
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
type SortMode = 'default' | 'az' | 'loop' | 'once';

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
  const [sortBy, setSortBy] = useState<SortMode>('default');
  const [catS, setCatS] = useState<string>('Todos');
  const [catK, setCatK] = useState<string>('Todos');
const [catQuery, setCatQuery] = useState('');
  const [selS, setSelS] = useState('');
  const [selK, setSelK] = useState(STICKERS[1].id);
const { items: sfxLib, cats: sfxCats, loading: sfxLoading, error: sfxError, retry: sfxRetry, manifestUrl: sfxManifestUrl } = useSfxLibrary();
const [sfxLimit, setSfxLimit] = useState(60);
useEffect(() => { if (sfxLib.length && !sfxLib.some((s) => s.id === selS)) setSelS(sfxLib[0].id); }, [sfxLib, selS]);
useEffect(() => { setSfxLimit(60); }, [catS, query, sortBy, tab]);

  // Favoritos y Recientes persistentes
  const [favs, setFavs] = useState<string[]>(() => readStoredIds(FAV_STORAGE_KEY));
  const [recents, setRecents] = useState<string[]>(() => readStoredIds(REC_STORAGE_KEY));

  // Parámetros del personalizador
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

  // Estado de reproducción / scrubber de vista previa
  const [isPlaying, setIsPlaying] = useState(true);
  const [prog, setProg] = useState(0.35);
  const [expandedPrev, setExpandedPrev] = useState(false);

  const [busy, setBusy] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const acRef = useRef<AudioContext | null>(null);
  const prevRef = useRef<HTMLCanvasElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const sfxSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const progRef = useRef(prog);
  progRef.current = prog;

  const sfx = useMemo(() => sfxLib.find((s) => s.id === selS) || sfxLib[0] || EMPTY_SFX, [sfxLib, selS]);
  const stk = useMemo(() => STICKERS.find((s) => s.id === selK) || STICKERS[0], [selK]);

  const toggleFav = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev];
      writeStoredIds(FAV_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const markRecent = useCallback((id: string) => {
    setRecents((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 20);
      writeStoredIds(REC_STORAGE_KEY, next);
      return next;
    });
  }, []);

  const selectSticker = useCallback(
    (id: string) => {
      setSelK(id);
      markRecent(id);
      setProg(0);
      setIsPlaying(true);
    },
    [markRecent]
  );

  useEffect(() => {
    setCustomText(stk.defaultText ?? '');
    setCustomText2(stk.defaultText2 ?? '');
  }, [stk]);

  // Contadores de categorías
  const catCounts = useMemo(() => {
    if (tab === 'sticker') {
      const map: Record<string, number> = {
        Todos: STICKERS.length,
        Favoritos: STICKERS.filter((s) => favs.includes(s.id)).length,
        Recientes: STICKERS.filter((s) => recents.includes(s.id)).length,
      };
      STICKER_CATS.forEach((c) => {
        map[c] = STICKERS.filter((s) => s.cat === c).length;
      });
      return map;
    } else {
      const map: Record<string, number> = {
        Todos: sfxLib.length,
        Favoritos: sfxLib.filter((s) => favs.includes(s.id)).length,
        Recientes: sfxLib.filter((s) => recents.includes(s.id)).length,
      };
      sfxCats.forEach((c) => {
        map[c] = sfxLib.filter((s) => s.cat === c).length;
      });
      return map;
    }
  }, [tab, favs, recents, sfxLib, sfxCats]);

  const sfxList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = sfxLib.filter((s) => {
      const catOk =
        catS === 'Todos'
          ? true
          : catS === 'Favoritos'
          ? favs.includes(s.id)
          : catS === 'Recientes'
          ? recents.includes(s.id)
          : s.cat === catS;
      return catOk && (!q || s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q));
    });
    if (sortBy === 'az') return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'loop') return [...filtered].sort((a, b) => b.dur - a.dur);
    if (sortBy === 'once') return [...filtered].sort((a, b) => a.dur - b.dur);
    return filtered;
  }, [sfxLib, catS, query, favs, recents, sortBy]);

  const stkList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = STICKERS.filter((s) => {
      const catOk =
        catK === 'Todos'
          ? true
          : catK === 'Favoritos'
          ? favs.includes(s.id)
          : catK === 'Recientes'
          ? recents.includes(s.id)
          : s.cat === catK;
      return catOk && (!q || s.name.toLowerCase().includes(q) || s.cat.toLowerCase().includes(q));
    });
    if (sortBy === 'az') return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'loop') return [...filtered].sort((a, b) => Number(b.loop) - Number(a.loop));
    if (sortBy === 'once') return [...filtered].sort((a, b) => Number(a.loop) - Number(b.loop));
    return filtered;
  }, [catK, query, favs, recents, sortBy]);

  const frames = Math.max(2, Math.round(dur * FPS));
  const xy = useMemo(() => POS_POINTS.find((pt) => pt.id === posId) || POS_POINTS[4], [posId]);
  const effectiveLoop = loop || stk.loop;

  // Reloj de reproducción del scrubber de vista previa
  useEffect(() => {
    if (tab !== 'sticker' || !isPlaying) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const next = progRef.current + dt / Math.max(dur, 0.25);
      if (effectiveLoop) {
        setProg(next % 1);
        raf = requestAnimationFrame(step);
      } else if (next >= 1) {
        setProg(1);
        setIsPlaying(false);
      } else {
        setProg(next);
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tab, isPlaying, dur, effectiveLoop]);

  // Dibujo del canvas principal según `prog`
  useEffect(() => {
    if (tab !== 'sticker') return;
    const cv = prevRef.current;
    if (!cv) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = stk.fw * dpr;
    cv.height = stk.fh * dpr;
    const c = cv.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, stk.fw, stk.fh);
    stk.draw(c, clamp(prog, 0, 1), accent, stk.fw, stk.fh, customText, customText2);
  }, [tab, stk, prog, accent, customText, customText2]);

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

  const stopSfx = useCallback(() => {
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
        const node = await playSfxFile(def, tune, vol);
sfxSourceRef.current = node;
node.onended = () => {
if (sfxSourceRef.current === node) {
sfxSourceRef.current = null;
setPlayingAudioId((p) => (p === def.id ? null : p));
}
};
} catch {
        sfxSourceRef.current = null;
        setPlayingAudioId(null);
      }
    },
    [muted, tune, vol, markRecent, playingAudioId, stopSfx]
  );

  useEffect(() => { if (muted) stopSfx(); }, [muted, stopSfx]);

  const insertSfx = async () => {
    setBusy(true);
    try {
      markRecent(sfx.id);
      const { blob, duration } = await renderSfxFile(sfx, tune, 1);
      onSfx({ blob, name: sfx.name, duration, volume: vol, fadeIn, fadeOut });
    } finally {
      setBusy(false);
    }
  };

  const insertSticker = async () => {
    setBusy(true);
    try {
      markRecent(stk.id);
      const blob = await buildSheet(stk, accent, frames, customText, customText2);
      if (blob) {
        onSticker({
          blob,
          name: customText.trim() ? `${stk.name} (${customText.trim()})` : stk.name,
          frames,
          fps: FPS,
          fw: Math.round(stk.fw * HD_SCALE),
          fh: Math.round(stk.fh * HD_SCALE),
          loop: effectiveLoop,
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
      if (!sfxLib.length) return;
const p = sfxLib[Math.floor(Math.random() * sfxLib.length)];
      setCatS('Todos');
      setSelS(p.id);
      setTune(Math.round(Math.random() * 12 - 6));
      setVol(0.75 + Math.round(Math.random() * 40) / 100);
      void previewAudio(p);
    } else {
      const p = STICKERS[Math.floor(Math.random() * STICKERS.length)];
      setCatK('Todos');
      selectSticker(p.id);
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
    setProg(0);
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    if (!isPlaying && prog >= 0.99 && !effectiveLoop) {
      setProg(0);
    }
    setIsPlaying((p) => !p);
  };

  const sl = 'sfxlib-range w-full';
  const activeCat = tab === 'sfx' ? catS : catK;
  const setActiveCat = tab === 'sfx' ? setCatS : setCatK;
  const baseCats = tab === 'sfx' ? sfxCats : STICKER_CATS;
const catFilteredList = (() => {
const q = catQuery.trim().toLowerCase();
const all = ['Todos', ...baseCats];
return q ? all.filter((c) => c.toLowerCase().includes(q)) : all;
})();

  const renderCatBadgeIcon = (catName: string, active = false) => {
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

  return createPortal(
    <div className="fixed inset-0 z-[215] flex items-end justify-center bg-black/85 backdrop-blur-sm lg:items-center lg:p-4">
      <style>{`
        .sfxlib-scroll{scrollbar-width:thin;scrollbar-color:#6366f1 #081224}
        .sfxlib-scroll::-webkit-scrollbar{width:6px;height:6px}
        .sfxlib-scroll::-webkit-scrollbar-track{background:#081224;border-radius:8px}
        .sfxlib-scroll::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#22d3ee,#a855f7);border-radius:8px}
        .sfxlib-no-bar::-webkit-scrollbar{display:none}
        .sfxlib-no-bar{-ms-overflow-style:none;scrollbar-width:none}
        .sfxlib-range{-webkit-appearance:none;appearance:none;height:5px;border-radius:99px;background:#11223b;border:1px solid #1e3759;outline:none;cursor:pointer}
        .sfxlib-range::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#67e8f9,#22d3ee);border:2px solid #061020;cursor:pointer;box-shadow:0 0 10px rgba(34,211,238,.8)}
        .sfxlib-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#22d3ee;border:2px solid #061020;cursor:pointer}
        @keyframes sfxlibSheet{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
      `}</style>

      <div
        className="flex h-[95dvh] w-full max-w-[1220px] flex-col overflow-hidden rounded-t-2xl border-t-2 border-x-2 border-transparent shadow-2xl lg:h-[88vh] lg:max-h-[840px] lg:rounded-2xl lg:border-2"
        style={{
          background: 'linear-gradient(#060e1f,#050b18) padding-box, linear-gradient(135deg,#22d3ee,#8b5cf6,#ec4899) border-box',
          animation: 'sfxlibSheet 220ms cubic-bezier(.16,1,.3,1)',
        }}
      >
        {/* ====================================================================
            HEADER PRINCIPAL
        ==================================================================== */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#192f4f] bg-gradient-to-r from-[#091529] via-[#0e1630] to-[#17102e] px-3.5 py-2.5 sm:flex-nowrap sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 via-sky-400 to-fuchsia-500 text-[#050c1a] shadow-lg shadow-cyan-500/25">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="h-5 w-5">
                <path d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" />
              </svg>
            </span>
            <div className="min-w-0 leading-none">
              <h2 className="truncate text-[16px] font-black tracking-tight text-white sm:text-[18px]">
                Generador de <span className="bg-gradient-to-r from-cyan-300 via-violet-300 to-fuchsia-400 bg-clip-text text-transparent">Medios</span>
              </h2>
              <p className="mt-1 truncate text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400 sm:text-[9px]">
                Stickers TikTok & sfxLib HD · 100% local
              </p>
            </div>
          </div>

          {/* Controles derecha */}
          <div className="flex shrink-0 items-center gap-2 sm:order-3">
            <button
              onClick={() => setMuted((m) => !m)}
              className={cx(
                'flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-bold transition active:scale-95',
                muted
                  ? 'border-rose-400/70 bg-rose-500/20 text-rose-200'
                  : 'border-[#254269] bg-[#0a172b] text-slate-200 hover:border-cyan-400/60'
              )}
              title="Silenciar previsualización de audio"
            >
              <span>{muted ? '🔇' : '🔊'}</span>
              <span className="hidden md:inline">{muted ? 'Silenciado' : 'Audio'}</span>
            </button>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#254269] bg-[#0a172b] text-[13px] font-black text-slate-300 transition hover:border-slate-400 hover:text-white active:scale-95"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          {/* Tabs Stickers / Sonidos */}
          <div className="order-3 grid w-full grid-cols-2 rounded-xl border border-[#26436b] bg-[#081326] p-1 sm:order-2 sm:flex sm:w-auto">
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
                  'min-h-[32px] rounded-lg px-4 py-1 text-[12px] font-black transition sm:min-h-[34px]',
                  tab === t
                    ? 'border border-fuchsia-400/50 bg-gradient-to-r from-violet-600/45 to-fuchsia-600/35 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ====================================================================
            CUERPO PRINCIPAL: 3 COLUMNAS EN DESKTOP / FLUJO MÓVIL OPTIMIZADO
        ==================================================================== */}
        <div className="sfxlib-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 pt-0 lg:grid lg:grid-cols-[212px_minmax(0,1fr)_395px] lg:gap-3.5 lg:overflow-hidden lg:p-3.5">
          {/* ==================================================================
              1. SIDEBAR IZQUIERDO DE CATEGORÍAS (Desktop)
          ================================================================== */}
          <aside className="hidden min-h-0 flex-col overflow-hidden rounded-2xl border border-[#192f4f] bg-[#071122] p-3 lg:flex">
         <div className="shrink-0">
           <div className="mb-2 flex items-baseline justify-between gap-2 px-2">
             <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Categorías</p>
             <span className="shrink-0 font-mono text-[9px] font-bold text-cyan-400/70">{baseCats.length}</span>
           </div>
           <div className="relative mb-2">
             <input
               type="text"
               value={catQuery}
               onChange={(e) => setCatQuery(e.target.value)}
               placeholder="Filtrar categoría…"
               className="h-8 w-full rounded-lg border border-[#223f63] bg-[#091527] pl-8 pr-7 text-[11px] text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400"
             />
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-500" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
             {catQuery && (
               <button type="button" onClick={() => setCatQuery('')} className="absolute right-2 top-1.5 rounded px-1 text-[11px] font-bold text-slate-400 transition hover:text-white" title="Limpiar filtro">✕</button>
             )}
           </div>
         </div>
         <div className="sfxlib-scroll -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
           <nav className="space-y-1">
             {catFilteredList.map((cat) => {
               const active = activeCat === cat;
               return (
                 <button
                   key={cat}
                   onClick={() => setActiveCat(cat)}
                   title={cat + ' · ' + (catCounts[cat] ?? 0) + ' elementos'}
                   className={cx(
                     'flex w-full items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5 text-left text-[11.5px] font-bold transition',
                     active
                       ? 'border-fuchsia-400/60 bg-gradient-to-r from-violet-600/25 to-cyan-500/15 text-white shadow-[0_0_14px_rgba(168,85,247,0.2)]'
                       : 'border-transparent text-slate-300 hover:bg-[#0d1c34] hover:text-white'
                   )}
                 >
                   <span className="flex min-w-0 items-center gap-2">
                     {renderCatBadgeIcon(cat, active)}
                     <span className="truncate">{cat}</span>
                   </span>
                   <span className={cx('shrink-0 font-mono text-[10px]', active ? 'text-cyan-300' : 'text-slate-500')}>
                     {catCounts[cat] ?? 0}
                   </span>
                 </button>
               );
             })}
             {catFilteredList.length === 0 && (
               <p className="px-2 py-5 text-center text-[11px] leading-relaxed text-slate-500">Ninguna categoría coincide con "{catQuery}".</p>
             )}
           </nav>
           <div className="my-2.5 border-t border-[#162a47]" />
           <nav className="space-y-1 pb-1">
             {(['Favoritos', 'Recientes'] as const).map((special) => {
               const active = activeCat === special;
               return (
                 <button
                   key={special}
                   onClick={() => setActiveCat(special)}
                   title={special}
                   className={cx(
                     'flex w-full items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5 text-left text-[11.5px] font-bold transition',
                     active
                       ? 'border-fuchsia-400/60 bg-gradient-to-r from-violet-600/25 to-cyan-500/15 text-white'
                       : 'border-transparent text-slate-300 hover:bg-[#0d1c34] hover:text-white'
                   )}
                 >
                   <span className="flex min-w-0 items-center gap-2">
                     {renderCatBadgeIcon(special, active)}
                     <span className="truncate">{special}</span>
                   </span>
                   <span className={cx('shrink-0 font-mono text-[10px]', active ? 'text-cyan-300' : 'text-slate-500')}>
                     {catCounts[special] ?? 0}
                   </span>
                 </button>
               );
             })}
           </nav>
         </div>
         {/* Tarjeta inferior 100% LOCAL */}
            <div className="mt-2 shrink-0 rounded-xl border border-violet-500/30 bg-gradient-to-br from-[#121633] to-[#0a1326] p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-black text-fuchsia-300">
                <span>⚡</span>
                <span>TUS ARCHIVOS, LOCAL</span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                Stickers generados en tu navegador. Tus archivos nunca salen de esta pestaña.
              </p>
            </div>
          </aside>

          {/* ==================================================================
              2. PANEL DERECHO: VISTA PREVIA + PERSONALIZAR
              (En móvil va primero order-1 para preview grande inmediata)
          ================================================================== */}
          <div className="sfxlib-scroll contents lg:order-3 lg:flex lg:min-h-0 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:pr-0.5">
            {/* TARJETA SUPERIOR: VISTA PREVIA */}
         <div className="sticky top-0 z-30 order-1 -mx-3 bg-[#050b18]/95 px-3 pb-3 pt-3 backdrop-blur-md lg:static lg:z-auto lg:order-none lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
         <div className="rounded-2xl border border-[#192f4f] bg-[#071224] p-2.5 lg:p-3">
              <div className="mb-2 hidden w-full items-center justify-between lg:flex">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Vista Previa</span>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#0e203b] px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-300">
                    {tab === 'sfx'
                      ? `WAV 44.1kHz · ${sfxDuration(sfx).toFixed(2)}s`
                      : `HD ${Math.round(stk.fw * HD_SCALE)}×${Math.round(stk.fh * HD_SCALE)}`}
                  </span>
                  {tab === 'sticker' && (
                    <button
                      type="button"
                      onClick={() => setExpandedPrev((e) => !e)}
                      title={expandedPrev ? 'Reducir vista previa' : 'Ampliar vista previa'}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-[#244269] bg-[#0b1930] text-[11px] text-slate-300 transition hover:border-cyan-400 hover:text-white"
                    >
                      {expandedPrev ? '🗗' : '⛶'}
                    </button>
                  )}
                </div>
              </div>

              {tab === 'sticker' ? (
             <div className="flex w-full flex-col gap-2.5">
               <div
                 className={cx(
                   'relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-[#1c3557] p-2 transition-all duration-200',
                   expandedPrev
                     ? 'h-[58vw] max-h-[340px] lg:h-64 lg:max-h-none'
                     : 'h-[38vw] max-h-[200px] min-h-[136px] lg:h-44 lg:min-h-0 lg:max-h-none'
                 )}
                 style={{ background: 'repeating-conic-gradient(#15233b 0% 25%, #0c1627 0% 50%) 0 0/16px 16px' }}
               >
                 <canvas ref={prevRef} className="mx-auto block max-h-full max-w-full object-contain" />
                 <button
                   type="button"
                   onClick={() => setExpandedPrev((e) => !e)}
                   title={expandedPrev ? 'Reducir vista previa' : 'Ampliar vista previa'}
                   aria-label="Ampliar o reducir vista previa"
                   className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md border border-[#244269] bg-[#0b1930]/90 text-[11px] text-slate-300 transition hover:border-cyan-400 hover:text-white active:scale-90"
                 >
                   {expandedPrev ? '🗗' : '⛶'}
                 </button>
               </div>
               <div className="flex w-full items-center gap-2 rounded-xl border border-[#172c47] bg-[#091629] px-2.5 py-2">
                 <button
                   type="button"
                   onClick={handleTogglePlay}
                   className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-500/15 text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-500/30 active:scale-90"
                   title={isPlaying ? 'Pausar' : 'Reproducir'}
                   aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                 >
                   {isPlaying ? (
                     <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="M6 5h4v14H6zm8 0h4v14h-4z" /></svg>
                   ) : (
                     <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4"><path d="M8 5v14l11-7z" /></svg>
                   )}
                 </button>
                 <input
                   type="range"
                   min={0}
                   max={1}
                   step={0.005}
                   value={prog}
                   onChange={(e) => { setIsPlaying(false); setProg(+e.target.value); }}
                   className="sfxlib-range min-w-0 flex-1"
                   aria-label="Progreso de animación"
                 />
                 <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                   {(prog * dur).toFixed(1)}s / {dur.toFixed(1)}s
                 </span>
                 <button
                   type="button"
                   onClick={() => setLoop((l) => !l)}
                   className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold"
                   title={effectiveLoop ? 'Bucle activado' : 'Reproducir una sola vez'}
                   aria-label="Alternar bucle"
                 >
                   <span className={cx('relative inline-flex h-4 w-7 items-center rounded-full transition-colors', effectiveLoop ? 'bg-cyan-400' : 'bg-slate-700')}>
                     <span className={cx('inline-block h-3 w-3 transform rounded-full bg-[#050d1a] transition-transform', effectiveLoop ? 'translate-x-3.5' : 'translate-x-0.5')} />
                   </span>
                   <span className={cx('hidden min-[380px]:inline', effectiveLoop ? 'text-cyan-300' : 'text-slate-400')}>Bucle</span>
                 </button>
               </div>
             </div>
           ) : (
             <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1c3557] bg-[#0b192e] p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-black text-white">{sfx.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {sfx.cat} · {sfxDuration(sfx).toFixed(2)}s · Tono {tune > 0 ? `+${tune}` : tune} st
                    </p>
                    <div className="mt-2.5">
                      <SfxWaveform def={sfx} active={true} playing={playingAudioId === sfx.id} barsCount={34} tall={true} />
                    </div>
                  </div>
                  <button
                    onClick={() => void previewAudio(sfx)}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/30 active:scale-95"
                    title="Escuchar sonido"
                  >
                    {playingAudioId === sfx.id ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            </div>
         {/* TARJETA INFERIOR: PERSONALIZAR STICKER / AUDIO */}
            <div className="order-2 rounded-2xl border border-[#192f4f] bg-[#071224] p-3 lg:order-none">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                  {tab === 'sfx' ? 'Estudio de Audio' : 'Personalizar Sticker'}
                </span>
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1 rounded-lg border border-[#244269] bg-[#0b1930] px-2 py-1 text-[10px] font-bold text-slate-300 transition hover:border-cyan-400 hover:text-white active:scale-95"
                >
                  <span>↺</span>
                  <span>Restablecer</span>
                </button>
              </div>

              <div className="space-y-3">
                {tab === 'sfx' ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Volumen<span className="font-mono text-cyan-300">{Math.round(vol * 100)}%</span>
                      </span>
                      <input type="range" min={0} max={1.5} step={0.01} value={vol} onChange={(e) => setVol(+e.target.value)} className={sl} />
                    </label>
                    <label className="block">
                      <span className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Tono<span className="font-mono text-cyan-300">{tune > 0 ? '+' : ''}{tune} st</span>
                      </span>
                      <input type="range" min={-12} max={12} step={1} value={tune} onChange={(e) => setTune(+e.target.value)} className={sl} />
                    </label>
                  </div>
                ) : (
                  <>
                    {/* Campos de texto con selector de emoticones */}
                    {stk.defaultText !== undefined && (
                      <div className={cx('grid gap-2', stk.defaultText2 !== undefined ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1')}>
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

                    {/* Color principal */}
                    <div>
                      <span className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">Color principal</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {ACCENTS.map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAccent(a)}
                            className={cx(
                              'h-7 w-7 shrink-0 rounded-full border-2 transition hover:scale-110',
                              accent === a ? 'scale-110 border-white shadow-[0_0_10px_rgba(255,255,255,0.55)]' : 'border-slate-700'
                            )}
                            style={{ background: a }}
                            title={a}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => colorInputRef.current?.click()}
                          title="Color personalizado"
                          className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#2a4d78] bg-[#0b1a30] text-[12px] text-slate-300 transition hover:border-cyan-400 hover:text-white"
                        >
                          🖋
                          <input
                            ref={colorInputRef}
                            type="color"
                            value={accent}
                            onChange={(e) => setAccent(e.target.value)}
                            className="sr-only"
                          />
                        </button>
                      </div>
                    </div>

                    {/* Tamaño en pantalla + Duración en 2 columnas */}
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Tamaño<span className="font-mono text-cyan-300">{size}%</span>
                        </span>
                        <input type="range" min={10} max={90} step={1} value={size} onChange={(e) => setSize(+e.target.value)} className={sl} />
                      </label>

                      <label className="block">
                        <span className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Duración<span className="font-mono text-cyan-300">{dur.toFixed(1)}s · {frames}f</span>
                        </span>
                        <input type="range" min={0.5} max={5} step={0.1} value={dur} onChange={(e) => setDur(+e.target.value)} className={sl} />
                      </label>
                    </div>

                    {/* Fila inferior compacta: Posición cuadrada + Fade In / Fade Out */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#172c47] bg-[#091629] p-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="grid h-[74px] w-[74px] shrink-0 grid-cols-3 grid-rows-3 place-items-center gap-1 rounded-xl border border-[#294a73] bg-[#060f1f] p-1.5"
                          aria-label="Posición inicial"
                        >
                          {POS_POINTS.map((pt) => (
                            <button
                              key={pt.id}
                              type="button"
                              onClick={() => setPosId(pt.id)}
                              title={pt.label}
                              className={cx(
                                'h-3 w-3 rounded-full transition-all',
                                posId === pt.id
                                  ? 'scale-125 bg-fuchsia-400 ring-2 ring-fuchsia-300/40 shadow-[0_0_8px_#e879f9]'
                                  : 'bg-slate-700 hover:bg-cyan-400/80'
                              )}
                            />
                          ))}
                        </div>
                        <div className="leading-tight">
                          <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Posición</span>
                          <span className="mt-0.5 block text-[12px] font-black text-fuchsia-300">{xy.label}</span>
                          <button
                            type="button"
                            onClick={() => setLoop((l) => !l)}
                            className="mt-1.5 rounded-lg border border-[#25456b] bg-[#0d1e36] px-2 py-1 text-[10px] font-bold text-slate-200 transition hover:border-cyan-400"
                          >
                            {effectiveLoop ? '🔁 En bucle' : '➡️ Una vez'}
                          </button>
                        </div>
                      </div>

                      <div className="min-w-[140px] flex-1 space-y-2">
                        <label className="block">
                          <span className="mb-0.5 flex justify-between text-[9px] font-bold uppercase text-slate-400">
                            Fade in<span className="font-mono text-cyan-300">{fadeIn.toFixed(1)}s</span>
                          </span>
                          <input type="range" min={0} max={1.5} step={0.1} value={fadeIn} onChange={(e) => setFadeIn(+e.target.value)} className={sl} />
                        </label>
                        <label className="block">
                          <span className="mb-0.5 flex justify-between text-[9px] font-bold uppercase text-slate-400">
                            Fade out<span className="font-mono text-cyan-300">{fadeOut.toFixed(1)}s</span>
                          </span>
                          <input type="range" min={0} max={1.5} step={0.1} value={fadeOut} onChange={(e) => setFadeOut(+e.target.value)} className={sl} />
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {tab === 'sfx' && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        Fade in<span className="font-mono text-cyan-300">{fadeIn.toFixed(1)}s</span>
                      </span>
                      <input type="range" min={0} max={1.5} step={0.1} value={fadeIn} onChange={(e) => setFadeIn(+e.target.value)} className={sl} />
                    </label>
                    <label className="block">
                      <span className="mb-1 flex justify-between text-[9px] font-bold uppercase text-slate-400">
                        Fade out<span className="font-mono text-cyan-300">{fadeOut.toFixed(1)}s</span>
                      </span>
                      <input type="range" min={0} max={1.5} step={0.1} value={fadeOut} onChange={(e) => setFadeOut(+e.target.value)} className={sl} />
                    </label>
                  </div>
                )}

                {/* Fila final de botones: Al azar + Agregar */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={randomize}
                    className="flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-violet-400/50 bg-violet-500/15 px-3.5 text-[11px] font-black text-violet-200 transition hover:bg-violet-500/25 active:scale-95"
                  >
                    <span>🎲</span>
                    <span>Al azar</span>
                  </button>

                  <button
                    type="button"
                    onClick={tab === 'sfx' ? insertSfx : insertSticker}
                    disabled={busy || (tab === 'sfx' && !sfx.id)}
                    className="hidden min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 px-3 text-[12px] font-black text-[#040b17] shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50 lg:flex"
                  >
                    {busy ? 'Renderizando HD…' : tab === 'sfx' ? '➕ Agregar a pista de audio' : '➕ Agregar a pista de imagen'}
                  </button>
                </div>

                <p className="hidden text-center text-[9px] text-slate-500 lg:block">
                  {tab === 'sfx'
                    ? 'Audio profesional royalty-free · Sin tono ni volumen se entrega el MP3 original'
                    : `${frames} frames PNG alfa (${Math.round(stk.fw * HD_SCALE)}×${Math.round(stk.fh * HD_SCALE)}px) · Lienzo ${refW}×${refH}`}
                </p>
              </div>
            </div>
          </div>

          {/* ==================================================================
              3. CATÁLOGO CENTRAL (Tarjetas visuales grandes con favorito)
          ================================================================== */}
          <div className="order-3 flex min-w-0 flex-col rounded-2xl border border-[#192f4f] bg-[#071122] p-3 lg:order-2 lg:min-h-0">
            {/* Barra de búsqueda + Ordenar */}
            <div className="mb-2.5 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tab === 'sfx' ? 'Buscar sonido (ej. pop, whoosh, boing)...' : 'Buscar sticker (ej. corazones, pov, fuego)...'}
                  className="h-9 w-full rounded-xl border border-[#223f63] bg-[#091527] pl-9 pr-8 text-[12px] text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-400"
                />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-2 rounded px-1 text-[11px] font-bold text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
                {tab === 'sfx' && sfxList.length > sfxLimit && (
                  <button
                    type="button"
                    onClick={() => setSfxLimit((n) => n + 60)}
                    className="h-10 shrink-0 rounded-xl border border-cyan-400/50 bg-cyan-500/10 px-3 text-[11px] font-black text-cyan-200 transition hover:bg-cyan-500/20 active:scale-95 sm:h-9"
                    title={'Mostrando ' + Math.min(sfxLimit, sfxList.length) + ' de ' + sfxList.length}
                  >
                    +60
                  </button>
                )}

                {/* En móvil priorizamos el filtro por categoría; ordenar queda disponible en escritorio. */}
                <div className="relative min-w-0 flex-1 sm:hidden">
                  <select
                    value={activeCat}
                    onChange={(e) => setActiveCat(e.target.value)}
                    aria-label="Filtrar por categoría"
                    className="h-10 w-full appearance-none rounded-xl border border-cyan-400/35 bg-[#0b1a2e] px-3 pr-9 text-[12px] font-bold text-slate-100 outline-none transition focus:border-cyan-400"
                  >
                    {['Todos', ...baseCats, 'Favoritos', 'Recientes'].map((c) => (
                      <option key={c} value={c}>{c === 'Todos' ? 'Categoría · Todos' : c}</option>
                    ))}
                  </select>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-cyan-300">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortMode)}
                  aria-label="Ordenar elementos"
                  className="hidden h-9 min-w-[132px] rounded-xl border border-[#223f63] bg-[#091527] px-2.5 text-[11px] font-bold text-slate-200 outline-none transition focus:border-cyan-400 sm:block"
                >
                  <option value="default">Ordenar</option>
                  <option value="az">Nombre A-Z</option>
                  <option value="loop">{tab === 'sfx' ? 'Más largos' : 'Bucle primero'}</option>
                  <option value="once">{tab === 'sfx' ? 'Más cortos' : 'Animado primero'}</option>
                </select>
              </div>
            </div>

            {/* Grilla visual de tarjetas */}
            <div className="sfxlib-scroll grid auto-rows-min content-start grid-cols-2 gap-2.5 pr-0.5 sm:grid-cols-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              {tab === 'sticker' ? (
                stkList.length > 0 ? (
                  stkList.map((s) => {
                    const isSel = selK === s.id;
                    const isFav = favs.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => selectSticker(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') selectSticker(s.id);
                        }}
                        className={cx(
                          'group relative flex h-[152px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border p-2 text-left transition active:scale-[0.99]',
                          isSel
                            ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/15 to-[#0b182d] shadow-[0_0_18px_rgba(34,211,238,0.24)]'
                            : 'border-[#1b3354] bg-[#091629]/90 hover:border-[#315b8e] hover:bg-[#0d1e36]'
                        )}
                      >
                        {/* Banner ajedrezado superior */}
                        <div
                          className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] p-2"
                          style={{ background: 'repeating-conic-gradient(#15233b 0% 25%, #0c1627 0% 50%) 0 0/12px 12px' }}
                        >
                          <StickerCardPreview def={s} accent={accent} />

                          {/* Botón favorito único */}
                          <button
                            type="button"
                            onClick={(e) => toggleFav(s.id, e)}
                            title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                            aria-label="Favorito"
                            className={cx(
                              'absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border text-[12px] transition active:scale-90',
                              isFav
                                ? 'border-pink-400/70 bg-pink-500/25 text-pink-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                                : 'border-white/10 bg-[#071122]/75 text-slate-400 opacity-80 hover:border-pink-400/50 hover:text-pink-300 group-hover:opacity-100'
                            )}
                          >
                            {isFav ? '♥' : '♡'}
                          </button>
                        </div>

                        <div className="mt-2 flex h-10 shrink-0 flex-col justify-center px-0.5">
                          <p className="truncate text-[12px] font-extrabold text-slate-100">{s.name}</p>
                          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                            {s.cat} · {s.loop ? 'Bucle' : 'Animado'}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="col-span-full py-10 text-center text-[12px] text-slate-500">
                    No hay stickers en esta vista.
                  </p>
                )
              ) : sfxList.length > 0 ? (
                sfxList.slice(0, sfxLimit).map((s) => {
                  const isSel = selS === s.id;
                  const isPlay = playingAudioId === s.id;
                  const isFav = favs.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelS(s.id);
                        void previewAudio(s);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setSelS(s.id);
                          void previewAudio(s);
                        }
                      }}
                      className={cx(
                        'group relative flex h-[152px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border p-2 text-left transition active:scale-[0.99]',
                        isSel
                          ? 'border-cyan-400 bg-gradient-to-b from-cyan-500/15 to-[#0b182d] shadow-[0_0_18px_rgba(34,211,238,0.24)]'
                          : 'border-[#1b3354] bg-[#091629]/90 hover:border-[#315b8e] hover:bg-[#0d1e36]'
                      )}
                    >
                      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-lg border border-[#192f4d] bg-gradient-to-b from-[#08132a] to-[#050d1c] px-2">
                     <SfxWaveform def={s} active={isSel} playing={isPlay} barsCount={26} tall />
                     <span className="pointer-events-none absolute bottom-1.5 left-2 rounded bg-[#040b17]/85 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300/90">{sfxDuration(s).toFixed(2)}s</span>
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
                   <div className="mt-2 flex h-10 shrink-0 items-center gap-2 px-0.5">
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
                   </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full flex flex-col items-center gap-3 py-10 text-center">
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
             </div>
              )}
            </div>
          </div>
        </div>


        {/* ====================================================================
            BARRA INFERIOR FIJA EN CELULAR (< lg)
        ==================================================================== */}
        <div className="shrink-0 border-t border-cyan-500/20 bg-[#060f1e]/95 px-3 py-2.5 backdrop-blur-md lg:hidden">
          <button
            type="button"
            onClick={tab === 'sfx' ? insertSfx : insertSticker}
            disabled={busy || (tab === 'sfx' && !sfx.id)}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-fuchsia-500 py-3 text-[12px] font-black text-[#040b17] shadow-lg shadow-cyan-500/25 transition active:scale-[0.99] disabled:opacity-50"
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