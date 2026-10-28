'use client';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toBlobURL } from '@ffmpeg/util';
import { putAsset, getAsset, saveProject, loadProject, clearProject, StoredProject } from '@/lib/projectStore';
import { IconVideo, IconImage, IconText, IconAudio, IconUndo, IconRedo, IconScissors, IconTrash, IconCrop, IconFit, IconPlay, IconPause, IconSkipBack, IconSkipForward, IconSparkles, IconPlayCorel, IconPauseCorel, Icon480p, IconSuperponer } from './icons';

type TransitionType =
  | 'none' | 'fade' | 'dissolve' | 'fadeblack' | 'fadewhite' | 'fadegrays' | 'fadefast' | 'fadeslow'
  | 'pixelize' | 'hblur' | 'distance'
  | 'wipeleft' | 'wiperight' | 'wipeup' | 'wipedown' | 'wipetl' | 'wipetr' | 'wipebl' | 'wipebr'
  | 'hlslice' | 'hrslice' | 'vuslice' | 'vdslice'
  | 'squeezeh' | 'squeezev'
  | 'slideleft' | 'slideright' | 'slideup' | 'slidedown'
  | 'smoothleft' | 'smoothright' | 'smoothup' | 'smoothdown'
  | 'coverleft' | 'coverright' | 'coverup' | 'coverdown'
  | 'circleopen' | 'circleclose' | 'circlecrop' | 'rectcrop' | 'radial'
  | 'vertopen' | 'vertclose' | 'horzopen' | 'horzclose'
  | 'diagtl' | 'diagtr' | 'diagbl' | 'diagbr'
  | 'zoomin';

type Clip = {
  id: string; assetId: string; name: string; url: string; duration: number; trimStart: number; trimEnd: number;
  rotate: 0 | 90 | 180 | 270; speed: number; fadeIn: number; fadeOut: number; muted: boolean;
  cropX: number; cropY: number;
  hasAudio?: boolean;
  transition?: { type: TransitionType; duration: number };
};
type ImageOverlay = {
  id: string; assetId: string; name: string; url: string; start: number; end: number;
  x: number; y: number; size: number; rotate: 0 | 90 | 180 | 270; fadeIn: number; fadeOut: number;
};

type OverlayShape = 'none' | 'round' | 'circle';
type VideoOverlay = {
id: string; assetId: string; name: string; url: string;
start: number; end: number; offset: number;
x: number; y: number; size: number; rotate: 0 | 90 | 180 | 270;
fadeIn: number; fadeOut: number; muted: boolean; shape: OverlayShape; hasAudio?: boolean; srcW?: number; srcH?: number;
};

type TextOverlay = {
  id: string; text: string; start: number; end: number; x: number; y: number; size: number; bold: boolean;
  font: 'sans' | 'serif' | 'mono' | 'roboto' | 'playfair' | 'montserrat' | 'opensans' | 'lato' | 'oswald' | 'raleway' | 'poppins' | 'merriweather' | 'nunito';
  color: string; fadeIn: number; fadeOut: number;
};
type AudioTrack = {
  id: string; assetId: string; name: string; url: string; duration: number; offset: number; start: number;
  volume: number; fadeIn: number; fadeOut: number; muted: boolean; peaks: number[]; sourceVideoId?: string;
};
type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';
type Resolution = '480p' | '720p' | '1080p' | '4K';
type ExportFormat = 'mp4' | 'mov' | 'mkv';
type Quality = 'fast' | 'balanced' | 'high';
type FitMode = 'adaptar' | 'recortar';
type ExportSettings = {
  ratio: AspectRatio; resolution: Resolution; format: ExportFormat;
  quality: Quality; filename: string; fit: FitMode;
};
type ExportProgress = { phase: 'preparing' | 'rendering' | 'packaging' | 'done'; percent: number; speed: number } | null;

const BETA_PLUS_UNLOCK = true;
const DEFAULT_PPS = 60;
const MIN_PPS = 12;
const MAX_PPS = 300;
const MIN_LEN = 0.2;
const MIN_OVERLAY_LEN = 0.3;
const DRAG_THRESHOLD = 5;
const WAVEFORM_SAMPLES = 150;
const HISTORY_LIMIT = 60;
const PREVIEW_PROXY_HEIGHT = 360;
const IS_MOBILE = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
const UI_HZ = IS_MOBILE ? 15 : 30;

// ===== GENERADOR DE MÁSCARAS DE FORMA PARA OVERLAYS =====
async function generateShapeMask(shape: OverlayShape, width: number, height: number): Promise<Blob | null> {
const canvas = document.createElement('canvas');
canvas.width = width; canvas.height = height;
const ctx = canvas.getContext('2d');
if (!ctx) return null;
ctx.clearRect(0, 0, width, height);
ctx.fillStyle = 'white';
if (shape === 'circle') {
ctx.beginPath(); ctx.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2); ctx.fill();
} else {
const r = Math.min(width, height) * 0.1;
ctx.beginPath();
ctx.moveTo(r, 0); ctx.lineTo(width - r, 0); ctx.quadraticCurveTo(width, 0, width, r);
ctx.lineTo(width, height - r); ctx.quadraticCurveTo(width, height, width - r, height);
ctx.lineTo(r, height); ctx.quadraticCurveTo(0, height, 0, height - r);
ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
ctx.closePath(); ctx.fill();
}
return new Promise((resolve) => { canvas.toBlob((b) => resolve(b), 'image/png'); });
}

const proxyUrlMap = new Map<string, string>();
function initialProxies(): boolean {
  if (typeof window === 'undefined') return IS_MOBILE;
  try {
    const saved = window.localStorage.getItem('clipedia:proxies');
    if (saved === 'on') return true;
    if (saved === 'off') return false;
  } catch (e) {}
  return IS_MOBILE;
}
let proxiesEnabled = initialProxies();
function previewSrc(c: Clip) { return (proxiesEnabled && proxyUrlMap.get(c.assetId)) || c.url; }

const TRANSITION_TYPES: { id: TransitionType; label: string; icon: string }[] = [
  { id: 'none', label: 'Sin transición', icon: '⊘' },
  { id: 'fade', label: 'Fade', icon: '🌫️' },
  { id: 'dissolve', label: 'Disolver', icon: '💧' },
  { id: 'fadeblack', label: 'Fundido negro', icon: '⬛' },
  { id: 'fadewhite', label: 'Fundido blanco', icon: '⬜' },
  { id: 'fadegrays', label: 'Fundido grises', icon: '🩶' },
  { id: 'pixelize', label: 'Pixelado', icon: '🟪' },
  { id: 'hblur', label: 'Blur', icon: '🌁' },
  { id: 'wipeleft', label: 'Barrido izq', icon: '◀️' },
  { id: 'wiperight', label: 'Barrido der', icon: '▶️' },
  { id: 'wipeup', label: 'Barrido arriba', icon: '⬆️' },
  { id: 'wipedown', label: 'Barrido abajo', icon: '⬇️' },
  { id: 'hlslice', label: 'Persianas H', icon: '🪟' },
  { id: 'vuslice', label: 'Persianas V', icon: '🪟' },
  { id: 'squeezeh', label: 'Granero H', icon: '🚪' },
  { id: 'squeezev', label: 'Granero V', icon: '🚪' },
  { id: 'slideleft', label: 'Deslizar izq', icon: '⏪' },
  { id: 'slideright', label: 'Deslizar der', icon: '⏩' },
  { id: 'slideup', label: 'Deslizar arriba', icon: '🔼' },
  { id: 'slidedown', label: 'Deslizar abajo', icon: '🔽' },
  { id: 'smoothleft', label: 'Suave izq', icon: '🛝' },
  { id: 'smoothright', label: 'Suave der', icon: '🛝' },
  { id: 'circleopen', label: 'Círculo abre', icon: '⭕' },
  { id: 'circleclose', label: 'Círculo cierra', icon: '🔵' },
  { id: 'circlecrop', label: 'Recorte círculo', icon: '🎯' },
  { id: 'rectcrop', label: 'Recorte rect', icon: '📐' },
  { id: 'radial', label: 'Radial', icon: '🌀' },
  { id: 'zoomin', label: 'Zoom in', icon: '🔍' },
  { id: 'diagtl', label: 'Diagonal ↖', icon: '↖️' },
  { id: 'diagbr', label: 'Diagonal ↘', icon: '↘️' },
];

// Fusible: solo nombres que FFmpeg acepta en xfade. Cualquier otro → fade (evita crashes).
const XFADE_VALID = new Set<string>([
  'fade', 'dissolve', 'fadeblack', 'fadewhite', 'fadegrays', 'fadefast', 'fadeslow',
  'pixelize', 'hblur', 'distance',
  'wipeleft', 'wiperight', 'wipeup', 'wipedown', 'wipetl', 'wipetr', 'wipebl', 'wipebr',
  'hlslice', 'hrslice', 'vuslice', 'vdslice', 'squeezeh', 'squeezev',
  'slideleft', 'slideright', 'slideup', 'slidedown',
  'smoothleft', 'smoothright', 'smoothup', 'smoothdown',
  'coverleft', 'coverright', 'coverup', 'coverdown',
  'circleopen', 'circleclose', 'circlecrop', 'rectcrop', 'radial',
  'vertopen', 'vertclose', 'horzopen', 'horzclose',
  'diagtl', 'diagtr', 'diagbl', 'diagbr', 'zoomin',
]);

const RATIO_PRESETS: Record<AspectRatio, { w: number; h: number; label: string }> = {
  '16:9': { w: 1920, h: 1080, label: 'YouTube / Paisaje' },
  '9:16': { w: 1080, h: 1920, label: 'Reels / TikTok' },
  '1:1': { w: 1080, h: 1080, label: 'Feed cuadrado' },
  '4:3': { w: 1440, h: 1080, label: 'Clásico' },
};
const RESOLUTION_PRESETS: Record<Resolution, { factor: number; plus: boolean; label: string }> = {
  '480p': { factor: 480 / 1080, plus: false, label: '480p (SD)' },
  '720p': { factor: 720 / 1080, plus: false, label: '720p (HD)' },
  '1080p': { factor: 1.0, plus: true, label: '1080p (Full HD)' },
  '4K': { factor: 2.0, plus: true, label: '4K (Ultra HD)' },
};
const FORMAT_PRESETS: Record<ExportFormat, { video: string; audio: string; ext: string; label: string }> = {
  mp4: { video: 'libx264', audio: 'aac', ext: 'mp4', label: 'MP4 — Universal' },
  mov: { video: 'libx264', audio: 'aac', ext: 'mov', label: 'MOV — Pro / Apple' },
  mkv: { video: 'libx264', audio: 'aac', ext: 'mkv', label: 'MKV — Matroska' },
};
const QUALITY_PRESETS: Record<Quality, { preset: string; crf264: number; crfVp9: number; bitrate: string; label: string; desc: string }> = {
  fast: { preset: 'ultrafast', crf264: 26, crfVp9: 40, bitrate: '128k', label: 'Veloz', desc: 'Para borradores' },
  balanced: { preset: 'medium', crf264: 23, crfVp9: 32, bitrate: '192k', label: 'Equilibrada', desc: 'Recomendada' },
  high: { preset: 'slow', crf264: 18, crfVp9: 24, bitrate: '320k', label: 'Alta calidad', desc: 'Entrega final' },
};
const FONT_STACKS: Record<TextOverlay['font'], string> = {
  sans: '"Roboto", sans-serif', serif: '"Merriweather", serif', mono: '"Source Code Pro", monospace',
  roboto: '"Roboto", sans-serif', playfair: '"Playfair Display", serif', montserrat: '"Montserrat", sans-serif',
  opensans: '"Open Sans", sans-serif', lato: '"Lato", sans-serif', oswald: '"Oswald", sans-serif',
  raleway: '"Raleway", sans-serif', poppins: '"Poppins", sans-serif', merriweather: '"Merriweather", serif', nunito: '"Nunito", sans-serif',
};
const FONT_VARIANTS: Record<TextOverlay['font'], { regular: string; bold: string }> = {
  sans: { regular: '/fonts/Roboto-Regular.ttf', bold: '/fonts/Roboto-Bold.ttf' },
  serif: { regular: '/fonts/Merriweather-Regular.ttf', bold: '/fonts/Merriweather-Bold.ttf' },
  mono: { regular: '/fonts/SourceCodePro-Regular.ttf', bold: '/fonts/SourceCodePro-Bold.ttf' },
  roboto: { regular: '/fonts/Roboto-Regular.ttf', bold: '/fonts/Roboto-Bold.ttf' },
  playfair: { regular: '/fonts/PlayfairDisplay-Regular.ttf', bold: '/fonts/PlayfairDisplay-Bold.ttf' },
  montserrat: { regular: '/fonts/Montserrat-Regular.ttf', bold: '/fonts/Montserrat-Bold.ttf' },
  opensans: { regular: '/fonts/OpenSans-Regular.ttf', bold: '/fonts/OpenSans-Bold.ttf' },
  lato: { regular: '/fonts/Lato-Regular.ttf', bold: '/fonts/Lato-Bold.ttf' },
  oswald: { regular: '/fonts/Oswald-Regular.ttf', bold: '/fonts/Oswald-Bold.ttf' },
  raleway: { regular: '/fonts/Raleway-Regular.ttf', bold: '/fonts/Raleway-Bold.ttf' },
  poppins: { regular: '/fonts/Poppins-Regular.ttf', bold: '/fonts/Poppins-Bold.ttf' },
  merriweather: { regular: '/fonts/Merriweather-Regular.ttf', bold: '/fonts/Merriweather-Bold.ttf' },
  nunito: { regular: '/fonts/Nunito-Regular.ttf', bold: '/fonts/Nunito-Bold.ttf' },
};
const FONT_FACE_CSS = `@font-face { font-family: 'Roboto'; src: url('/fonts/Roboto-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Roboto'; src: url('/fonts/Roboto-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Merriweather'; src: url('/fonts/Merriweather-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Merriweather'; src: url('/fonts/Merriweather-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Source Code Pro'; src: url('/fonts/SourceCodePro-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Source Code Pro'; src: url('/fonts/SourceCodePro-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Playfair Display'; src: url('/fonts/PlayfairDisplay-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Playfair Display'; src: url('/fonts/PlayfairDisplay-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Montserrat'; src: url('/fonts/Montserrat-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Montserrat'; src: url('/fonts/Montserrat-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Open Sans'; src: url('/fonts/OpenSans-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Open Sans'; src: url('/fonts/OpenSans-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Lato'; src: url('/fonts/Lato-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Lato'; src: url('/fonts/Lato-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Oswald'; src: url('/fonts/Oswald-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Oswald'; src: url('/fonts/Oswald-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Raleway'; src: url('/fonts/Raleway-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Raleway'; src: url('/fonts/Raleway-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Poppins'; src: url('/fonts/Poppins-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Poppins'; src: url('/fonts/Poppins-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; } @font-face { font-family: 'Nunito'; src: url('/fonts/Nunito-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; } @font-face { font-family: 'Nunito'; src: url('/fonts/Nunito-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }`;

let counter = 0;
function uid() { counter += 1; return `clip-${Date.now()}-${counter}`; }
function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }
function effLen(c: Clip) { return (c.trimEnd - c.trimStart) / c.speed; }
function formatTime(t: number) {
  const m = Math.floor(t / 60); const s = Math.floor(t % 60); const d = Math.floor((t % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${d}`;
}
function locateVideo(t: number, list: Clip[], starts?: number[]) {
  const st = starts || (() => { const a: number[] = []; let x = 0; for (const c of list) { a.push(x); x += effLen(c); } return a; })();
  for (let i = 0; i < list.length; i++) {
    const len = effLen(list[i]);
    if (t < st[i] + len) {
      const localProj = t - st[i];
      const localFile = list[i].trimStart + localProj * list[i].speed;
      return { index: i, start: st[i], localProj, localFile };
    }
  }
  const last = list.length - 1;
  if (last >= 0) {
    const c = list[last]; const len = effLen(c);
    return { index: last, start: st[last], localProj: len, localFile: c.trimEnd };
  }
  return { index: -1, start: 0, localProj: 0, localFile: 0 };
}
function probeVideoMeta(url: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve({
      duration: Number.isFinite(v.duration) ? v.duration : 0,
      width: v.videoWidth || 0,
      height: v.videoHeight || 0,
    });
    v.onerror = () => resolve({ duration: 0, width: 0, height: 0 });
    v.src = url;
  });
}
function objectPositionFor(clip: Clip) {
  const { cropX, cropY, rotate } = clip;
  if (rotate === 90) return `${cropY * 100}% ${(1 - cropX) * 100}%`;
  if (rotate === 180) return `${(1 - cropX) * 100}% ${(1 - cropY) * 100}%`;
  if (rotate === 270) return `${(1 - cropY) * 100}% ${cropX * 100}%`;
  return `${cropX * 100}% ${cropY * 100}%`;
}
type AudioRawData = { channelData: Float32Array; sampleRate: number };
const audioDataMap = new Map<string, AudioRawData>();
function getPeaksForSegment(id: string, offset: number, duration: number, samples = WAVEFORM_SAMPLES): number[] {
  const data = audioDataMap.get(id);
  if (!data) return Array(samples).fill(0.1);
  const startSample = Math.floor(offset * data.sampleRate);
  const endSample = Math.min(Math.floor((offset + duration) * data.sampleRate), data.channelData.length);
  const segmentLength = endSample - startSample;
  if (segmentLength <= 0) return Array(samples).fill(0);
  const blockSize = Math.max(Math.floor(segmentLength / samples), 1);
  const peaks: number[] = [];
  for (let i = 0; i < samples; i++) {
    let max = 0;
    const blockStart = startSample + i * blockSize;
    const blockEnd = Math.min(blockStart + blockSize, endSample);
    for (let j = blockStart; j < blockEnd; j++) {
      const val = Math.abs(data.channelData[j] || 0);
      if (val > max) max = val;
    }
    peaks.push(max);
  }
  return peaks;
}
async function decodeAudioBlob(blob: Blob): Promise<{ channelData: Float32Array; sampleRate: number; duration: number } | null> {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const out = { channelData: buf.getChannelData(0), sampleRate: buf.sampleRate, duration: buf.duration };
    ctx.close();
    return out;
  } catch { return null; }
}
async function extractAudioFromVideo(videoUrl: string) {
  try {
    const response = await fetch(videoUrl);
    const arrayBuffer = await response.arrayBuffer();
    return await decodeAudioBlob(new Blob([arrayBuffer]));
  } catch (e) { console.error('Error extrayendo audio:', e); return null; }
}

// ===== FILMSTRIP: miniaturas de clips cacheadas por asset =====
const filmstripCache = new Map<string, string[]>();
function seekVideoTo(v: HTMLVideoElement, t: number) {
  return new Promise<void>((res) => {
    const onSeeked = () => { v.removeEventListener('seeked', onSeeked); res(); };
    v.addEventListener('seeked', onSeeked);
    v.currentTime = t;
  });
}
async function captureFilmstrip(url: string, duration: number): Promise<string[]> {
  const frames = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ? 12 : 20;
  const video = document.createElement('video');
  video.muted = true; video.playsInline = true; video.preload = 'auto';
  video.src = url;
  await new Promise<void>((res) => { video.onloadedmetadata = () => res(); video.onerror = () => res(); });
  if (!Number.isFinite(video.duration) || video.duration <= 0) { video.src = ''; return []; }
  const canvas = document.createElement('canvas');
  canvas.width = 96; canvas.height = 54;
  const ctx = canvas.getContext('2d');
  if (!ctx) { video.src = ''; return []; }
  const thumbs: string[] = [];
  const dur = Math.min(duration || video.duration, video.duration);
  for (let i = 0; i < frames; i++) {
    const t = (dur * (i + 0.5)) / frames;
    await seekVideoTo(video, t);
    ctx.drawImage(video, 0, 0, 96, 54);
    thumbs.push(canvas.toDataURL('image/jpeg', 0.6));
  }
  video.src = '';
  return thumbs;
}

type TrimDrag = { id: string; edge: 'start' | 'end'; startX: number; origStart: number; origEnd: number };
type MoveDrag = { id: string; startX: number; active: boolean };
type OverlayTimeDrag = { id: string; type: 'text' | 'image' | 'audio' | 'video'; mode: 'move' | 'start' | 'end'; startX: number; origStart: number; origEnd: number; origDuration?: number; origOffset?: number };
type PanDrag = { id: string; startX: number; startY: number; origX: number; origY: number };
type Toast = { id: number; msg: string; kind: 'info' | 'warn' };
type StageRect = { left: number; top: number; width: number; height: number };

function loadFFmpegLib(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.FFmpegWASM) return resolve(w.FFmpegWASM);
    const s = document.createElement('script');
    s.src = '/ffmpeg.js';
    s.onload = () => resolve(w.FFmpegWASM);
    s.onerror = () => reject(new Error('No se pudo cargar /ffmpeg.js'));
    document.head.appendChild(s);
  });
}

function WaveformCanvas({ id, offset, duration, width, selected }: { id: string; offset: number; duration: number; width: number; selected: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = Math.max(Math.round(width), 1);
    canvas.height = 48;
    ctx.clearRect(0, 0, canvas.width, 48);
    const peaks = getPeaksForSegment(id, offset, duration);
    const barWidth = canvas.width / peaks.length;
    peaks.forEach((peak, i) => {
      const height = peak * 40;
      const x = i * barWidth;
      const y = (48 - height) / 2;
      ctx.fillStyle = selected ? '#4ade80' : '#22c55e';
      ctx.fillRect(x, y, Math.max(barWidth - 1, 1), height);
    });
  }, [id, offset, duration, width, selected]);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

function ClipFilmstrip({ clip }: { clip: Clip }) {
  const thumbs = filmstripCache.get(clip.assetId);
  if (!thumbs || thumbs.length === 0) {
    return <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-violet-500/10" />;
  }
  const eff = effLen(clip);
  const stripWidthPct = (clip.duration / eff) * 100;
  const leftPct = -(clip.trimStart / eff) * 100;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-60">
      <div className="absolute top-0 bottom-0 flex" style={{ width: `${stripWidthPct}%`, left: `${leftPct}%` }}>
        {thumbs.map((src, i) => (
          <div key={i} className="h-full flex-1" style={{ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        ))}
      </div>
    </div>
  );
}

function TransitionPickerModal({ clip, onCancel, onApply }: { clip: Clip; onCancel: () => void; onApply: (type: TransitionType, duration: number) => void }) {
  const [picked, setPicked] = useState<TransitionType>(clip.transition?.type ?? 'none');
  const [dur, setDur] = useState<number>(clip.transition?.duration || 0.5);
  const [missing, setMissing] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
    const box = gridRef.current;
    if (!box) return;
    box.querySelectorAll('video').forEach((v) => {
      if (v.dataset.tid === picked) v.play().catch(() => {});
      else { v.pause(); v.currentTime = 0; }
    });
  }, [picked]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={onCancel}>
      <div className="flex max-h-[86vh] w-[min(94vw,30rem)] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-500/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-black text-white">Transiciones</h2>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white" title="Cerrar">✕</button>
        </div>
        <div ref={gridRef} className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3">
          {TRANSITION_TYPES.map((t) => {
            const isPicked = picked === t.id;
            const noVideo = missing.includes(t.id);
            return (
              <button key={t.id} onClick={() => setPicked(t.id)}
                onMouseEnter={(e) => { const v = e.currentTarget.querySelector('video'); if (v) v.play().catch(() => {}); }}
                onMouseLeave={(e) => { const v = e.currentTarget.querySelector('video'); if (v && picked !== t.id) { v.pause(); v.currentTime = 0; } }}
                className="group flex flex-col gap-1.5 outline-none">
                <div className={`relative overflow-hidden rounded-lg border-2 transition-all ${isPicked ? 'border-slate-200/90 shadow-lg shadow-slate-200/20 ring-2 ring-slate-200/40' : 'border-slate-700/60 group-hover:border-slate-500'}`}>
                  {noVideo ? (
                    <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-2xl">{t.icon}</div>
                  ) : (
                    <video data-tid={t.id} src={`/transitions/${t.id}.mp4`} muted loop playsInline preload="metadata"
                      onError={() => setMissing((m) => (m.includes(t.id) ? m : [...m, t.id]))}
                      className="aspect-video w-full object-cover" />
                  )}
                </div>
                <span className={`truncate text-center text-[11px] font-semibold ${isPicked ? 'text-cyan-300' : 'text-slate-400 group-hover:text-slate-200'}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-3 border-t border-slate-800 bg-slate-950/60 px-4 py-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">Duración</span>
              <span className="font-mono font-bold text-cyan-300">{dur.toFixed(1)}s</span>
            </div>
            <input type="range" min={0.1} max={2} step={0.1} value={dur} disabled={picked === 'none'}
              onChange={(e) => setDur(Number(e.target.value))}
              className="w-full accent-cyan-400 disabled:opacity-40" />
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:border-slate-500">Cancelar</button>
            <button onClick={() => onApply(picked, picked === 'none' ? 0 : dur)} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-4 py-2.5 text-sm font-black text-white transition-transform hover:scale-[1.02] active:scale-95">Aceptar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioElement({ track, onReady, onCleanup }: { track: AudioTrack; onReady: (id: string, el: HTMLAudioElement) => void; onCleanup: (id: string) => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { onReady(track.id, el); return () => { el.pause(); onCleanup(track.id); }; }
  }, [track.id, onReady, onCleanup]);
  useEffect(() => {
    const el = ref.current;
    if (el && el.src !== track.url) { el.src = track.url; el.load(); }
  }, [track.url]);
  return <audio ref={ref} src={track.url} preload="auto" className="hidden" />;
}

export default function Studio() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlay[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [videoOverlays, setVideoOverlays] = useState<VideoOverlay[]>([]);
  const [selectedVoId, setSelectedVoId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress>(null);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    ratio: '16:9', resolution: '1080p', format: 'mp4', quality: 'balanced',
    filename: `clipedia_export_${new Date().toISOString().slice(0, 10)}`,
    fit: 'adaptar',
  });
  const [stage, setStage] = useState<StageRect | null>(null);
  const [histVersion, setHistVersion] = useState(0);
  const [pps, setPps] = useState(DEFAULT_PPS);
  const [transitionPicker, setTransitionPicker] = useState<number | null>(null);
  const [previewTransitions, setPreviewTransitions] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
const [importOpen, setImportOpen] = useState(false);
const [proxiesOn, setProxiesOn] = useState(false);
  useEffect(() => { setProxiesOn(proxiesEnabled); }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const voInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const playheadRef = useRef(0);
  const clipsRef = useRef<Clip[]>([]);
  const imageOverlaysRef = useRef<ImageOverlay[]>([]);
  const textOverlaysRef = useRef<TextOverlay[]>([]);
  const audioTracksRef = useRef<AudioTrack[]>([]);
  const videoOverlaysRef = useRef<VideoOverlay[]>([]);
  const voElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const projectDurationRef = useRef(0);
  const playingRef = useRef(false);
  const scrubbingRef = useRef(false);
  const dragDepthRef = useRef(0);
  const trimDragRef = useRef<TrimDrag | null>(null);
  const moveDragRef = useRef<MoveDrag | null>(null);
  const overlayTimeDragRef = useRef<OverlayTimeDrag | null>(null);
  const overlayPosDragRef = useRef<{ type: 'text' | 'image' | 'video'; id: string } | null>(null);
  const panDragRef = useRef<PanDrag | null>(null);
  const historyPast = useRef<string[]>([]);
  const historyFuture = useRef<string[]>([]);
  const lastSnapshotRef = useRef<string>('');
  const applyingRef = useRef(false);
  const ppsRef = useRef(pps);
  const pendingAnchorRef = useRef<{ time: number; offsetX: number } | null>(null);
  const renderStartRef = useRef(0);
  const playheadLineRef = useRef<HTMLDivElement>(null);
  const tcMobileRef = useRef<HTMLSpanElement>(null);
  const tcDesktopRef = useRef<HTMLSpanElement>(null);
  const lastUiTenthRef = useRef(-1);
  const transitionVideoRef = useRef<HTMLVideoElement>(null);
  const transitionLayerRef = useRef<HTMLDivElement>(null);
  const videoStartsRef = useRef<number[]>([]);
  const previewTransitionsRef = useRef(false);
  const previewFFRef = useRef<any>(null);
  const previewCacheRef = useRef<Map<string, string>>(new Map());
  const previewQueueRef = useRef<number[]>([]);
  const previewQueueRunningRef = useRef(false);
  const previewRunIdRef = useRef(0);
  const doneRef = useRef(0);
  const totalRef = useRef(0);
  const previewInFlightRef = useRef<number | null>(null);
  const previewProgCtxRef = useRef<{ d: number; active: boolean; startedAt: number }>({ d: 1, active: false, startedAt: 0 });
  const snippetProgressRef = useRef(0);
  const progressSeenRef = useRef(false);
  const [, setProgressTick] = useState(0);
  const [previewRenderStatus, setPreviewRenderStatus] = useState<{ rendering: boolean; done: number; total: number }>({ rendering: false, done: 0, total: 0 });
  const [previewCacheVersion, setPreviewCacheVersion] = useState(0);
  const [snippetProgress, setSnippetProgress] = useState(0);
  const [proxyVersion, setProxyVersion] = useState(0);
  const proxyQueueRef = useRef<{ assetId: string; url: string }[]>([]);
  const proxyRunningRef = useRef(false);

  clipsRef.current = clips;
  imageOverlaysRef.current = imageOverlays;
  textOverlaysRef.current = textOverlays;
  audioTracksRef.current = audioTracks;
  videoOverlaysRef.current = videoOverlays;
  playingRef.current = playing;
  ppsRef.current = pps;
  previewTransitionsRef.current = previewTransitions;

  const currentRatio = RATIO_PRESETS[exportSettings.ratio];
  const REF_WIDTH = currentRatio.w;
  const REF_HEIGHT = currentRatio.h;
  const isCover = exportSettings.fit === 'recortar';
  const isPlus = BETA_PLUS_UNLOCK;
  const resInfo = RESOLUTION_PRESETS[exportSettings.resolution];
  const fmtInfo = FORMAT_PRESETS[exportSettings.format];
  const qualInfo = QUALITY_PRESETS[exportSettings.quality];

// Duración real de la mezcla de una transición (independiente del modo preview):
// es exactamente lo que el xfade del export funde (cola de A + cabeza de B).
const blendLen = (i: number): number => {
  if (i < 0 || i >= clips.length - 1) return 0;
  const tr = clips[i].transition;
  if (!tr || tr.type === 'none') return 0;
  return clamp(tr.duration, 0, Math.min(effLen(clips[i]), effLen(clips[i + 1])));
};

  // ===== GEOMETRÍA DE TIMELINE (comprimida en modo preview de transiciones) =====
  const dAfter = (i: number): number => {
    if (!previewTransitions || i < 0 || i >= clips.length - 1) return 0;
    const tr = clips[i].transition;
    if (!tr || tr.type === 'none') return 0;
    return clamp(tr.duration, 0, Math.min(effLen(clips[i]), effLen(clips[i + 1])));
  };
  const videoStarts: number[] = [];
  let accStart = 0;
  for (let i = 0; i < clips.length; i++) { videoStarts.push(accStart); accStart += effLen(clips[i]) - dAfter(i); }
  const videoTotal = clips.length ? videoStarts[clips.length - 1] + effLen(clips[clips.length - 1]) : 0;
  videoStartsRef.current = videoStarts;

  const projectDuration = Math.max(
    videoTotal,
    audioTracks.reduce((a, t) => Math.max(a, t.start + t.duration), 0),
    imageOverlays.reduce((a, t) => Math.max(a, t.end), 0),
    textOverlays.reduce((a, t) => Math.max(a, t.end), 0),
videoOverlays.reduce((a, t) => Math.max(a, t.end), 0), 0
);
  useEffect(() => { projectDurationRef.current = projectDuration; }, [projectDuration]);

  const prevRatioRef = useRef<AspectRatio>('16:9');
  useEffect(() => {
    if (prevRatioRef.current === exportSettings.ratio) return;
    const oldR = RATIO_PRESETS[prevRatioRef.current];
    const newR = RATIO_PRESETS[exportSettings.ratio];
    const sx = newR.w / oldR.w;
    const sy = newR.h / oldR.h;
    setImageOverlays((prev) => prev.map((img) => ({ ...img, x: img.x * sx, y: img.y * sy, size: img.size * sx })));
    setTextOverlays((prev) => prev.map((txt) => ({ ...txt, x: txt.x * sx, y: txt.y * sy, size: Math.round(txt.size * sx) })));
    setVideoOverlays((prev) => prev.map((vo) => ({ ...vo, x: vo.x * sx, y: vo.y * sy, size: vo.size * sx })));
    prevRatioRef.current = exportSettings.ratio;
  }, [exportSettings.ratio]);

  useEffect(() => {
    const w = wrapperRef.current;
    if (!w) return;
    const measure = () => {
      const ww = w.offsetWidth;
      const wh = w.offsetHeight;
      const k = Math.min(ww / REF_WIDTH, wh / REF_HEIGHT);
      const sw = REF_WIDTH * k;
      const sh = REF_HEIGHT * k;
      setStage({ left: (ww - sw) / 2, top: (wh - sh) / 2, width: sw, height: sh });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(w);
    return () => ro.disconnect();
  }, [REF_WIDTH, REF_HEIGHT]);

  // ===== ZOOM DE TIMELINE CON RUEDA (anclado al cursor) =====
  useEffect(() => {
    const container = timelineScrollRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const cur = ppsRef.current;
      const timeAtCursor = (offsetX + container.scrollLeft) / cur;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      pendingAnchorRef.current = { time: timeAtCursor, offsetX };
      setPps(clamp(cur * factor, MIN_PPS, MAX_PPS));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    const container = timelineScrollRef.current;
    if (!anchor || !container) return;
    container.scrollLeft = anchor.time * pps - anchor.offsetX;
    pendingAnchorRef.current = null;
  }, [pps]);

  function zoomBy(factor: number) {
    const container = timelineScrollRef.current;
    const cur = ppsRef.current;
    const offsetX = container ? container.clientWidth / 2 : 0;
    const timeAtCursor = container ? (offsetX + container.scrollLeft) / cur : 0;
    pendingAnchorRef.current = container ? { time: timeAtCursor, offsetX } : null;
    setPps(clamp(cur * factor, MIN_PPS, MAX_PPS));
  }

  // ===== RESTAURAR AUTOSAVE =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const proj = await loadProject();
        if (!proj || cancelled) return;
        const rc: Clip[] = []; const ri: ImageOverlay[] = []; const ra: AudioTrack[] = [];
        let missing = 0;
                for (const c of proj.clips || []) {
          const blob = c.assetId ? await getAsset(c.assetId) : null;
          if (!blob) { missing++; continue; }
          c.url = URL.createObjectURL(blob);
                    if (proxiesEnabled && c.assetId && !proxyUrlMap.has(c.assetId)) {
            const pb = await getAsset(`proxy:v2:${c.assetId}`);
            if (pb) proxyUrlMap.set(c.assetId, URL.createObjectURL(pb));
            else enqueueProxy(c.assetId, c.url);
          }
          enqueueFilmstrip(c.assetId, c.url, c.duration);
          rc.push(c);
        }
        for (const img of proj.imageOverlays || []) {
          const blob = img.assetId ? await getAsset(img.assetId) : null;
          if (!blob) { missing++; continue; }
          img.url = URL.createObjectURL(blob);
          ri.push(img);
        }
        for (const a of proj.audioTracks || []) {
          const blob = a.assetId ? await getAsset(a.assetId) : null;
          if (!blob) { missing++; continue; }
          a.url = URL.createObjectURL(blob);
          const decoded = await decodeAudioBlob(blob);
          if (decoded) audioDataMap.set(a.id, { channelData: decoded.channelData, sampleRate: decoded.sampleRate });
          ra.push(a);
        }
const rv: VideoOverlay[] = [];
for (const vo of proj.videoOverlays || []) {
  const blob = vo.assetId ? await getAsset(vo.assetId) : null;
  if (!blob) { missing++; continue; }
  vo.url = URL.createObjectURL(blob);
  rv.push(vo);
}

        const rt: TextOverlay[] = proj.textOverlays || [];
        if (cancelled) return;
        if (rc.length || ri.length || rt.length || ra.length || rv.length || missing) {
          applyingRef.current = true;
          setClips(rc); setImageOverlays(ri); setTextOverlays(rt); setAudioTracks(ra); setVideoOverlays(rv);
          if (proj.settings) setExportSettings((s) => ({ ...s, ...proj.settings }));
          setTimeout(() => { applyingRef.current = false; }, 80);
          showToast(missing ? `📂 Proyecto restaurado (${missing} elemento(s) sin archivo local)` : '📂 Proyecto restaurado desde tu navegador', 'info');
        }
      } catch (e) { console.error('[Autosave] Error restaurando:', e); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== HISTORIA (UNDO/REDO) =====
  const snapshotOf = (c: Clip[], i: ImageOverlay[], t: TextOverlay[], a: AudioTrack[], v: VideoOverlay[]) => JSON.stringify([c, i, t, a, v]);
  useEffect(() => {
    if (applyingRef.current) return;
    const snap = snapshotOf(clips, imageOverlays, textOverlays, audioTracks, videoOverlays);
    if (snap === lastSnapshotRef.current) return;
    const timer = setTimeout(() => {
      if (applyingRef.current) return;
      if (lastSnapshotRef.current === '') { lastSnapshotRef.current = snap; return; }
      historyPast.current.push(lastSnapshotRef.current);
      if (historyPast.current.length > HISTORY_LIMIT) historyPast.current.shift();
      historyFuture.current = [];
      lastSnapshotRef.current = snap;
      setHistVersion((v) => v + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [clips, imageOverlays, textOverlays, audioTracks, videoOverlays]);

  const applySnapshot = useCallback((s: string) => {
    applyingRef.current = true;
    const [c, i, t, a, v] = JSON.parse(s);
    setClips(c); setImageOverlays(i); setTextOverlays(t); setAudioTracks(a); setVideoOverlays(v || []);
    lastSnapshotRef.current = s;
    setHistVersion((v) => v + 1);
    setTimeout(() => { applyingRef.current = false; }, 80);
  }, []);
  const undo = useCallback(() => {
    const prev = historyPast.current.pop();
    if (!prev) return;
    historyFuture.current.push(lastSnapshotRef.current);
    applySnapshot(prev);
  }, [applySnapshot]);
  const redo = useCallback(() => {
    const next = historyFuture.current.pop();
    if (!next) return;
    historyPast.current.push(lastSnapshotRef.current);
    applySnapshot(next);
  }, [applySnapshot]);

  // ===== AUTOGUARDADO =====
  useEffect(() => {
    const t = setTimeout(() => {
      if (applyingRef.current) return;
      const proj: StoredProject = { version: 1, savedAt: Date.now(), settings: exportSettings, clips, imageOverlays, textOverlays, audioTracks, videoOverlays };
      saveProject(proj).catch((e) => console.error('[Autosave] Error guardando:', e));
    }, 1200);
    return () => clearTimeout(t);
  }, [clips, imageOverlays, textOverlays, audioTracks, videoOverlays, exportSettings]);

  // ===== MODO PREVIEW DE TRANSICIONES: huella digital de la pista de video =====
  const fp = clips.map((c) => `${c.id}:${c.trimStart.toFixed(3)}:${c.trimEnd.toFixed(3)}:${c.speed}`).join('|');
  const fpRef = useRef(fp);
  useEffect(() => {
    if (fpRef.current === fp) return;
    fpRef.current = fp;
    if (previewTransitionsRef.current) {
      setPreviewTransitions(false);
      showToast('🔴 Previsualización desactivada: modificaste la pista de video', 'info');
    }
  }, [fp]);

  // ===== PROXY RENDER: snippets reales de transición con FFmpeg =====
  function transitionCacheKey(i: number): string | null {
    const list = clipsRef.current;
    if (i < 0 || i >= list.length - 1) return null;
    const a = list[i]; const b = list[i + 1];
    const tr = a.transition;
    if (!tr || tr.type === 'none') return null;
    const type = XFADE_VALID.has(tr.type) ? tr.type : 'fade';
    const d = clamp(tr.duration, 0, Math.min(effLen(a), effLen(b)));
    if (d <= 0) return null;
    const pw = Math.max(2, Math.round((REF_WIDTH * (PREVIEW_PROXY_HEIGHT / REF_HEIGHT)) / 2) * 2);
    return [a.id, a.trimStart.toFixed(2), a.trimEnd.toFixed(2), a.speed, a.rotate, a.cropX.toFixed(2), a.cropY.toFixed(2), a.fadeOut.toFixed(1),
      b.id, b.trimStart.toFixed(2), b.trimEnd.toFixed(2), b.speed, b.rotate, b.cropX.toFixed(2), b.cropY.toFixed(2), b.fadeIn.toFixed(1),
      type, d.toFixed(2), pw, PREVIEW_PROXY_HEIGHT, exportSettings.fit].join('|');
  }
  function cacheSet(key: string, url: string) {
    const cache = previewCacheRef.current;
    if (cache.has(key)) URL.revokeObjectURL(cache.get(key)!);
    cache.set(key, url);
    while (cache.size > 24) {
      const oldest = cache.keys().next().value as string;
      URL.revokeObjectURL(cache.get(oldest)!);
      cache.delete(oldest);
    }
  }
  async function getPreviewFF() {
    if (previewFFRef.current) return previewFFRef.current;
    const { FFmpeg } = await loadFFmpegLib();
    const ff = new FFmpeg();
    const coreURL = await toBlobURL('/ffmpeg-core.js', 'text/javascript');
    const wasmURL = await toBlobURL('/ffmpeg-core.wasm', 'application/wasm');
        await ff.load({ coreURL, wasmURL });
        ff.on('progress', ({ time }: any) => {
      const ctx = previewProgCtxRef.current;
      if (!ctx.active) return;
      const secs = (Number(time) || 0) / 1_000_000;
      // Anti-eventos-viejos: un progress del exec ANTERIOR que llegue tarde al
      // re-armar el contexto diría "ya terminé" (100% fantasma). El tiempo de salida
      // jamás puede superar al tiempo de pared del exec actual + un slack generoso.
      const elapsed = (performance.now() - ctx.startedAt) / 1000;
      if (secs > elapsed + Math.max(0.4, ctx.d * 0.5)) return;
      snippetProgressRef.current = clamp(secs / Math.max(ctx.d, 0.1), 0, 1);
      progressSeenRef.current = true;
    });
    previewFFRef.current = ff;
    return ff;
  }
  async function renderTransitionSnippet(i: number, key: string) {
    const list = clipsRef.current;
    const a = list[i]; const b = list[i + 1];
    const tr = a.transition!;
    const type = XFADE_VALID.has(tr.type) ? tr.type : 'fade';
    const d = clamp(tr.duration, 0, Math.min(effLen(a), effLen(b)));
    const pw = Math.max(2, Math.round((REF_WIDTH * (PREVIEW_PROXY_HEIGHT / REF_HEIGHT)) / 2) * 2);
    const ph = PREVIEW_PROXY_HEIGHT;
        const ff = await getPreviewFF();
                snippetProgressRef.current = 0;
    progressSeenRef.current = false;
    previewProgCtxRef.current = { d, active: false, startedAt: 0 };
    const fitFor = (c: Clip) => exportSettings.fit === 'recortar'
      ? `scale=${pw}:${ph}:force_original_aspect_ratio=increase,crop=${pw}:${ph}:(iw-${pw})*${c.cropX}:(ih-${ph})*${c.cropY}`
      : `scale=${pw}:${ph}:force_original_aspect_ratio=decrease,pad=${pw}:${ph}:(ow-iw)/2:(oh-ih)/2`;
    const rotFor = (c: Clip) => c.rotate === 90 ? 'transpose=1,' : c.rotate === 180 ? 'hflip,vflip,' : c.rotate === 270 ? 'transpose=2,' : '';
    const aStart = Math.max(a.trimEnd - d * a.speed, a.trimStart);
    const bEnd = Math.min(b.trimStart + d * b.speed, b.trimEnd);
    const aFadeOut = a.fadeOut > 0 ? `,fade=t=out:st=${Math.max(d - a.fadeOut, 0)}:d=${Math.min(a.fadeOut, d)}` : '';
    const bFadeIn = b.fadeIn > 0 ? `,fade=t=in:st=0:d=${Math.min(b.fadeIn, d)}` : '';
    const filterComplex =
      `[0:v]trim=${aStart}:${a.trimEnd},setpts=(PTS-STARTPTS)/${a.speed},${rotFor(a)}fps=30,${fitFor(a)}${aFadeOut}[pa];` +
      `[1:v]trim=${b.trimStart}:${bEnd},setpts=(PTS-STARTPTS)/${b.speed},${rotFor(b)}fps=30,${fitFor(b)}${bFadeIn}[pb];` +
      `[pa][pb]xfade=transition=${type}:duration=${d}:offset=0[finalv]`;
    await ff.writeFile('pa.mp4', new Uint8Array(await (await fetch(a.url)).arrayBuffer()));
    await ff.writeFile('pb.mp4', new Uint8Array(await (await fetch(b.url)).arrayBuffer()));
                const outName = `prev_${Date.now()}.mp4`;
    previewProgCtxRef.current = { d, active: true, startedAt: performance.now() };
    try {
      const code = await ff.exec(['-i', 'pa.mp4', '-i', 'pb.mp4', '-filter_complex', filterComplex, '-map', '[finalv]', '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30', '-pix_fmt', 'yuv420p', '-r', '30', '-f', 'mp4', '-movflags', '+faststart', '-y', outName]);
      if (code !== 0) throw new Error(`xfade preview terminó con código ${code}`);
      const data = await ff.readFile(outName);
      cacheSet(key, URL.createObjectURL(new Blob([data], { type: 'video/mp4' })));
      setPreviewCacheVersion((v) => v + 1);
    } finally {
      previewProgCtxRef.current.active = false;
      snippetProgressRef.current = 0;
      progressSeenRef.current = false;
      // Limpieza del FS SIN await: ningún yield entre el fin del exec y el apagado
      // del contexto → la barra no puede publicar un 100% fantasma en el handoff.
      for (const f of ['pa.mp4', 'pb.mp4', outName]) { Promise.resolve(ff.deleteFile(f)).catch(() => {}); }
    }
  }
    function enqueueTransitionRenders() {
    const list = clipsRef.current;
    let pushed = 0;
    for (let i = 0; i < list.length - 1; i++) {
      const key = transitionCacheKey(i);
      if (!key || previewCacheRef.current.has(key) || previewQueueRef.current.includes(i) || previewInFlightRef.current === i) continue;
      previewQueueRef.current.push(i);
      pushed += 1;
    }
    if (pushed > 0) {
      totalRef.current += pushed;
      setPreviewRenderStatus({ rendering: true, done: doneRef.current, total: totalRef.current });
    }
    if (previewQueueRef.current.length && !previewQueueRunningRef.current) void processPreviewQueue();
  }
    async function processPreviewQueue() {
    const runId = ++previewRunIdRef.current;
    previewQueueRunningRef.current = true;
    setPreviewRenderStatus({ rendering: true, done: doneRef.current, total: totalRef.current });
    let renderedThisRun = 0;
    let lastIdx: number | null = null;
    try {
      while (previewQueueRef.current.length > 0) {
        if (runId !== previewRunIdRef.current) return; // cancelado: mutis, sin tocar la UI
        if (!previewTransitionsRef.current) break;     // modo apagado: la cola queda intacta
        const i = previewQueueRef.current.shift()!;
        const key = transitionCacheKey(i);
        if (!key || previewCacheRef.current.has(key)) continue;
                lastIdx = i;
        previewInFlightRef.current = i;
        snippetProgressRef.current = 0;
        progressSeenRef.current = false;
        showToast(`🎬 Renderizando transición ${doneRef.current + 1}/${totalRef.current}...`, 'info', 2200);
        await renderTransitionSnippet(i, key);
        previewInFlightRef.current = null;
        if (runId !== previewRunIdRef.current) return; // se canceló durante el render
        doneRef.current += 1;
        renderedThisRun += 1;
        setPreviewRenderStatus({ rendering: previewQueueRef.current.length > 0, done: doneRef.current, total: totalRef.current });
      }
      if (renderedThisRun > 0 && previewTransitionsRef.current && runId === previewRunIdRef.current) {
        showToast('✨ Transiciones reales listas en el preview', 'info');
      }
    } catch (e) {
      previewInFlightRef.current = null;
      if (runId === previewRunIdRef.current) {
        console.error('[PreviewTransitions] Error renderizando snippet:', e);
        showToast('⚠️ No se pudo renderizar una transición real; seguimos con corte limpio', 'warn');
      }
    } finally {
      // SIEMPRE liberamos el flag y relanzamos si quedó cola, aunque este run haya
      // muerto por cancel: ningún fantasma se lleva más las llaves de la cola. 👻🔑
      if (lastIdx !== null && previewInFlightRef.current === lastIdx) previewInFlightRef.current = null;
      previewQueueRunningRef.current = false;
      if (runId === previewRunIdRef.current) {
        setPreviewRenderStatus((s) => ({ ...s, rendering: false }));
      }
      if (previewQueueRef.current.length && previewTransitionsRef.current) void processPreviewQueue();
    }
  }
  const transSig = clips.map((c, i) => `${i}:${c.transition?.type ?? 'none'}:${(c.transition?.duration ?? 0).toFixed(2)}:${c.trimStart.toFixed(2)}:${c.trimEnd.toFixed(2)}:${c.speed}:${c.rotate}`).join('|') + `::${exportSettings.fit}::${exportSettings.ratio}`;
  useEffect(() => {
    if (!previewTransitions) return;
    const t = setTimeout(() => { enqueueTransitionRenders(); }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transSig, previewTransitions]);
  // Watchdog: si alguna vez queda cola huérfana con el modo activo, la relanzamos al toque
  useEffect(() => {
    if (previewTransitions && previewQueueRef.current.length && !previewQueueRunningRef.current) void processPreviewQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewTransitions, previewCacheVersion]);

  // Ticker: mientras haya render activo, la barra relee el progreso 4 veces por segundo
  useEffect(() => {
    if (!previewRenderStatus.rendering) return;
    const id = window.setInterval(() => { setProgressTick((t) => t + 1); }, 250);
    return () => window.clearInterval(id);
  }, [previewRenderStatus.rendering]);

  function notifyTransitionApplied() {
    if (previewTransitionsRef.current) showToast('✨ Transición aplicada — renderizando preview…', 'info', 2600);
    else showToast('✨ Transición aplicada — presioná "Previsualizar transiciones" para verla', 'info', 4200);
  }

  function applyPickedTransition(clipIndex: number, type: TransitionType, duration: number) {
    const actual = clips[clipIndex]?.transition;
    const cambioReal = actual?.type !== type || (type !== 'none' && (actual?.duration || 0.5) !== duration);
    setClips((prev) => prev.map((c, i) => (i === clipIndex ? { ...c, transition: { type, duration: type === 'none' ? 0 : duration } } : c)));
    setTransitionPicker(null);
    if (cambioReal) notifyTransitionApplied();
  }

        function cancelPreviewRenders() {
    previewRunIdRef.current += 1; // invalida el run en vuelo
    if (previewFFRef.current) { try { previewFFRef.current.terminate(); } catch (e) {} previewFFRef.current = null; }
    previewQueueRef.current = [];
    previewQueueRunningRef.current = false;
    doneRef.current = 0;
    totalRef.current = 0;
    setPreviewRenderStatus({ rendering: false, done: 0, total: 0 });
    snippetProgressRef.current = 0;
    progressSeenRef.current = false;
    setPreviewTransitions(false);
    showToast('⊘ Render de transiciones cancelado', 'info');
  }
  function togglePreviewTransitions() {
    if (clips.length < 2) { showToast('⚠️ Agregá al menos 2 clips para previsualizar transiciones', 'warn'); return; }
    if (previewTransitions && previewRenderStatus.rendering) { showToast('⏳ Render en curso: mirá la barra de progreso sobre el preview (✕ para cancelar)', 'info', 3000); return; }
    const next = !previewTransitions;
    setPreviewTransitions(next);
    if (next) {
      const hay = clips.some((c, i) => i < clips.length - 1 && c.transition && c.transition.type !== 'none');
      showToast(hay ? '🟢 Previsualización activada: las transiciones se ven en el preview' : '🟢 Modo activado, pero no hay transiciones configuradas todavía (usá el botón ✨ entre clips)', 'info', 5000);
      doneRef.current = 0;
      totalRef.current = previewQueueRef.current.length;
      if (hay) enqueueTransitionRenders();
    }
  }

  function syncTransitionLayer(t: number) {
    const layer = transitionLayerRef.current;
    const sec = transitionVideoRef.current;
    if (!layer || !sec) return;
    const list = clipsRef.current;
    const starts = videoStartsRef.current;
    const { index } = locateVideo(t, list, starts);
    const d = index >= 0 ? dAfter(index) : 0;
    const winStart = index >= 0 && index < list.length - 1 ? starts[index + 1] : 0;
    const inWin = previewTransitionsRef.current && index >= 0 && d > 0 && t >= winStart && t < winStart + d;
    const mainVideo = videoRef.current;
    if (!inWin) {
      layer.style.display = 'none';
      if (!sec.paused) sec.pause();
      if (mainVideo) mainVideo.volume = 1;
      return;
    }
    const p = clamp((t - winStart) / d, 0, 1);
    if (mainVideo && !list[index].muted) mainVideo.volume = clamp(1 - p, 0, 1);
    const key = transitionCacheKey(index);
    const snippetUrl = key ? previewCacheRef.current.get(key) : undefined;
    if (!snippetUrl) {
      // Snippet aún en cola: se ve corte limpio hasta que el render real esté listo
      layer.style.display = 'none';
      if (sec.dataset.snippetUrl) sec.dataset.snippetUrl = '';
      if (!sec.paused) sec.pause();
      return;
    }
    if (sec.dataset.snippetUrl !== snippetUrl) {
      sec.dataset.snippetUrl = snippetUrl;
      sec.dataset.clipUrl = '';
      sec.src = snippetUrl;
    }
    const target = clamp(t - winStart, 0, d);
    if (playingRef.current) {
      if (Math.abs(sec.currentTime - target) > 0.25) sec.currentTime = target;
      if (sec.paused) sec.play().catch(() => {});
    } else {
      if (!sec.paused) sec.pause();
      sec.currentTime = target;
    }
    layer.style.display = 'block';
    layer.style.opacity = '1'; layer.style.clipPath = 'none'; layer.style.transform = 'none'; layer.style.filter = 'none';
    layer.style.maskImage = 'none'; (layer.style as any).webkitMaskImage = 'none';
  }
  useEffect(() => { syncTransitionLayer(playhead); }, [playhead, previewTransitions, clips, playing, previewCacheVersion]);
  useEffect(() => () => {
    previewQueueRef.current = [];
    if (previewFFRef.current) { try { previewFFRef.current.terminate(); } catch (e) {} previewFFRef.current = null; }
        previewCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewCacheRef.current.clear();
    proxyUrlMap.forEach((url) => URL.revokeObjectURL(url));
    proxyUrlMap.clear();
  }, []);

  const { index: activeIndex, localProj: activeLocalProj, localFile: activeLocalFile } = locateVideo(playhead, clips, videoStarts);
  const activeClip = activeIndex >= 0 ? clips[activeIndex] : null;
const activeUsesProxy = activeClip ? previewSrc(activeClip) !== activeClip.url : false;
    const pendingWork = previewQueueRef.current.length + (previewInFlightRef.current !== null ? 1 : 0);
  const totalNow = Math.max(totalRef.current, doneRef.current + pendingWork);
  const previewPercent = totalNow > 0 ? Math.min(100, Math.round(((doneRef.current + clamp(snippetProgressRef.current, 0, 1)) / totalNow) * 100)) : 0;
  const previewPreparing = previewRenderStatus.rendering && !progressSeenRef.current;
  const selectedClip = clips.find((c) => c.id === selectedId) ?? null;
  const selectedImage = imageOverlays.find((t) => t.id === selectedImageId) ?? null;
  const selectedText = textOverlays.find((t) => t.id === selectedTextId) ?? null;
  const selectedAudio = audioTracks.find((t) => t.id === selectedAudioId) ?? null;
  const selectedVo = videoOverlays.find((v) => v.id === selectedVoId) ?? null;

  let previewAlpha = 1;
  if (activeClip) {
    const len = effLen(activeClip);
    if (activeClip.fadeIn > 0 && activeLocalProj < activeClip.fadeIn) previewAlpha = Math.max(activeLocalProj / activeClip.fadeIn, 0);
    if (activeClip.fadeOut > 0 && activeLocalProj > len - activeClip.fadeOut) previewAlpha = Math.max((len - activeLocalProj) / activeClip.fadeOut, 0);
  }
  const previewRotate = activeClip?.rotate ?? 0;
  const videoElemW = stage ? (previewRotate === 90 || previewRotate === 270 ? stage.height : stage.width) : 0;
  const videoElemH = stage ? (previewRotate === 90 || previewRotate === 270 ? stage.width : stage.height) : 0;
  const activeImage = imageOverlays.find((img) => playhead >= img.start && playhead <= img.end);
  const activeText = textOverlays.find((txt) => playhead >= txt.start && playhead <= txt.end);
  let imageAlpha = 1;
  if (activeImage) {
    const windowLen = activeImage.end - activeImage.start;
    const localInWindow = playhead - activeImage.start;
    if (activeImage.fadeIn > 0 && localInWindow < activeImage.fadeIn) imageAlpha = Math.max(localInWindow / activeImage.fadeIn, 0);
    if (activeImage.fadeOut > 0 && localInWindow > windowLen - activeImage.fadeOut) imageAlpha = Math.max((windowLen - localInWindow) / activeImage.fadeOut, 0);
  }
  let textAlpha = 1;
  if (activeText) {
    const windowLen = activeText.end - activeText.start;
    const localInWindow = playhead - activeText.start;
    if (activeText.fadeIn > 0 && localInWindow < activeText.fadeIn) textAlpha = Math.max(localInWindow / activeText.fadeIn, 0);
    if (activeText.fadeOut > 0 && localInWindow > windowLen - activeText.fadeOut) textAlpha = Math.max((windowLen - localInWindow) / activeText.fadeOut, 0);
  }

  function showToast(msg: string, kind: Toast['kind'] = 'info', ms = 3200) {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, kind }]);
    window.setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, ms);
  }
  const registerAudio = useCallback((id: string, el: HTMLAudioElement) => { audioElementsRef.current.set(id, el); }, []);
  const unregisterAudio = useCallback((id: string) => {
    const el = audioElementsRef.current.get(id);
    if (el) { el.pause(); el.src = ''; }
    audioElementsRef.current.delete(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAudioId) { e.preventDefault(); setAudioTracks((prev) => prev.filter((a) => a.id !== selectedAudioId)); setSelectedAudioId(null); }
        else if (selectedImageId) { e.preventDefault(); setImageOverlays((prev) => prev.filter((a) => a.id !== selectedImageId)); setSelectedImageId(null); }
        else if (selectedTextId) { e.preventDefault(); setTextOverlays((prev) => prev.filter((a) => a.id !== selectedTextId)); setSelectedTextId(null); }
else if (selectedVoId) { e.preventDefault(); setVideoOverlays((prev) => prev.filter((a) => a.id !== selectedVoId)); setSelectedVoId(null); }
        else if (selectedId) { e.preventDefault(); setClips((prev) => prev.filter((c) => c.id !== selectedId)); setSelectedId(null); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedAudioId, selectedImageId, selectedTextId, selectedVoId, undo, redo]);

  useEffect(() => {
    if (playheadRef.current > projectDurationRef.current) seek(projectDurationRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDuration]);

  // Si no quedan clips, limpiamos el <video> para que no quede "quemado" el último frame
  useEffect(() => {
    if (clips.length === 0) {
      const v = videoRef.current;
      if (v && v.getAttribute('src')) {
        v.pause();
        v.removeAttribute('src');
        v.load();
      }
    }
  }, [clips.length]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || activeIndex < 0) return;
    const clip = clips[activeIndex];
        if (!clip) return;
    bindVideoToClip(clip);
    if (!playingRef.current) v.currentTime = Math.min(activeLocalFile, clip.trimEnd);
    v.playbackRate = clip.speed;
    v.muted = clip.muted;
    if (playing) v.play().catch(() => {});
  }, [activeIndex, clips]);

  useEffect(() => {
    const tracks = audioTracksRef.current;
    const isPlaying = playingRef.current;
    const currentTime = playheadRef.current;
    tracks.forEach((track) => {
      const audio = audioElementsRef.current.get(track.id);
      if (!audio) return;
      const isActive = currentTime >= track.start && currentTime < track.start + track.duration;
      const localTime = currentTime - track.start;
      if (isActive) {
        const targetTime = track.offset + localTime;
        if (Math.abs(audio.currentTime - targetTime) > 0.5) audio.currentTime = targetTime;
        let volume = track.muted ? 0 : track.volume;
        if (track.fadeIn > 0 && localTime < track.fadeIn) volume *= localTime / track.fadeIn;
        if (track.fadeOut > 0 && localTime > track.duration - track.fadeOut) volume *= (track.duration - localTime) / track.fadeOut;
        audio.volume = clamp(volume, 0, 1);
        if (isPlaying && audio.paused) audio.play().catch(() => {});
        else if (!isPlaying && !audio.paused) audio.pause();
      } else { if (!audio.paused) audio.pause(); }
    });
  }, [playhead, playing, audioTracks]);

// ===== SYNC DE CAPAS DE VIDEO: cada <video> sigue al playhead dentro de su ventana =====
useEffect(() => {
const isPlaying = playingRef.current;
const t = playheadRef.current;
videoOverlaysRef.current.forEach((vo) => {
const el = voElementsRef.current.get(vo.id);
if (!el) return;
const active = t >= vo.start && t <= vo.end;
if (active) {
const target = vo.offset + (t - vo.start);
if (Math.abs(el.currentTime - target) > 0.5) el.currentTime = target;
el.muted = vo.muted;
if (isPlaying && el.paused) el.play().catch(() => {});
else if (!isPlaying && !el.paused) el.pause();
} else if (!el.paused) el.pause();
});
}, [playhead, playing, videoOverlays]);

 const proxyToastRef = useRef(false);

  function bindVideoToClip(clip: Clip) {
    const v = videoRef.current;
    if (!v) return;
    const src = previewSrc(clip);
    if (v.dataset.clipId !== clip.id || v.dataset.clipSrc !== src) {
      v.dataset.clipId = clip.id;
      v.dataset.clipSrc = src;
      v.src = src;
      v.playbackRate = clip.speed;
      v.muted = clip.muted;
      if (playingRef.current) v.play().catch(() => {});
      if (src !== clip.url && !proxyToastRef.current) {
        proxyToastRef.current = true;
        showToast('⚡ Preview usando proxy 480p', 'info');
      }
    }
  }

  // ===== PROXIES 480p PARA EDICIÓN FLUIDA EN MÓVILES =====
  async function renderProxy(assetId: string, url: string) {
    const ff = await getPreviewFF();
    await ff.writeFile('pin.mp4', new Uint8Array(await (await fetch(url)).arrayBuffer()));
    const code = await ff.exec(['-i', 'pin.mp4', '-vf', 'scale=-2:480:flags=fast_bilinear', '-r', '30', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '32', '-g', '30', '-keyint_min', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', '-y', 'pout.mp4']);
    if (code !== 0) throw new Error(`proxy terminó con código ${code}`);
    const data = await ff.readFile('pout.mp4');
    await putAsset(`proxy:v2:${assetId}`, new Blob([data], { type: 'video/mp4' }));
    proxyUrlMap.set(assetId, URL.createObjectURL(new Blob([data], { type: 'video/mp4' })));
    try { await ff.deleteFile('pin.mp4'); await ff.deleteFile('pout.mp4'); } catch (e) {}
  }
  function enqueueProxy(assetId: string, url: string) {
    if (!proxiesEnabled) return;
    if (proxyUrlMap.has(assetId) || proxyQueueRef.current.some((q) => q.assetId === assetId)) return;
    proxyQueueRef.current.push({ assetId, url });
    if (!proxyRunningRef.current) void processProxyQueue();
  }
  async function processProxyQueue() {
    proxyRunningRef.current = true;
    const total = proxyQueueRef.current.length;
    let done = 0;
    try {
          while (proxyQueueRef.current.length > 0) {
      if (!proxiesEnabled) break;
      const item = proxyQueueRef.current.shift()!;
        showToast(`⚡ Generando proxy 480p ${done + 1}/${total}...`, 'info', 2500);
        await renderProxy(item.assetId, item.url);
        done += 1;
        setProxyVersion((v) => v + 1);
      }
      if (done > 0) showToast('⚡ Proxies listos: preview fluido en 480p (el export usa el original)', 'info', 5000);
    } catch (e) {
      console.error('[Proxy] Error:', e);
      showToast('⚠️ No se pudo generar el proxy; seguimos con el original', 'warn');
    } finally {
      proxyRunningRef.current = false;
    }
  }
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const { index, localFile } = locateVideo(playheadRef.current, clipsRef.current, videoStartsRef.current);
    if (index >= 0) {
      const clip = clipsRef.current[index];
      bindVideoToClip(clip);
      v.currentTime = Math.min(localFile, clip.trimEnd);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyVersion]);

      const tick = useCallback((ts: number) => {
    if (!playingRef.current) return;
    const dt = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0;
    lastTsRef.current = ts;
    const v = videoRef.current;
    const list = clipsRef.current;
    const starts = videoStartsRef.current;
    // RELOJ ESCLAVO: el playhead avanza según lo que el decoder realmente muestra
    let t = playheadRef.current + dt;
    if (v && list.length > 0 && !v.paused && v.readyState >= 1) {
      const loc = locateVideo(playheadRef.current, list, starts);
      if (loc.index >= 0 && v.dataset.clipId === list[loc.index].id) {
        const clip = list[loc.index];
        const localProj = (v.currentTime - clip.trimStart) / clip.speed;
        const mediaT = starts[loc.index] + Math.max(localProj, 0);
        if (mediaT >= playheadRef.current - 0.02 && mediaT <= playheadRef.current + dt + 0.25) t = mediaT;
      }
    }
    const total = projectDurationRef.current;
    if (t >= total) { t = total; playingRef.current = false; setPlaying(false); }
    playheadRef.current = t;
    // DOM directo a 60fps: línea y timecodes sin re-render
    const line = playheadLineRef.current;
    if (line) line.style.left = `${t * ppsRef.current}px`;
    const tc = formatTime(t);
    if (tcMobileRef.current) tcMobileRef.current.textContent = tc;
    if (tcDesktopRef.current) tcDesktopRef.current.textContent = tc;
    // Corrección SOLO ante desincronización grande o clip equivocado (nada de re-seeks finos)
    if (v && list.length > 0) {
      const { localFile, index } = locateVideo(t, list, starts);
      if (index >= 0) {
        const clip = list[index];
        bindVideoToClip(clip);
        const clampedLocalFile = Math.min(localFile, clip.trimEnd);
        if (Math.abs(v.currentTime - clampedLocalFile) > 0.8) v.currentTime = clampedLocalFile;
      }
    }
    // React state solo a UI_HZ
    const uiStep = Math.round(t * UI_HZ);
    if (uiStep !== lastUiTenthRef.current || t >= total) {
      lastUiTenthRef.current = uiStep;
      setPlayhead(t);
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (playing) { lastTsRef.current = 0; v?.play().catch(() => {}); rafRef.current = requestAnimationFrame(tick); }
    else { v?.pause(); cancelAnimationFrame(rafRef.current); }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  // Con reproducción pausada (scrub, zoom, edits), el DOM se sincroniza desde el state
  useEffect(() => {
    if (playingRef.current) return;
    const line = playheadLineRef.current;
    if (line) line.style.left = `${playhead * pps}px`;
    const tc = formatTime(playhead);
    if (tcMobileRef.current) tcMobileRef.current.textContent = tc;
    if (tcDesktopRef.current) tcDesktopRef.current.textContent = tc;
  }, [playhead, pps]);

  const seek = useCallback((t: number) => {
    const total = projectDurationRef.current;
    const clamped = Math.min(Math.max(t, 0), total);
    playheadRef.current = clamped;
    setPlayhead(clamped);
    const v = videoRef.current;
    if (!v || clipsRef.current.length === 0) return;
    const { index, localFile } = locateVideo(clamped, clipsRef.current, videoStartsRef.current);
    if (index < 0) return;
        const clip = clipsRef.current[index];
    bindVideoToClip(clip);
    v.currentTime = Math.min(localFile, clip.trimEnd);
  }, []);

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const videos = files.filter((f) => f.type.startsWith('video/'));
    const images = files.filter((f) => f.type.startsWith('image/'));
    const audios = files.filter((f) => f.type.startsWith('audio/'));
    if (videos.length > 0) {
      for (const f of videos) {
        const url = URL.createObjectURL(f);
        const meta = await probeVideoMeta(url);
        const duration = meta.duration;
        if (duration > 0) {
          if (meta.width >= 3000 || meta.height >= 3000) {
            showToast('🎥 Archivo 4K detectado: editar y exportar desde el navegador puede ser lento y requerir un PC de gama alta. Para un flujo más ágil, probá trabajando en 1080p.', 'warn', 8000);
          }
          const assetId = uid();
          try { await putAsset(assetId, f); } catch (e) { console.error('[Autosave] No se pudo guardar el asset:', e); }
          const clipId = uid();
          const audioData = await extractAudioFromVideo(url);
          const newClip: Clip = { id: clipId, assetId, name: f.name, url, duration, trimStart: 0, trimEnd: duration, rotate: 0, speed: 1, fadeIn: 0, fadeOut: 0, muted: false, cropX: 0.5, cropY: 0.5, hasAudio: !!audioData, transition: { type: 'fade', duration: 0.5 } };
                    if (audioData) audioDataMap.set(clipId, { channelData: audioData.channelData, sampleRate: audioData.sampleRate });
                    setClips((prev) => [...prev, newClip]);
          enqueueFilmstrip(assetId, url, duration);
          enqueueProxy(assetId, url);
          showToast(audioData ? `🎬 Video "${f.name}" agregado con audio integrado` : `🎬 Video "${f.name}" agregado (sin audio)`, 'info');
        }
      }
    }
    if (images.length > 0) {
      for (const f of images) {
        const url = URL.createObjectURL(f);
        const assetId = uid();
        try { await putAsset(assetId, f); } catch (e) { console.error('[Autosave] No se pudo guardar el asset:', e); }
        const newOverlay: ImageOverlay = { id: uid(), assetId, name: f.name, url, start: playheadRef.current, end: playheadRef.current + 5, x: REF_WIDTH * 0.5, y: REF_HEIGHT * 0.5, size: 20, rotate: 0, fadeIn: 0, fadeOut: 0 };
        setImageOverlays((prev) => [...prev, newOverlay]);
        showToast(`🖼️ Imagen "${f.name}" agregada`, 'info');
      }
    }
    if (audios.length > 0) {
      for (const f of audios) {
        const url = URL.createObjectURL(f);
        const assetId = uid();
        try { await putAsset(assetId, f); } catch (e) { console.error('[Autosave] No se pudo guardar el asset:', e); }
        const decoded = await decodeAudioBlob(f);
        if (decoded) {
          const newTrack: AudioTrack = { id: uid(), assetId, name: f.name, url, duration: decoded.duration, offset: 0, start: playheadRef.current, volume: 1, fadeIn: 0, fadeOut: 0, muted: false, peaks: [] };
          audioDataMap.set(newTrack.id, { channelData: decoded.channelData, sampleRate: decoded.sampleRate });
          newTrack.peaks = getPeaksForSegment(newTrack.id, 0, decoded.duration);
          setAudioTracks((prev) => [...prev, newTrack]);
          showToast(`🎵 Audio "${f.name}" agregado`, 'info');
        }
      }
    }
  }

  function toggleSeparateAudio(clip: Clip) {
    const existing = audioTracks.find((t) => t.sourceVideoId === clip.id);
    if (existing) {
      setAudioTracks((prev) => prev.filter((t) => t.id !== existing.id));
      updateClip(clip.id, { muted: false });
      showToast('🔊 Audio reintegrado al video', 'info');
      return;
    }
    if (!clip.hasAudio) { showToast('⚠️ Este video no tiene pista de audio', 'warn'); return; }
    const idx = clips.findIndex((c) => c.id === clip.id);
    const data = audioDataMap.get(clip.id);
    const dur = effLen(clip);
    const track: AudioTrack = {
      id: uid(), assetId: clip.assetId, name: `Audio de ${clip.name}`, url: clip.url,
      duration: dur, offset: clip.trimStart, start: idx >= 0 ? videoStarts[idx] : 0,
      volume: 1, fadeIn: 0, fadeOut: 0, muted: false,
      peaks: data ? getPeaksForSegment(clip.id, clip.trimStart, dur) : [], sourceVideoId: clip.id,
    };
    setAudioTracks((prev) => [...prev, track]);
    updateClip(clip.id, { muted: true });
    showToast('🎵 Audio separado en la pista de audio', 'info');
  }

  function toggleProxies() {
    const next = !proxiesOn;
    setProxiesOn(next);
    proxiesEnabled = next;
    try { window.localStorage.setItem('clipedia:proxies', next ? 'on' : 'off'); } catch (e) {}
    if (next) {
      clipsRef.current.forEach((c) => enqueueProxy(c.assetId, c.url));
      showToast('⚡ Proxies activados: el preview usará las versiones 480p', 'info');
    } else {
      showToast('🎥 Proxies desactivados: el preview decodifica el original. Si sentís tirones, reactivá.', 'warn', 5000);
    }
    setProxyVersion((v) => v + 1);
  }

  function cycleRatio() {
    const order: AspectRatio[] = ['16:9', '9:16', '1:1', '4:3'];
    const i = order.indexOf(exportSettings.ratio);
    setExportSettings((s) => ({ ...s, ratio: order[(i + 1) % order.length] }));
  }

  // ===== Cola de filmstrips: un clip por vez, sin robarle CPU al playback =====
  const [filmstripVersion, setFilmstripVersion] = useState(0);
  const filmstripQueueRef = useRef<{ assetId: string; url: string; duration: number }[]>([]);
  const filmstripRunningRef = useRef(false);
  function enqueueFilmstrip(assetId: string, url: string, duration: number) {
    if (filmstripCache.has(assetId) || filmstripQueueRef.current.some((q) => q.assetId === assetId)) return;
    filmstripQueueRef.current.push({ assetId, url, duration });
    if (!filmstripRunningRef.current) window.setTimeout(() => { void processFilmstripQueue(); }, 600);
  }
  async function processFilmstripQueue() {
    filmstripRunningRef.current = true;
    while (filmstripQueueRef.current.length > 0) {
      const item = filmstripQueueRef.current.shift()!;
      if (filmstripCache.has(item.assetId)) continue;
      try {
        const thumbs = await captureFilmstrip(item.url, item.duration);
        if (thumbs.length > 0) {
          filmstripCache.set(item.assetId, thumbs);
          setFilmstripVersion((v) => v + 1);
        }
      } catch (e) { console.error('[Filmstrip] Error:', e); }
    }
    filmstripRunningRef.current = false;
  }

  function togglePlay() { if (!playing) videoRef.current?.play().catch(() => {}); setPlaying(!playing); }
  function updateClip(id: string, patch: Partial<Clip>) { setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function updateImageOverlay(id: string, patch: Partial<ImageOverlay>) { setImageOverlays((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); }
  function updateTextOverlay(id: string, patch: Partial<TextOverlay>) { setTextOverlays((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); }
  function updateAudioTrack(id: string, patch: Partial<AudioTrack>) { setAudioTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); }
function updateVideoOverlay(id: string, patch: Partial<VideoOverlay>) { setVideoOverlays((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v))); }
  function selectOnly(id: string, type: 'clip' | 'image' | 'text' | 'audio' | 'video') {
setSelectedId(type === 'clip' ? id : null); setSelectedImageId(type === 'image' ? id : null);
setSelectedTextId(type === 'text' ? id : null); setSelectedAudioId(type === 'audio' ? id : null);
setSelectedVoId(type === 'video' ? id : null);
}
  function selectAndSeek(id: string) { selectOnly(id, 'clip'); }

  function newProject() {
    if (!window.confirm('¿Empezar un proyecto nuevo? Se descarta el actual (y su autoguardado).')) return;
    applyingRef.current = true;
    setClips([]); setImageOverlays([]); setTextOverlays([]); setAudioTracks([]); setVideoOverlays([]);
setSelectedId(null); setSelectedImageId(null); setSelectedTextId(null); setSelectedAudioId(null); setSelectedVoId(null);
    setPlayhead(0); playheadRef.current = 0;
    historyPast.current = []; historyFuture.current = []; lastSnapshotRef.current = '';
    setHistVersion((v) => v + 1);
    clearProject().catch(() => {});
    setTimeout(() => { applyingRef.current = false; }, 80);
    showToast('🆕 Proyecto nuevo listo', 'info');
  }

  function splitAtPlayhead() {
    const currentTime = playheadRef.current;
    if (selectedId) {
      const { index, localFile } = locateVideo(currentTime, clipsRef.current, videoStartsRef.current);
      const clip = clipsRef.current.find((c) => c.id === selectedId);
      if (clip && index >= 0 && clipsRef.current[index].id === selectedId) {
        if (localFile - clip.trimStart >= MIN_LEN && clip.trimEnd - localFile >= MIN_LEN) {
          const partA: Clip = { ...clip, id: uid(), trimEnd: localFile };
          const partB: Clip = { ...clip, id: uid(), trimStart: localFile };
          setClips((prev) => { const next = [...prev]; next.splice(index, 1, partA, partB); return next; });
        }
      }
    } else if (selectedAudioId) {
      const track = audioTracksRef.current.find((t) => t.id === selectedAudioId);
      if (track && currentTime >= track.start && currentTime < track.start + track.duration) {
        const localTime = currentTime - track.start;
        if (localTime >= MIN_LEN && track.duration - localTime >= MIN_LEN) {
          const rawData = audioDataMap.get(track.id);
          const partA: AudioTrack = { ...track, id: uid(), duration: localTime };
          const partB: AudioTrack = { ...track, id: uid(), start: currentTime, duration: track.duration - localTime, offset: track.offset + localTime };
          if (rawData) { audioDataMap.set(partA.id, { ...rawData }); audioDataMap.set(partB.id, { ...rawData }); }
          setAudioTracks((prev) => { const idx = prev.findIndex((t) => t.id === track.id); if (idx >= 0) { const next = [...prev]; next.splice(idx, 1, partA, partB); return next; } return prev; });
        }
      }
    } else if (selectedImageId) {
      const img = imageOverlaysRef.current.find((t) => t.id === selectedImageId);
      if (img && currentTime >= img.start && currentTime < img.end) {
        const localTime = currentTime - img.start;
        if (localTime >= MIN_OVERLAY_LEN && img.end - currentTime >= MIN_OVERLAY_LEN) {
          const partA: ImageOverlay = { ...img, id: uid(), end: currentTime };
          const partB: ImageOverlay = { ...img, id: uid(), start: currentTime };
          setImageOverlays((prev) => { const idx = prev.findIndex((t) => t.id === img.id); if (idx >= 0) { const next = [...prev]; next.splice(idx, 1, partA, partB); return next; } return prev; });
        }
      }
    } else if (selectedTextId) {
      const txt = textOverlaysRef.current.find((t) => t.id === selectedTextId);
      if (txt && currentTime >= txt.start && currentTime < txt.end) {
        const localTime = currentTime - txt.start;
        if (localTime >= MIN_OVERLAY_LEN && txt.end - currentTime >= MIN_OVERLAY_LEN) {
          const partA: TextOverlay = { ...txt, id: uid(), end: currentTime };
          const partB: TextOverlay = { ...txt, id: uid(), start: currentTime };
          setTextOverlays((prev) => { const idx = prev.findIndex((t) => t.id === txt.id); if (idx >= 0) { const next = [...prev]; next.splice(idx, 1, partA, partB); return next; } return prev; });
        }
      }
    }
  }

  function deleteSelected() {
    if (selectedAudioId) { setAudioTracks((prev) => prev.filter((a) => a.id !== selectedAudioId)); setSelectedAudioId(null); }
    else if (selectedImageId) { setImageOverlays((prev) => prev.filter((a) => a.id !== selectedImageId)); setSelectedImageId(null); }
    else if (selectedTextId) { setTextOverlays((prev) => prev.filter((a) => a.id !== selectedTextId)); setSelectedTextId(null); }
else if (selectedVoId) { setVideoOverlays((prev) => prev.filter((a) => a.id !== selectedVoId)); setSelectedVoId(null); }
    else if (selectedId) { setClips((prev) => prev.filter((c) => c.id !== selectedId)); setSelectedId(null); }
  }

  function timeFromPointer(e: React.PointerEvent) { const rect = rulerRef.current?.getBoundingClientRect(); if (!rect) return 0; return (e.clientX - rect.left) / pps; }
  function reorderToPointer(e: React.PointerEvent, dragId: string) {
    const t = timeFromPointer(e); const list = clipsRef.current; const dragged = list.find((c) => c.id === dragId); if (!dragged) return;
    const others = list.filter((c) => c.id !== dragId); let acc = 0; let idx = others.length;
    for (let i = 0; i < others.length; i++) { const len = effLen(others[i]); if (t < acc + len / 2) { idx = i; break; } acc += len; }
    const next = [...others]; next.splice(idx, 0, dragged);
    const same = next.length === list.length && next.every((c, i) => c.id === list[i].id);
    if (!same) {
      setClips(next);
      // El audio extraído de un video sigue a su clip al reordenar
      const starts = new Map<string, number>();
      let a2 = 0;
      for (const c of next) { starts.set(c.id, a2); a2 += effLen(c); }
      setAudioTracks((prev) => prev.map((tr) => (tr.sourceVideoId && starts.has(tr.sourceVideoId) ? { ...tr, start: starts.get(tr.sourceVideoId)! } : tr)));
    }
  }
  function hasFiles(e: React.DragEvent) { return Array.from(e.dataTransfer.types).includes('Files'); }
  function onDragEnter(e: React.DragEvent) { if (!hasFiles(e)) return; e.preventDefault(); dragDepthRef.current += 1; setDragOver(true); }
  function onDragOver(e: React.DragEvent) { if (!hasFiles(e)) return; e.preventDefault(); }
  function onDragLeave(e: React.DragEvent) { if (!hasFiles(e)) return; dragDepthRef.current -= 1; if (dragDepthRef.current <= 0) { dragDepthRef.current = 0; setDragOver(false); } }
  function onDrop(e: React.DragEvent) { if (!hasFiles(e)) return; e.preventDefault(); dragDepthRef.current = 0; setDragOver(false); addFiles(e.dataTransfer.files); }
  function startTrimDrag(e: React.PointerEvent, clip: Clip, edge: 'start' | 'end') { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); trimDragRef.current = { id: clip.id, edge, startX: e.clientX, origStart: clip.trimStart, origEnd: clip.trimEnd }; }
  function moveTrimDrag(e: React.PointerEvent) {
    const d = trimDragRef.current; if (!d) return; const delta = (e.clientX - d.startX) / pps;
    setClips((prev) => prev.map((cl) => { if (cl.id !== d.id) return cl; if (d.edge === 'start') { const ns = Math.min(Math.max(d.origStart + delta, 0), d.origEnd - MIN_LEN); return { ...cl, trimStart: ns }; } const ne = Math.min(Math.max(d.origEnd + delta, d.origStart + MIN_LEN), cl.duration); return { ...cl, trimEnd: ne }; }));
  }
  function endTrimDrag() { trimDragRef.current = null; }
  function startMoveDrag(e: React.PointerEvent, clip: Clip) { if (e.button !== 0) return; e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); moveDragRef.current = { id: clip.id, startX: e.clientX, active: false }; }
  function moveMoveDrag(e: React.PointerEvent) {
    const d = moveDragRef.current; if (!d) return; if (!d.active) { if (Math.abs(e.clientX - d.startX) < DRAG_THRESHOLD) return; d.active = true; setDraggingId(d.id); } reorderToPointer(e, d.id);
  }
  function endMoveDrag() { const d = moveDragRef.current; moveDragRef.current = null; if (d && !d.active) selectAndSeek(d.id); setDraggingId(null); }
  function startPanDrag(e: React.PointerEvent, clip: Clip) {
    if (!isCover) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    selectOnly(clip.id, 'clip');
    panDragRef.current = { id: clip.id, startX: e.clientX, startY: e.clientY, origX: clip.cropX, origY: clip.cropY };
  }
  function movePanDrag(e: React.PointerEvent) {
    const d = panDragRef.current; if (!d) return;
    const clip = clipsRef.current.find((c) => c.id === d.id); if (!clip) return;
    const stageEl = stageRef.current; const v = videoRef.current;
    if (!stageEl || !v || !v.videoWidth) return;
    const rot = clip.rotate;
    const ew = (rot === 90 || rot === 270) ? stageEl.offsetHeight : stageEl.offsetWidth;
    const eh = (rot === 90 || rot === 270) ? stageEl.offsetWidth : stageEl.offsetHeight;
    const dxs = e.clientX - d.startX; const dys = e.clientY - d.startY;
    let dxe: number; let dye: number;
    if (rot === 90) { dxe = dys; dye = -dxs; }
    else if (rot === 180) { dxe = -dxs; dye = -dys; }
    else if (rot === 270) { dxe = -dys; dye = dxs; }
    else { dxe = dxs; dye = dys; }
    const s = Math.max(ew / v.videoWidth, eh / v.videoHeight);
    const ovX = v.videoWidth * s - ew;
    const ovY = v.videoHeight * s - eh;
    const dpx = ovX > 1 ? dxe / ovX : 0;
    const dpy = ovY > 1 ? dye / ovY : 0;
    let dcx: number; let dcy: number;
    if (rot === 90) { dcy = dpx; dcx = -dpy; }
    else if (rot === 180) { dcx = -dpx; dcy = -dpy; }
    else if (rot === 270) { dcx = dpy; dcy = -dpx; }
    else { dcx = dpx; dcy = dpy; }
    updateClip(d.id, { cropX: clamp(d.origX + dcx, 0, 1), cropY: clamp(d.origY + dcy, 0, 1) });
  }
  function endPanDrag() { panDragRef.current = null; }
  function startOverlayTimeDrag(e: React.PointerEvent, id: string, type: 'text' | 'image' | 'audio' | 'video', mode: OverlayTimeDrag['mode']) {
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); selectOnly(id, type);
    let origStart = 0; let origEnd = 0; let origDuration = 0; let origOffset = 0;
    if (type === 'text') { const t = textOverlaysRef.current.find((x) => x.id === id); if (t) { origStart = t.start; origEnd = t.end; } }
    else if (type === 'image') { const t = imageOverlaysRef.current.find((x) => x.id === id); if (t) { origStart = t.start; origEnd = t.end; } }
    else if (type === 'audio') { const t = audioTracksRef.current.find((x) => x.id === id); if (t) { origStart = t.start; origEnd = t.start + t.duration; origDuration = t.duration; origOffset = t.offset; } }
else { const t = videoOverlaysRef.current.find((x) => x.id === id); if (t) { origStart = t.start; origEnd = t.end; origDuration = t.end - t.start; origOffset = t.offset; } }
    overlayTimeDragRef.current = { id, type, mode, startX: e.clientX, origStart, origEnd, origDuration, origOffset };
  }
  function moveOverlayTimeDrag(e: React.PointerEvent) {
    const d = overlayTimeDragRef.current; if (!d) return; const delta = (e.clientX - d.startX) / pps;
    if (d.type === 'text') {
      const track = textOverlaysRef.current.find((t) => t.id === d.id); if (!track) return; const patch: Partial<TextOverlay> = {};
      if (d.mode === 'move') { const dur = d.origEnd - d.origStart; patch.start = Math.max(d.origStart + delta, 0); patch.end = patch.start + dur; }
      else if (d.mode === 'start') patch.start = Math.max(d.origStart + delta, 0);
      else patch.end = Math.max(d.origEnd + delta, d.origStart + MIN_OVERLAY_LEN);
      updateTextOverlay(d.id, patch);
    } else if (d.type === 'image') {
      const track = imageOverlaysRef.current.find((t) => t.id === d.id); if (!track) return; const patch: Partial<ImageOverlay> = {};
      if (d.mode === 'move') { const dur = d.origEnd - d.origStart; patch.start = Math.max(d.origStart + delta, 0); patch.end = patch.start + dur; }
      else if (d.mode === 'start') patch.start = Math.max(d.origStart + delta, 0);
      else patch.end = Math.max(d.origEnd + delta, d.origStart + MIN_OVERLAY_LEN);
      updateImageOverlay(d.id, patch);
    } else if (d.type === 'audio') {
      const track = audioTracksRef.current.find((t) => t.id === d.id); if (!track) return; const patch: Partial<AudioTrack> = {};
      const origDur = d.origDuration || track.duration; const origOff = d.origOffset ?? track.offset;
      if (d.mode === 'move') patch.start = Math.max(d.origStart + delta, 0);
      else if (d.mode === 'start') { const newTimelineStart = Math.max(d.origStart + delta, 0); const trimmedAmount = newTimelineStart - d.origStart; if (origDur - trimmedAmount > MIN_OVERLAY_LEN) { patch.start = newTimelineStart; patch.duration = origDur - trimmedAmount; patch.offset = origOff + trimmedAmount; } }
      else { const newEnd = Math.max(d.origEnd + delta, d.origStart + MIN_OVERLAY_LEN); patch.duration = Math.max(newEnd - d.origStart, MIN_OVERLAY_LEN); }
updateAudioTrack(d.id, patch);
} else {
const track = videoOverlaysRef.current.find((t) => t.id === d.id); if (!track) return; const patch: Partial<VideoOverlay> = {};
const origDur = d.origDuration || (track.end - track.start); const origOff = d.origOffset ?? track.offset;
if (d.mode === 'move') { const dur = d.origEnd - d.origStart; const ns = Math.max(d.origStart + delta, 0); patch.start = ns; patch.end = ns + dur; }
else if (d.mode === 'start') { const newTimelineStart = Math.max(d.origStart + delta, 0); const trimmedAmount = newTimelineStart - d.origStart; if (origDur - trimmedAmount > MIN_OVERLAY_LEN) { patch.start = newTimelineStart; patch.end = newTimelineStart + (origDur - trimmedAmount); patch.offset = origOff + trimmedAmount; } }
else { patch.end = Math.max(d.origEnd + delta, d.origStart + MIN_OVERLAY_LEN); }
updateVideoOverlay(d.id, patch);
}
  }
  function endOverlayTimeDrag() { overlayTimeDragRef.current = null; }
  function startOverlayPosDrag(e: React.PointerEvent, type: 'text' | 'image' | 'video', id: string) {
    e.stopPropagation(); e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    selectOnly(id, type);
    overlayPosDragRef.current = { type, id };
  }
  function clientToStage(clientX: number, clientY: number) {
    const stageEl = stageRef.current;
    if (!stageEl) return null;
    const rect = stageEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const u = ((clientX - rect.left) / rect.width) * REF_WIDTH;
    const v = ((clientY - rect.top) / rect.height) * REF_HEIGHT;
    return { u, v };
  }
  function moveOverlayPosDrag(e: React.PointerEvent) {
    if (!overlayPosDragRef.current) return;
    const pt = clientToStage(e.clientX, e.clientY);
    if (!pt) return;
    const absX = clamp(pt.u, 0, REF_WIDTH);
    const absY = clamp(pt.v, 0, REF_HEIGHT);
    if (overlayPosDragRef.current.type === 'text') updateTextOverlay(overlayPosDragRef.current.id, { x: absX, y: absY });
    else if (overlayPosDragRef.current.type === 'image') updateImageOverlay(overlayPosDragRef.current.id, { x: absX, y: absY });
else updateVideoOverlay(overlayPosDragRef.current.id, { x: absX, y: absY });
  }
  function endOverlayPosDrag() { overlayPosDragRef.current = null; }
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) { const files = e.target.files; if (!files || files.length === 0) return; addFiles(files); e.target.value = ''; }
  function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) { const files = e.target.files; if (!files || files.length === 0) return; addFiles(files); e.target.value = ''; }

async function handleVoUpload(e: React.ChangeEvent<HTMLInputElement>) {
const files = e.target.files; if (!files || files.length === 0) return;
for (const f of Array.from(files)) {
const url = URL.createObjectURL(f);
const meta = await probeVideoMeta(url);
if (meta.duration <= 0) continue;
const assetId = uid();
try { await putAsset(assetId, f); } catch (err) { console.error('[Autosave] No se pudo guardar el asset:', err); }
const dur = Math.min(5, meta.duration);
const voAudio = await decodeAudioBlob(f);
const vo: VideoOverlay = { id: uid(), assetId, name: f.name, url, start: playheadRef.current, end: playheadRef.current + dur, offset: 0, x: REF_WIDTH * 0.5, y: REF_HEIGHT * 0.5, size: 35, rotate: 0, fadeIn: 0, fadeOut: 0, muted: true, shape: 'none', hasAudio: !!voAudio, srcW: meta.width || 16, srcH: meta.height || 9 };
setVideoOverlays((prev) => [...prev, vo]);
setSelectedVoId(vo.id);
if (/\.mov$/i.test(f.name)) showToast('🎞️ Capa agregada: los .mov con canal alpha NO se ven transparentes en este navegador. Para transparencia real, usá WebM VP9 con alpha.', 'warn', 7000);
else showToast('🎞️ Capa de superposición agregada (WebM VP9 con alpha = transparencia real)', 'info');
}
e.target.value = '';
}

  function addTextOverlay() {
    const newOverlay: TextOverlay = { id: uid(), text: 'Tu texto aquí', start: playheadRef.current, end: playheadRef.current + 5, x: REF_WIDTH * 0.5, y: REF_HEIGHT * 0.5, size: 72, bold: true, font: 'sans', color: '#ffffff', fadeIn: 0, fadeOut: 0 };
    setTextOverlays((prev) => [...prev, newOverlay]); setSelectedTextId(newOverlay.id);
    showToast('✏️ Texto agregado — editálo en el panel de propiedades', 'info');
  }
  function openExportModal() {
    if (projectDuration === 0) { showToast('⚠️ No hay nada en la timeline para exportar', 'warn'); return; }
    setShowExportModal(true);
  }

  async function runExport() {
    if (projectDuration === 0) return;
    if (resInfo.plus && !isPlus) { showToast('🔒 Esta resolución requiere Clipedia Plus', 'warn'); return; }
    setExporting(true);
    previewQueueRef.current = [];
    if (previewFFRef.current) { try { await previewFFRef.current.terminate(); } catch (e) {} previewFFRef.current = null; }
    setExportProgress({ phase: 'preparing', percent: 0, speed: 0 });
    showToast('⏳ Preparando motor de exportación...', 'info');
    const ffLogs: string[] = [];
    let ff: any = null;
    try {
      const { FFmpeg } = await loadFFmpegLib();
      ff = new FFmpeg();
      ff.on('log', ({ message }: any) => { console.log('[FFmpeg Log]', message); ffLogs.push(message); });
      ff.on('progress', ({ progress, time }: any) => {
        const pct = clamp(Math.round((progress || 0) * 100), 0, 100);
        const processedSec = (time || 0) / 1_000_000;
        const elapsedSec = (performance.now() - renderStartRef.current) / 1000;
        const speed = elapsedSec > 0.5 ? processedSec / elapsedSec : 0;
        setExportProgress({ phase: 'rendering', percent: pct, speed: Math.round(speed * 10) / 10 });
      });
      const coreURL = await toBlobURL('/ffmpeg-core.js', 'text/javascript');
      const wasmURL = await toBlobURL('/ffmpeg-core.wasm', 'application/wasm');
      await ff.load({ coreURL, wasmURL });

      const loadedFontFiles = new Set<string>();
      const fontPaths = new Set<string>();
      textOverlays.forEach((txt) => { fontPaths.add(FONT_VARIANTS[txt.font].regular); fontPaths.add(FONT_VARIANTS[txt.font].bold); });
      for (const p of fontPaths) {
        const fname = p.split('/').pop() as string;
        try {
          const fontRes = await fetch(p);
          if (!fontRes.ok) throw new Error(`HTTP ${fontRes.status}`);
          await ff.writeFile(fname, new Uint8Array(await fontRes.arrayBuffer()));
          loadedFontFiles.add(fname);
        } catch (e) { console.error(`[Export] No se pudo cargar la fuente local ${p}.`, e); }
      }
      const inputFiles: string[] = [];
      const writeFsFile = async (fname: string, url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} al leer archivo`);
        const buf = await res.arrayBuffer();
        if (buf.byteLength === 0) throw new Error(`El archivo ${fname} está vacío (0 bytes).`);
        await ff.writeFile(fname, new Uint8Array(buf));
        const verifyData = await ff.readFile(fname);
        if (verifyData.length === 0) throw new Error(`Fallo crítico: ${fname} se escribió como 0 bytes en FFmpeg`);
        return fname;
      };
      for (let i = 0; i < clips.length; i++) inputFiles.push(await writeFsFile(`v${i}.mp4`, clips[i].url));
      for (let i = 0; i < imageOverlays.length; i++) inputFiles.push(`LOOP:${await writeFsFile(`img${i}.png`, imageOverlays[i].url)}`);
for (let i = 0; i < videoOverlays.length; i++) inputFiles.push(await writeFsFile(`vo${i}.webm`, videoOverlays[i].url));

const voMaskIdx: (number | null)[] = [];
for (let i = 0; i < videoOverlays.length; i++) {
const vo = videoOverlays[i];
if (vo.shape !== 'none') {
const sW = vo.srcW || 16; const sH = vo.srcH || 9;
const mW = Math.max(2, Math.round((vo.size / 100) * REF_WIDTH));
const mH = Math.max(2, 2 * Math.round((mW * sH / sW) / 2));
const maskBlob = await generateShapeMask(vo.shape, mW, mH);
if (maskBlob) {
const mname = `vomask${i}.png`;
await ff.writeFile(mname, new Uint8Array(await maskBlob.arrayBuffer()));
inputFiles.push(mname);
voMaskIdx.push(inputFiles.length - 1);
continue;
}
}
voMaskIdx.push(null);
}
const maskCount = voMaskIdx.filter((x) => x !== null).length;



      for (let i = 0; i < audioTracks.length; i++) {
        const ext = audioTracks[i].url.includes('blob') ? 'mp4' : 'mp3';
        inputFiles.push(await writeFsFile(`a${i}.${ext}`, audioTracks[i].url));
      }

      const targetW = Math.round(REF_WIDTH * resInfo.factor);
      const targetH = Math.round(REF_HEIGHT * resInfo.factor);
      let filterComplex = '';
      const inputs: string[] = [];
      inputFiles.forEach((f) => {
        if (f.startsWith('LOOP:')) inputs.push('-loop', '1', '-i', f.slice(5));
        else inputs.push('-i', f);
      });

      // ===== VIDEO: cadena de xfade con transiciones =====
      const videoLabels: string[] = [];
      clips.forEach((c, i) => {
        const t0 = c.trimStart; const t1 = c.trimEnd; const sp = c.speed;
        let rot = '';
        if (c.rotate === 90) rot = 'transpose=1,';
        else if (c.rotate === 180) rot = 'hflip,vflip,';
        else if (c.rotate === 270) rot = 'transpose=2,';
        const pts = sp === 1 ? 'setpts=PTS-STARTPTS' : `setpts=(PTS-STARTPTS)/${sp}`;
        const len = effLen(c);
        let vfades = '';
        if (c.fadeIn > 0) vfades += `,fade=t=in:st=0:d=${c.fadeIn}`;
        if (c.fadeOut > 0) vfades += `,fade=t=out:st=${Math.max(len - c.fadeOut, 0)}:d=${c.fadeOut}`;
        const fitChain = exportSettings.fit === 'recortar'
          ? `scale=${REF_WIDTH}:${REF_HEIGHT}:force_original_aspect_ratio=increase,crop=${REF_WIDTH}:${REF_HEIGHT}:(iw-${REF_WIDTH})*${c.cropX}:(ih-${REF_HEIGHT})*${c.cropY}`
          : `scale=${REF_WIDTH}:${REF_HEIGHT}:force_original_aspect_ratio=decrease,pad=${REF_WIDTH}:${REF_HEIGHT}:(ow-iw)/2:(oh-ih)/2`;
        filterComplex += `[${i}:v]trim=${t0}:${t1},${pts},${rot}fps=30,${fitChain}${vfades}[v${i}_trim];`;
        videoLabels.push(`v${i}_trim`);
      });

      if (videoLabels.length === 0) {
        filterComplex += `color=c=black:s=${REF_WIDTH}x${REF_HEIGHT}:d=${projectDuration}:r=30[basev];`;
      } else if (videoLabels.length === 1) {
        filterComplex += `[${videoLabels[0]}]null[basev];`;
      } else {
        let prevLabel = videoLabels[0];
        let cumulativeTime = effLen(clips[0]);
        for (let i = 1; i < videoLabels.length; i++) {
          const prevClip = clips[i - 1];
          const trans = prevClip.transition || { type: 'none' as TransitionType, duration: 0 };
          if (trans.type === 'none' || trans.duration <= 0) {
            filterComplex += `[${prevLabel}][${videoLabels[i]}]concat=n=2:v=1:a=0[concat${i}];`;
            prevLabel = `concat${i}`;
            cumulativeTime += effLen(clips[i]);
          } else {
            const d = Math.min(trans.duration, effLen(clips[i - 1]), effLen(clips[i]));
            const offset = Math.max(cumulativeTime - d, 0);
            const xfadeType = XFADE_VALID.has(trans.type) ? trans.type : 'fade';
            filterComplex += `[${prevLabel}][${videoLabels[i]}]xfade=transition=${xfadeType}:duration=${d}:offset=${offset}[xfade${i}];`;
            prevLabel = `xfade${i}`;
            cumulativeTime += effLen(clips[i]) - d;
          }
        }
        filterComplex += `[${prevLabel}]null[basev];`;
      }

      let currentVideoLabel = 'basev';
      imageOverlays.forEach((img, i) => {
        const imgInputIdx = clips.length + i;
        const imgWidth = Math.round((img.size / 100) * REF_WIDTH);
        const dur = img.end - img.start;
        let fades = '';
        if (img.fadeIn > 0) fades += `fade=t=in:st=0:d=${img.fadeIn}:alpha=1,`;
        if (img.fadeOut > 0) fades += `fade=t=out:st=${Math.max(dur - img.fadeOut, 0)}:d=${img.fadeOut}:alpha=1,`;
        let irot = '';
        if (img.rotate === 90) irot = 'transpose=1,';
        else if (img.rotate === 180) irot = 'hflip,vflip,';
        else if (img.rotate === 270) irot = 'transpose=2,';
        filterComplex += `[${imgInputIdx}:v]scale=${imgWidth}:-2,format=rgba,${fades}${irot}trim=0:${dur},setpts=PTS+${img.start}/TB[img${i}_f];`;
        filterComplex += `[${currentVideoLabel}][img${i}_f]overlay=x=${img.x}-overlay_w/2:y=${img.y}-overlay_h/2:eof_action=pass:enable='between(t,${img.start},${img.end})'[img${i}_out];`;
        currentVideoLabel = `img${i}_out`;
      });

for (let i = 0; i < videoOverlays.length; i++) {
const vo = videoOverlays[i];
const voInputIdx = clips.length + imageOverlays.length + i;
const sW = vo.srcW || 16; const sH = vo.srcH || 9;
const voWidth = Math.max(2, Math.round((vo.size / 100) * REF_WIDTH));
const voHeight = Math.max(2, 2 * Math.round((voWidth * sH / sW) / 2));
const dur = vo.end - vo.start;
let fades = '';
if (vo.fadeIn > 0) fades += `fade=t=in:st=0:d=${vo.fadeIn}:alpha=1,`;
if (vo.fadeOut > 0) fades += `fade=t=out:st=${Math.max(dur - vo.fadeOut, 0)}:d=${vo.fadeOut}:alpha=1,`;
let vrot = '';
if (vo.rotate === 90) vrot = 'transpose=1,';
else if (vo.rotate === 180) vrot = 'hflip,vflip,';
else if (vo.rotate === 270) vrot = 'transpose=2,';
const mi = voMaskIdx[i];
if (mi !== null && mi !== undefined) {
// ORDEN DEFINITIVO: forma (alphamerge) → rotación → fades de alpha ENCIMA
// de la máscara (alphamerge reemplaza el alpha, así que los fades van después).
filterComplex += `[${voInputIdx}:v]trim=${vo.offset}:${vo.offset + dur},setpts=PTS-STARTPTS,fps=30,scale=${voWidth}:${voHeight},format=rgba[vo${i}_rgb];`;
filterComplex += `[${mi}:v]format=gray[mask${i}g];`;
filterComplex += `[vo${i}_rgb][mask${i}g]alphamerge,${vrot}${fades}setpts=PTS+${vo.start}/TB[vo${i}_f];`;
} else {
filterComplex += `[${voInputIdx}:v]trim=${vo.offset}:${vo.offset + dur},setpts=PTS-STARTPTS,fps=30,scale=${voWidth}:${voHeight},format=rgba,${vrot}${fades}setpts=PTS+${vo.start}/TB[vo${i}_f];`;
}
filterComplex += `[${currentVideoLabel}][vo${i}_f]overlay=x=${vo.x}-overlay_w/2:y=${vo.y}-overlay_h/2:eof_action=pass:enable='between(t,${vo.start},${vo.end})'[vo${i}_out];`;
currentVideoLabel = `vo${i}_out`;
}

      let finalVideoLabel = currentVideoLabel;
      textOverlays.forEach((txt, i) => {
        const variant = FONT_VARIANTS[txt.font];
        let fontFile = (txt.bold ? variant.bold : variant.regular).split('/').pop() as string;
        if (!loadedFontFiles.has(fontFile)) {
          const familyRegular = variant.regular.split('/').pop() as string;
          if (loadedFontFiles.has(familyRegular)) fontFile = familyRegular;
          else {
            const anyFont = Array.from(loadedFontFiles)[0];
            if (!anyFont) { filterComplex += `[${finalVideoLabel}]null[txt${i}_out];`; finalVideoLabel = `txt${i}_out`; return; }
            fontFile = anyFont;
          }
        }
        const textEscaped = txt.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:');
        const S = txt.start; const E = txt.end;
        let alphaExpr = '';
        if (txt.fadeIn > 0 && txt.fadeOut > 0) alphaExpr = `:alpha='max(0,min(1,min((t-${S})/${txt.fadeIn},(${E}-t)/${txt.fadeOut})))'`;
        else if (txt.fadeIn > 0) alphaExpr = `:alpha='max(0,min(1,(t-${S})/${txt.fadeIn}))'`;
        else if (txt.fadeOut > 0) alphaExpr = `:alpha='max(0,min(1,(${E}-t)/${txt.fadeOut}))'`;
        filterComplex += `[${finalVideoLabel}]drawtext=text='${textEscaped}':x=${txt.x}-text_w/2:y=${txt.y}-text_h/2:fontsize=${txt.size}:fontcolor=${txt.color.replace('#', '0x')}:fontfile=${fontFile}${alphaExpr}:enable='between(t,${S},${E})'[txt${i}_out];`;
        finalVideoLabel = `txt${i}_out`;
      });
      filterComplex += `[${finalVideoLabel}]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2[finalv];`;

      // ===== AUDIO: integrado con acrossfade que espeja el xfade de video =====
      const clipAudioLabels: string[] = [];
      clips.forEach((c, i) => {
        if (!c.muted && c.hasAudio !== false) {
          const sp = c.speed;
          const pts = sp === 1 ? 'asetpts=PTS-STARTPTS' : `asetpts=(PTS-STARTPTS)/${sp}`;
          const tempo = sp === 1 ? '' : `,atempo=${sp}`;
          filterComplex += `[${i}:a]atrim=${c.trimStart}:${c.trimEnd},${pts}${tempo},volume=1.0[ca${i}];`;
        } else {
          filterComplex += `anullsrc=r=44100:cl=stereo:d=${effLen(c)}[ca${i}];`;
        }
        clipAudioLabels.push(`ca${i}`);
      });
      let prevAudioLabel = clipAudioLabels[0] ?? '';
      for (let i = 1; i < clipAudioLabels.length; i++) {
        const tr = clips[i - 1].transition;
        const d = tr && tr.type !== 'none' ? Math.min(tr.duration, effLen(clips[i - 1]), effLen(clips[i])) : 0;
        if (d > 0) {
          filterComplex += `[${prevAudioLabel}][${clipAudioLabels[i]}]acrossfade=d=${d}:c1=tri:c2=tri[ax${i}];`;
        } else {
          filterComplex += `[${prevAudioLabel}][${clipAudioLabels[i]}]concat=n=2:v=0:a=1[ax${i}];`;
        }
        prevAudioLabel = `ax${i}`;
      }
      const audioLabels: string[] = [];
      if (clips.length > 0) audioLabels.push(prevAudioLabel);
      audioTracks.forEach((aud, i) => {
        if (!aud.muted) {
          const maskCount = voMaskIdx.filter((x) => x !== null).length;
const audInputIdx = clips.length + imageOverlays.length + videoOverlays.length + maskCount + i;
          const delay = aud.start * 1000;
          let afades = '';
          if (aud.fadeIn > 0) afades += `,afade=t=in:st=0:d=${aud.fadeIn}`;
          if (aud.fadeOut > 0) afades += `,afade=t=out:st=${Math.max(aud.duration - aud.fadeOut, 0)}:d=${aud.fadeOut}`;
          filterComplex += `[${audInputIdx}:a]atrim=${aud.offset}:${aud.offset + aud.duration},asetpts=PTS-STARTPTS,adelay=${delay}|${delay},volume=${aud.volume}${afades}[sa${i}];`;
          audioLabels.push(`sa${i}`);
        }
      });

videoOverlays.forEach((vo, i) => {
if (!vo.muted && vo.hasAudio !== false) {
const voIdx = clips.length + imageOverlays.length + i;
const delay = vo.start * 1000;
filterComplex += `[${voIdx}:a]atrim=${vo.offset}:${vo.offset + (vo.end - vo.start)},asetpts=PTS-STARTPTS,adelay=${delay}|${delay},volume=1.0[va${i}];`;
audioLabels.push(`va${i}`);
}
});

      let finalAudioLabel = 'outa';
      if (audioLabels.length > 0) {
        const amixInputs = audioLabels.map(l => `[${l}]`).join('');
        filterComplex += `${amixInputs}amix=inputs=${audioLabels.length}:duration=longest:dropout_transition=0[${finalAudioLabel}];`;
      } else {
        filterComplex += `anullsrc=r=44100:cl=stereo[${finalAudioLabel}];`;
      }
      filterComplex = filterComplex.replace(/;$/, '');

      const outputFileName = `${exportSettings.filename || 'clipedia_export'}.${fmtInfo.ext}`;
      const videoCodecArgs: string[] = ['-c:v', 'libx264', '-preset', qualInfo.preset, '-crf', String(qualInfo.crf264), '-pix_fmt', 'yuv420p'];
      const audioCodecArgs: string[] = ['-c:a', 'aac', '-b:a', qualInfo.bitrate];
      const formatArgs: string[] = ['-f', exportSettings.format === 'mkv' ? 'matroska' : exportSettings.format];
      if (exportSettings.format !== 'mkv') formatArgs.push('-movflags', '+faststart');
      const args = [
        ...inputs, '-filter_complex', filterComplex,
        '-map', '[finalv]', '-map', `[${finalAudioLabel}]`,
        ...videoCodecArgs, ...audioCodecArgs,
        '-t', projectDuration.toString(),
        ...formatArgs,
        '-y', outputFileName
      ];
      setExportProgress({ phase: 'rendering', percent: 0, speed: 0 });
      renderStartRef.current = performance.now();
      let execError = null;
      let exitCode = 0;
      try { exitCode = await ff.exec(args); }
      catch (e: any) { console.warn('[Export] FFmpeg exec error:', e.message); execError = e; }
      if (exitCode !== 0 && !execError) throw new Error(`FFmpeg terminó con código ${exitCode}. Detalle: ${ffLogs.slice(-3).join(' | ')}`);
      setExportProgress({ phase: 'packaging', percent: 100, speed: 0 });
      let data;
      try { data = await ff.readFile(outputFileName); }
      catch (readError) {
        console.error('[Export] Fallo al leer:', readError);
        if (execError) throw execError;
        throw new Error('El archivo de video no se generó.');
      }
      if (!data || data.length === 0) throw new Error('El archivo generado está vacío. Últimos logs: ' + ffLogs.slice(-6).join(' | '));
      setExportProgress({ phase: 'done', percent: 100, speed: 0 });
      const mime = fmtInfo.ext === 'mkv' ? 'video/x-matroska' : (fmtInfo.ext === 'mov' ? 'video/quicktime' : 'video/mp4');
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = outputFileName;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`✅ ¡Exportado: ${outputFileName}!`, 'info');
      setTimeout(() => { setShowExportModal(false); setExportProgress(null); }, 1500);
    } catch (error: any) {
      console.error('[Export] ERROR FATAL:', error);
      console.error('[Export] Últimas líneas FFmpeg:\n' + ffLogs.slice(-10).join('\n'));
      showToast(`❌ Error: ${error.message || 'Revisá la consola'}`, 'warn');
      setExportProgress(null);
    } finally {
      setExporting(false);
      if (ff) { try { await ff.terminate(); } catch (e) {} }
    }
  }

  const tickStep = pps >= 40 ? 1 : pps >= 20 ? 2 : pps >= 8 ? 5 : 10;
  const ticks: number[] = [];
  for (let s = 0; s <= Math.ceil(projectDuration); s += tickStep) ticks.push(s);
  const stageScale = stage ? stage.width / REF_WIDTH : 0;
    void histVersion;
  void filmstripVersion;

  const exportModal = showExportModal && typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 shadow-2xl shadow-cyan-500/10 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-xl font-black text-white">Exportar video</h2>
            <p className="text-xs text-slate-400 mt-0.5">Configurá la salida antes de renderizar</p>
          </div>
          <button onClick={() => !exporting && setShowExportModal(false)} disabled={exporting} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-40">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">🎯 Resolución</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(RESOLUTION_PRESETS) as Resolution[]).map((r) => {
                const info = RESOLUTION_PRESETS[r];
                const locked = info.plus && !isPlus;
                return (
                  <button key={r}
                    onClick={() => { if (locked) { showToast('🔒 Resolución Plus. Próximamente en Clipedia Plus.', 'warn'); return; } if (!exporting) { setExportSettings((s) => ({ ...s, resolution: r })); if (r === '4K') showToast('🎥 Export 4K: el render en el navegador puede tardar varios minutos y exigir mucha RAM. Paciencia, artista.', 'warn', 8000); } }}
                    disabled={exporting}
                    className={`relative rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${exportSettings.resolution === r ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : locked ? 'border-slate-800 bg-slate-900/30 text-slate-500 cursor-not-allowed' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'} disabled:opacity-60`}>
                    {locked && <span className="absolute -top-1.5 -right-1.5 text-xs">🔒</span>}
                    <div className="text-base font-black">{r}</div>
                    <div className="mt-0.5 text-[10px] font-normal text-slate-400">{locked ? 'Plus' : info.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">📦 Formato</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(FORMAT_PRESETS) as ExportFormat[]).map((f) => (
                <button key={f} onClick={() => !exporting && setExportSettings((s) => ({ ...s, format: f }))} disabled={exporting}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${exportSettings.format === f ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'} disabled:opacity-60`}>
                  <div className="text-base font-black uppercase">{f}</div>
                  <div className="mt-0.5 text-[10px] font-normal text-slate-400">{FORMAT_PRESETS[f].label}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">⚡ Calidad</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(QUALITY_PRESETS) as Quality[]).map((q) => (
                <button key={q} onClick={() => !exporting && setExportSettings((s) => ({ ...s, quality: q }))} disabled={exporting}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${exportSettings.quality === q ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600'} disabled:opacity-60`}>
                  <div className="text-base font-black">{QUALITY_PRESETS[q].label}</div>
                  <div className="mt-0.5 text-[10px] font-normal text-slate-400">{QUALITY_PRESETS[q].desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">✍️ Nombre del archivo</label>
            <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900/50">
              <input type="text" value={exportSettings.filename} onChange={(e) => setExportSettings((s) => ({ ...s, filename: e.target.value }))} disabled={exporting}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500" placeholder="mi_video" />
              <span className="border-l border-slate-700 px-3 py-2.5 text-sm font-mono text-slate-400">.{FORMAT_PRESETS[exportSettings.format].ext}</span>
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
            <p className="font-semibold text-slate-300 mb-1">📊 Resumen del render</p>
            <div className="grid grid-cols-2 gap-1">
              <span>Canvas: <span className="text-slate-200">{REF_WIDTH}×{REF_HEIGHT} ({exportSettings.ratio})</span></span>
              <span>Salida: <span className="text-slate-200">{Math.round(REF_WIDTH * resInfo.factor)}×{Math.round(REF_HEIGHT * resInfo.factor)}</span></span>
              <span>Encuadre: <span className="text-slate-200">{exportSettings.fit === 'recortar' ? 'Recortar (cover)' : 'Adaptar (letterbox)'}</span></span>
              <span>Códec: <span className="text-slate-200">{fmtInfo.video} + {fmtInfo.audio}</span></span>
              <span>Duración: <span className="text-slate-200">{formatTime(projectDuration)}</span></span>
              <span>Calidad: <span className="text-slate-200">CRF {qualInfo.crf264}</span></span>
            </div>
          </div>
          {BETA_PLUS_UNLOCK && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              🎁 <strong>Beta privada:</strong> todas las resoluciones están desbloqueadas temporalmente.
            </div>
          )}
          {exportProgress && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold text-cyan-200">
                  {exportProgress.phase === 'preparing' && '⏳ Preparando...'}
                  {exportProgress.phase === 'rendering' && `🎬 Renderizando... ${exportProgress.percent}%`}
                  {exportProgress.phase === 'packaging' && '📦 Empaquetando...'}
                  {exportProgress.phase === 'done' && '✅ ¡Listo!'}
                </span>
                <span className="text-cyan-300 font-mono">{exportProgress.speed > 0 ? `⚡ ${exportProgress.speed}x` : ''}</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-300" style={{ width: `${exportProgress.percent}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="border-t border-slate-800 px-6 py-4 flex items-center gap-3">
          <button onClick={() => setShowExportModal(false)} disabled={exporting} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-600 disabled:opacity-40">Cancelar</button>
          <button onClick={runExport} disabled={exporting} className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2.5 text-sm font-black text-black transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100">
            {exporting ? `⏳ Exportando... ${exportProgress?.percent ?? 0}%` : `⬇️ Exportar ${exportSettings.resolution} ${exportSettings.format.toUpperCase()}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  // Picker showroom de transiciones (mockup de la fundadora, 28/10)
const transitionPickerUI = transitionPicker !== null && clips[transitionPicker] ? createPortal(
  <TransitionPickerModal
    clip={clips[transitionPicker]}
    onCancel={() => setTransitionPicker(null)}
    onApply={(type, duration) => applyPickedTransition(transitionPicker, type, duration)}
  />,
  document.body
) : null;

  return (
        <div className="flex flex-col gap-2 p-2 lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:overflow-hidden lg:p-4" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <style>{FONT_FACE_CSS}</style>
      {/* ===== BARRA DE ACCIONES MÓVIL (Nuevo + Exportar) ===== */}
            {/* ===== BARRA DE ACCIONES MÓVIL (Importar + Nuevo + Exportar) ===== */}
      <div className="flex shrink-0 items-center gap-2 lg:hidden">
        <button onClick={() => setImportOpen((v) => !v)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${importOpen ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-slate-700 bg-slate-900 text-slate-200'}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></svg>
          Importar
        </button>
        <button onClick={newProject} disabled={exporting} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-slate-200 disabled:opacity-40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-4 w-4" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo
        </button>
        <button onClick={openExportModal} disabled={projectDuration === 0 || exporting} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-2 text-sm font-black text-black disabled:opacity-40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
          {exporting ? `Exportando ${exportProgress?.percent ?? 0}%` : 'Exportar'}
        </button>
      </div>
      {importOpen && (
        <div className="grid shrink-0 grid-cols-5 gap-1.5 lg:hidden">
          <button onClick={() => { setImportOpen(false); fileInputRef.current?.click(); }} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2.5 text-[10px] font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300"><IconVideo className="h-5 w-6" />Video</button>
          <button onClick={() => { setImportOpen(false); imageInputRef.current?.click(); }} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2.5 text-[10px] font-semibold text-slate-200 hover:border-pink-400 hover:text-pink-300"><IconImage className="h-5 w-5" />Imagen</button>
          <button onClick={() => { setImportOpen(false); addTextOverlay(); }} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2.5 text-[10px] font-semibold text-slate-200 hover:border-fuchsia-400 hover:text-fuchsia-300"><IconText className="h-5 w-5" />Texto</button>
          <button onClick={() => { setImportOpen(false); audioInputRef.current?.click(); }} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900/60 px-2 py-2.5 text-[10px] font-semibold text-slate-200 hover:border-green-400 hover:text-green-300"><IconAudio className="h-5 w-5" />Audio</button>
<button onClick={() => { setImportOpen(false); voInputRef.current?.click(); }} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-700 bg-slate-900/60 px-1 py-2.5 text-[10px] font-semibold text-slate-200 hover:border-amber-400 hover:text-amber-300"><IconSuperponer className="h-5 w-5" />Superponer</button>
        </div>
      )}
      {exportModal}
      {transitionPickerUI}
      <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          {toasts.map((t) => (
            <div key={t.id} className={`rounded-lg border px-5 py-2.5 text-sm shadow-2xl backdrop-blur ${t.kind === 'warn' ? 'border-amber-400/40 bg-amber-950/90 text-amber-200' : 'border-cyan-400/40 bg-cyan-950/90 text-cyan-200'}`}>{t.msg}</div>
          ))}
        </div>
      </div>
      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-cyan-400/10">
          <div className="rounded-2xl border-2 border-dashed border-cyan-400 bg-slate-950/95 px-10 py-6 text-center shadow-2xl shadow-cyan-500/20">
            <p className="text-lg font-bold text-cyan-300">Soltá para agregar</p>
            <p className="mt-1 text-xs text-slate-400">Videos → pista de video · Imágenes → pista de imagen · Audios → pista de audio</p>
          </div>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="video/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
      <input ref={audioInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleAudioUpload} />
<input ref={voInputRef} type="file" accept="video/*" multiple className="hidden" onChange={handleVoUpload} />
      {audioTracks.map((track) => (<AudioElement key={track.id} track={track} onReady={registerAudio} onCleanup={unregisterAudio} />))}
            <div className="flex min-h-0 flex-col gap-2 lg:grid lg:flex-1 lg:grid-cols-[116px_1fr_320px] lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-4">
        {/* ===== RAIL LATERAL (solo desktop) ===== */}
<aside className="hidden shrink-0 flex-row gap-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 p-2 lg:flex lg:min-h-0 lg:flex-col lg:gap-1 lg:order-1">
<button onClick={() => fileInputRef.current?.click()} title="Agregar video"
className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-cyan-300">
<IconVideo className="h-[clamp(16px,2.6vh,26px)] w-[clamp(16px,2.6vh,26px)] shrink-0" />
<span className="w-full truncate whitespace-nowrap px-1 text-center text-[clamp(8px,1.3vh,11px)] font-semibold leading-tight">+ Video</span>
</button>
<button onClick={() => imageInputRef.current?.click()} title="Agregar imagen"
className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-pink-300">
<IconImage className="h-[clamp(16px,2.6vh,26px)] w-[clamp(16px,2.6vh,26px)] shrink-0" />
<span className="w-full truncate whitespace-nowrap px-1 text-center text-[clamp(8px,1.3vh,11px)] font-semibold leading-tight">+ Imagen</span>
</button>
<button onClick={addTextOverlay} title="Agregar texto"
className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-fuchsia-300">
<IconText className="h-[clamp(16px,2.6vh,26px)] w-[clamp(16px,2.6vh,26px)] shrink-0" />
<span className="w-full truncate whitespace-nowrap px-1 text-center text-[clamp(8px,1.3vh,11px)] font-semibold leading-tight">+ Texto</span>
</button>
<button onClick={() => audioInputRef.current?.click()} title="Agregar audio"
className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-green-300">
<IconAudio className="h-[clamp(16px,2.6vh,26px)] w-[clamp(16px,2.6vh,26px)] shrink-0" />
<span className="w-full truncate whitespace-nowrap px-1 text-center text-[clamp(8px,1.3vh,11px)] font-semibold leading-tight">+ Audio</span>
</button>
<button onClick={() => voInputRef.current?.click()} title="Superponer: agregá una capa de video"
className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-amber-300">
<IconSuperponer className="h-[clamp(16px,2.6vh,26px)] w-[clamp(16px,2.6vh,26px)] shrink-0" />
<span className="w-full truncate whitespace-nowrap px-1 text-center text-[clamp(8px,1.3vh,11px)] font-semibold leading-tight">+ Superponer</span>
</button>
</aside>
                       <div ref={previewBoxRef} className="relative h-44 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-black sm:h-64 lg:h-auto lg:min-h-0 lg:order-2">
          <div ref={wrapperRef} className="relative h-full w-full">
            {stage && stage.width > 0 && (
              <div ref={stageRef} className="absolute overflow-hidden bg-black" style={{ left: stage.left, top: stage.top, width: stage.width, height: stage.height }}>
                <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${previewRotate}deg)` }}>
                  <video
                    ref={videoRef}
                    className={isCover ? 'cursor-grab active:cursor-grabbing' : ''}
                    style={{ width: videoElemW, height: videoElemH, objectFit: isCover ? 'cover' : 'contain', objectPosition: activeClip ? objectPositionFor(activeClip) : '50% 50%', opacity: previewAlpha }}
                    onPointerDown={(e) => { if (activeClip) startPanDrag(e, activeClip); }}
                    onPointerMove={movePanDrag}
                    onPointerUp={endPanDrag} onPointerCancel={endPanDrag}
                    playsInline suppressHydrationWarning
                  />
                </div>
                <div ref={transitionLayerRef} className="pointer-events-none absolute inset-0 overflow-hidden" style={{ display: 'none' }}>
                  <div className="absolute inset-0 flex items-center justify-center" style={{ transform: `rotate(${previewRotate}deg)` }}>
                    <video ref={transitionVideoRef} className="h-full w-full" style={{ objectFit: isCover ? 'cover' : 'contain', objectPosition: '50% 50%' }} playsInline muted suppressHydrationWarning />
                  </div>
                </div>
                <div className="pointer-events-none absolute" style={{ left: 0, top: 0, width: REF_WIDTH, height: REF_HEIGHT, transform: `scale(${stageScale})`, transformOrigin: '0 0' }}>
                  {activeImage && (
                    <div onPointerDown={(e) => startOverlayPosDrag(e, 'image', activeImage.id)} onPointerMove={moveOverlayPosDrag} onPointerUp={endOverlayPosDrag}
                      className="pointer-events-auto absolute cursor-move touch-none select-none"
                      style={{ left: activeImage.x, top: activeImage.y, width: (activeImage.size / 100) * REF_WIDTH, transform: `translate(-50%, -50%) rotate(${activeImage.rotate}deg)`, opacity: imageAlpha }}
                      title="Arrastrá para mover la imagen">
                      <img src={activeImage.url} alt="Overlay" className="pointer-events-none h-auto w-full" draggable={false} />
                    </div>
                  )}
                  {activeText && (
                    <div onPointerDown={(e) => startOverlayPosDrag(e, 'text', activeText.id)} onPointerMove={moveOverlayPosDrag} onPointerUp={endOverlayPosDrag}
                      className="pointer-events-auto absolute cursor-move touch-none select-none"
                      style={{ left: activeText.x, top: activeText.y, transform: 'translate(-50%, -50%)', opacity: textAlpha }}
                      title="Arrastrá para mover el texto">
                      <p className="whitespace-nowrap" style={{ fontSize: activeText.size, fontWeight: activeText.bold ? 700 : 400, fontFamily: FONT_STACKS[activeText.font], color: activeText.color, textShadow: '0 2px 10px rgba(0,0,0,0.85)' }}>
                        {activeText.text}
                      </p>
                    </div>
                  )}
{videoOverlays.map((vo) => {
const inWin = playhead >= vo.start && playhead <= vo.end;
const wl = vo.end - vo.start; const liw = playhead - vo.start;
let voAlpha = 1;
if (vo.fadeIn > 0 && liw < vo.fadeIn) voAlpha = Math.max(liw / vo.fadeIn, 0);
if (vo.fadeOut > 0 && liw > wl - vo.fadeOut) voAlpha = Math.max((wl - liw) / vo.fadeOut, 0);
const voClip = vo.shape === 'circle' ? 'circle(closest-side at 50% 50%)' : vo.shape === 'round' ? 'inset(0 round 10%)' : undefined;
return (
<div key={vo.id} onPointerDown={(e) => startOverlayPosDrag(e, 'video', vo.id)} onPointerMove={moveOverlayPosDrag} onPointerUp={endOverlayPosDrag} onPointerCancel={endOverlayPosDrag}
className="pointer-events-auto absolute cursor-move touch-none select-none"
style={{ left: vo.x, top: vo.y, width: (vo.size / 100) * REF_WIDTH, transform: `translate(-50%, -50%) rotate(${vo.rotate}deg)`, opacity: voAlpha, visibility: inWin ? 'visible' : 'hidden', clipPath: voClip }}
title="Arrastrá para mover la superposición">
<video ref={(el) => { if (el) voElementsRef.current.set(vo.id, el); else voElementsRef.current.delete(vo.id); }}
src={vo.url} playsInline muted={vo.muted} preload="auto" className="pointer-events-none h-auto w-full" />
</div>
);
})}

                </div>
              </div>
            )}
          </div>
          {activeUsesProxy && (
            <div className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold text-green-300 backdrop-blur-sm">⚡ PROXY 480p</div>
          )}
          {previewRenderStatus.rendering && (
            <div className="absolute bottom-2 left-1/2 z-20 w-[min(92%,26rem)] -translate-x-1/2 rounded-xl border border-violet-400/40 bg-slate-950/90 px-3 py-2 shadow-2xl shadow-violet-500/20 backdrop-blur">
              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-violet-200">
                <span className="truncate">{previewPreparing ? '⚙️ Preparando transiciones…' : `✨ Renderizando transiciones ${Math.min(doneRef.current + 1, Math.max(totalNow, 1))}/${Math.max(totalNow, 1)}`}</span>
                <span className="shrink-0 font-mono text-violet-300">{previewPreparing ? '—' : `${previewPercent}%`}</span>
                <button onClick={cancelPreviewRenders} className="shrink-0 rounded-md px-1.5 py-0.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-300" title="Cancelar render">✕</button>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                <div className={`h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400 transition-all duration-200 ${previewPreparing ? 'w-1/3 animate-pulse' : ''}`} style={previewPreparing ? undefined : { width: `${previewPercent}%` }} />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">Hasta que cada transición esté lista, el preview muestra cortes limpios.</p>
            </div>
          )}
          {clips.length === 0 && imageOverlays.length === 0 && audioTracks.length === 0 && videoOverlays.length === 0 && (
            <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 transition-colors hover:text-cyan-300">
              <p className="text-lg font-semibold">Arrastrá tus videos, imágenes o audios acá</p>
              <p className="text-sm">Videos → pista de video · Imágenes → pista de imagen · Audios → pista de audio</p>
            </button>
          )}
        </div>

{/* ===== BARRA DE TRANSPORTE ===== */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 px-2 py-1.5 lg:order-4 lg:col-span-3 lg:gap-2 lg:px-3 lg:py-2">
        {/* Cluster móvil: tiempo + play gigante + saltos */}
                                <div className="flex w-full items-center gap-1.5 lg:hidden">
          <button onClick={togglePlay} disabled={projectDuration === 0} className="relative z-10 -my-4 h-14 w-14 shrink-0 transition-transform active:scale-95 disabled:opacity-40" title={playing ? 'Pausar' : 'Reproducir'}>
            {playing ? <IconPauseCorel className="h-full w-full drop-shadow-[0_6px_16px_rgba(131,58,236,0.45)]" /> : <IconPlayCorel className="h-full w-full drop-shadow-[0_6px_16px_rgba(131,58,236,0.45)]" />}
          </button>
          <button onClick={() => seek(0)} disabled={projectDuration === 0} className="flex shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-200 disabled:opacity-40" title="Ir al inicio"><IconSkipBack className="h-3.5 w-3.5" /></button>
          <button onClick={() => seek(projectDuration)} disabled={projectDuration === 0} className="flex shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 p-1.5 text-slate-200 disabled:opacity-40" title="Ir al final"><IconSkipForward className="h-3.5 w-3.5" /></button>
          <div className="min-w-0 flex-1 truncate whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1.5 text-center font-mono text-[11px] tabular-nums text-cyan-300"><span ref={tcMobileRef}>00:00.0</span> <span className="text-slate-500">/ {formatTime(projectDuration)}</span></div>
          <button onClick={toggleProxies}
            className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-colors ${proxiesOn ? 'border-violet-400/60 bg-violet-500/15 text-violet-200' : 'border-slate-700 bg-slate-900 text-slate-400'}`}
            title={proxiesOn ? 'Desactivar proxies 480p' : 'Activar proxies 480p'}>
            <Icon480p className="h-4 w-3.5 shrink-0" />
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${proxiesOn ? 'bg-green-400' : 'bg-slate-500'}`} />
            <span className="hidden min-[400px]:inline">Proxies</span>
          </button>
        </div>
                        <button onClick={() => seek(0)} disabled={projectDuration === 0} className="hidden items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40 lg:flex" title="Ir al inicio"><IconSkipBack className="h-4 w-4" /></button>
        <button onClick={togglePlay} disabled={projectDuration === 0} className="relative z-10 -my-5 hidden h-16 w-16 shrink-0 items-center justify-center transition-transform hover:scale-[1.04] active:scale-95 disabled:opacity-40 lg:flex" title={playing ? 'Pausar' : 'Reproducir'}>
{playing ? <IconPauseCorel className="h-full w-full drop-shadow-[0_6px_16px_rgba(131,58,236,0.45)]" /> : <IconPlayCorel className="h-full w-full drop-shadow-[0_6px_16px_rgba(131,58,236,0.45)]" />}
</button>
                <div className="hidden rounded-lg bg-slate-800 px-3 py-2 font-mono text-sm text-cyan-300 lg:block"><span ref={tcDesktopRef}>00:00.0</span> <span className="text-slate-500">/ {formatTime(projectDuration)}</span></div>
        <div className="mx-1 hidden h-6 w-px bg-slate-700 lg:block" />
        <div className="hidden items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900/50 p-1 lg:flex">
          {(Object.keys(RATIO_PRESETS) as AspectRatio[]).map((r) => (
            <button key={r} onClick={() => setExportSettings((s) => ({ ...s, ratio: r }))} disabled={exporting}
              className={`rounded px-2 py-1 text-xs font-bold transition ${exportSettings.ratio === r ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black shadow-sm shadow-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'} disabled:opacity-50`}
              title={RATIO_PRESETS[r].label}>{r}</button>
          ))}
        </div>
        <div className="hidden items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900/50 p-1 lg:flex">
                    <button onClick={() => setExportSettings((s) => ({ ...s, fit: 'adaptar' }))} disabled={exporting}
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-bold transition ${exportSettings.fit === 'adaptar' ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black shadow-sm shadow-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'} disabled:opacity-50`}
            title="El video entra completo (letterbox)"><IconFit className="h-3.5 w-3.5" /> Adaptar</button>
          <button onClick={() => { setExportSettings((s) => ({ ...s, fit: 'recortar' })); showToast('✂️ Modo Recortar: arrastrá el video en el preview para reencuadrar', 'info'); }} disabled={exporting}
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-bold transition ${exportSettings.fit === 'recortar' ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black shadow-sm shadow-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'} disabled:opacity-50`}
            title="El video cubre todo el canvas (recorta sobrantes)"><IconCrop className="h-3.5 w-3.5" /> Recortar</button>
        </div>
        <div className="mx-1 hidden h-6 w-px bg-slate-700 lg:block" />
                <button onClick={undo} disabled={historyPast.current.length === 0} className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40 lg:flex" title="Deshacer (Ctrl+Z)"><IconUndo className="h-4 w-4" /> Deshacer</button>
        <button onClick={redo} disabled={historyFuture.current.length === 0} className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40 lg:flex" title="Rehacer (Ctrl+Shift+Z)"><IconRedo className="h-4 w-4" /> Rehacer</button>
        <button onClick={splitAtPlayhead} disabled={!selectedClip && !selectedImage && !selectedText && !selectedAudio} className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40 lg:flex"><IconScissors className="h-4 w-4" /> Dividir</button>
        <button onClick={deleteSelected} disabled={!selectedClip && !selectedImage && !selectedText && !selectedAudio} className="hidden items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-40 lg:flex"><IconTrash className="h-4 w-4" /> Eliminar</button>
       <div className="hidden flex-1 lg:block" />
        <button onClick={togglePreviewTransitions} disabled={clips.length < 2}
          className={`hidden items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors lg:flex ${previewTransitions ? (previewRenderStatus.rendering ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-green-400 bg-green-500/20 text-green-200') : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-violet-400 hover:text-violet-300'} disabled:opacity-40`}
          title="Previsualizar las transiciones con render real del solape. Se desactiva solo si editás la pista de video.">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${previewTransitions ? (previewRenderStatus.rendering ? 'animate-pulse bg-amber-400' : 'bg-green-400') : 'bg-red-500'}`} />
                              {previewTransitions && previewRenderStatus.rendering ? <><IconSparkles className="h-4 w-4 animate-pulse" /> Render {previewPercent}%</> : <><IconSparkles className="h-4 w-4" /> Previsualizar transiciones</>}
        </button>
      </div>

               <div className="flex shrink-0 flex-col gap-2 lg:min-h-0 lg:flex-1 lg:gap-4 lg:order-3">
          {/* Toggle de propiedades (solo móvil) */}
          <button onClick={() => setPropsOpen((v) => !v)} className="flex shrink-0 items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-bold text-slate-200 lg:hidden">
            <span>🎛 Propiedades{selectedClip || selectedImage || selectedText || selectedAudio ? ' · elemento seleccionado' : ''}</span>
            <span className="text-cyan-300">{propsOpen ? '▲' : '▼'}</span>
          </button>
          <div className="hidden shrink-0 items-stretch gap-2 lg:flex">
            <button onClick={openExportModal} disabled={projectDuration === 0 || exporting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3 text-sm font-black text-black transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
              title="Exportar el proyecto">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
              </svg>
              {exporting ? `Exportando ${exportProgress?.percent ?? 0}%` : 'Exportar'}
            </button>
            <button onClick={newProject} disabled={exporting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-3 text-sm font-black text-white transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
              title="Proyecto nuevo (descarta el actual)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nuevo
            </button>
          </div>
                    <aside className={`${propsOpen ? 'block' : 'hidden'} space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4 lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}>
            <div><h2 className="text-lg font-bold text-white">Propiedades</h2><p className="mt-1 text-xs text-slate-400">Seleccioná un elemento en la timeline para editarlo.</p></div>
            {selectedClip && !selectedImage && !selectedText && !selectedAudio && !selectedVo && (
              <div className="space-y-3">
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
                <label className="block select-none text-xs text-slate-400">Fade in: {selectedClip.fadeIn.toFixed(1)}s<input type="range" min={0} max={3} step={0.1} value={selectedClip.fadeIn} onChange={(e) => updateClip(selectedClip.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-cyan-400" /></label>
                <label className="block select-none text-xs text-slate-400">Fade out: {selectedClip.fadeOut.toFixed(1)}s<input type="range" min={0} max={3} step={0.1} value={selectedClip.fadeOut} onChange={(e) => updateClip(selectedClip.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-cyan-400" /></label>
                <button onClick={() => toggleSeparateAudio(selectedClip)} disabled={!selectedClip.hasAudio}
                  className={`w-full rounded-lg py-2 text-sm font-semibold transition-colors ${audioTracks.some((t) => t.sourceVideoId === selectedClip.id) ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40 hover:bg-amber-500/30' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'} disabled:opacity-40`}
                  title={!selectedClip.hasAudio ? 'Este video no tiene audio' : 'Alternar entre audio integrado y pista separada'}>
                  {audioTracks.some((t) => t.sourceVideoId === selectedClip.id) ? '🎵 Audio separado del video (reintegrar)' : '🎵 Separar audio de video'}
                </button>
              
                
              </div>
            )}
            {selectedImage && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imagen: <span className="normal-case text-pink-300">{selectedImage.name}</span></p>
                <label className="block select-none text-xs text-slate-400">Tamaño: {selectedImage.size}%<input type="range" min={5} max={150} step={1} value={selectedImage.size} onChange={(e) => updateImageOverlay(selectedImage.id, { size: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>
                <button onClick={() => updateImageOverlay(selectedImage.id, { rotate: ((selectedImage.rotate + 90) % 360) as ImageOverlay['rotate'] })} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-pink-400 hover:text-pink-400">⟲ Rotar imagen ({selectedImage.rotate}°)</button>
                <label className="block select-none text-xs text-slate-400">Fade in: {selectedImage.fadeIn.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedImage.fadeIn} onChange={(e) => updateImageOverlay(selectedImage.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>
                <label className="block select-none text-xs text-slate-400">Fade out: {selectedImage.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedImage.fadeOut} onChange={(e) => updateImageOverlay(selectedImage.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>
                <p className="text-[11px] leading-relaxed text-slate-500"> De {selectedImage.start.toFixed(1)}s a {selectedImage.end.toFixed(1)}s</p>
                <button onClick={() => { setImageOverlays((prev) => prev.filter((a) => a.id !== selectedImage.id)); setSelectedImageId(null); }} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">Eliminar imagen</button>
              </div>
            )}
            {selectedText && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Texto</p>
                <input type="text" value={selectedText.text} onChange={(e) => updateTextOverlay(selectedText.id, { text: e.target.value })} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-fuchsia-400" />
                <select value={selectedText.font} onChange={(e) => updateTextOverlay(selectedText.id, { font: e.target.value as TextOverlay['font'] })} className="rounded-lg bg-slate-800 px-2 py-2 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-fuchsia-400">
                  <option value="sans">Sans (Roboto)</option><option value="serif">Serif (Merriweather)</option><option value="mono">Mono (Source Code Pro)</option><option value="roboto">Roboto</option><option value="playfair">Playfair Display</option><option value="montserrat">Montserrat</option><option value="opensans">Open Sans</option><option value="lato">Lato</option><option value="oswald">Oswald</option><option value="raleway">Raleway</option><option value="poppins">Poppins</option><option value="merriweather">Merriweather</option><option value="nunito">Nunito</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateTextOverlay(selectedText.id, { bold: !selectedText.bold })} className={`rounded-lg py-2 text-sm font-bold transition-colors ${selectedText.bold ? 'bg-fuchsia-500 text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>B</button>
                  <input type="color" value={selectedText.color} onChange={(e) => updateTextOverlay(selectedText.id, { color: e.target.value })} className="h-9 w-full cursor-pointer rounded-lg border border-slate-700 bg-slate-800 p-1" />
                </div>
                <label className="block select-none text-xs text-slate-400">Tamaño: {selectedText.size}px<input type="range" min={16} max={400} step={2} value={selectedText.size} onChange={(e) => updateTextOverlay(selectedText.id, { size: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>
                <label className="block select-none text-xs text-slate-400">Fade in: {selectedText.fadeIn.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedText.fadeIn} onChange={(e) => updateTextOverlay(selectedText.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>
                <label className="block select-none text-xs text-slate-400">Fade out: {selectedText.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedText.fadeOut} onChange={(e) => updateTextOverlay(selectedText.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>
                <p className="text-[11px] leading-relaxed text-slate-500"> De {selectedText.start.toFixed(1)}s a {selectedText.end.toFixed(1)}s</p>
                <button onClick={() => { setTextOverlays((prev) => prev.filter((a) => a.id !== selectedText.id)); setSelectedTextId(null); }} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">Eliminar texto</button>
              </div>
            )}
            {selectedAudio && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audio: <span className="normal-case text-green-300">{selectedAudio.name}</span></p>
                {selectedAudio.sourceVideoId && <p className="text-[11px] text-slate-500">🔗 Audio extraído de video</p>}
                <label className="block select-none text-xs text-slate-400">Volumen: {Math.round(selectedAudio.volume * 100)}%<input type="range" min={0} max={1} step={0.01} value={selectedAudio.volume} onChange={(e) => updateAudioTrack(selectedAudio.id, { volume: Number(e.target.value) })} className="mt-1 w-full accent-green-400" /></label>
                <label className="block select-none text-xs text-slate-400">Fade in: {selectedAudio.fadeIn.toFixed(1)}s<input type="range" min={0} max={3} step={0.1} value={selectedAudio.fadeIn} onChange={(e) => updateAudioTrack(selectedAudio.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-green-400" /></label>
                <label className="block select-none text-xs text-slate-400">Fade out: {selectedAudio.fadeOut.toFixed(1)}s<input type="range" min={0} max={3} step={0.1} value={selectedAudio.fadeOut} onChange={(e) => updateAudioTrack(selectedAudio.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-green-400" /></label>
                <button onClick={() => updateAudioTrack(selectedAudio.id, { muted: !selectedAudio.muted })} className={`w-full rounded-lg py-2 text-sm font-semibold transition-colors ${selectedAudio.muted ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}>{selectedAudio.muted ? '🔇 Desmutear' : '🔊 Mutear'}</button>
                <p className="text-[11px] leading-relaxed text-slate-500"> De {selectedAudio.start.toFixed(1)}s a {(selectedAudio.start + selectedAudio.duration).toFixed(1)}s</p>
                <button onClick={() => { setAudioTracks((prev) => prev.filter((a) => a.id !== selectedAudio.id)); setSelectedAudioId(null); }} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">Eliminar audio</button>
              </div>
            )}

{selectedVo && (
<div className="space-y-3">
<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Superposición: <span className="normal-case text-amber-300">{selectedVo.name}</span></p>
<label className="block select-none text-xs text-slate-400">Tamaño: {selectedVo.size}%<input type="range" min={5} max={150} step={1} value={selectedVo.size} onChange={(e) => updateVideoOverlay(selectedVo.id, { size: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" /></label>
<button onClick={() => updateVideoOverlay(selectedVo.id, { rotate: ((selectedVo.rotate + 90) % 360) as VideoOverlay['rotate'] })} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-400 hover:text-amber-400">⟲ Rotar capa ({selectedVo.rotate}°)</button>
<div>
<p className="mb-1 text-[11px] font-semibold text-amber-200">Marco (efecto de forma)</p>
<div className="grid grid-cols-3 gap-1.5">
{(['none', 'round', 'circle'] as OverlayShape[]).map((sh) => (
<button key={sh} onClick={() => updateVideoOverlay(selectedVo.id, { shape: sh })}
className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${selectedVo.shape === sh ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'}`}>
{sh === 'none' ? 'Rect' : sh === 'round' ? 'Redondeado' : 'Círculo'}
</button>
))}
</div>
</div>
<label className="block select-none text-xs text-slate-400">Fade in (opacidad): {selectedVo.fadeIn.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedVo.fadeIn} onChange={(e) => updateVideoOverlay(selectedVo.id, { fadeIn: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" /></label>
<label className="block select-none text-xs text-slate-400">Fade out (opacidad): {selectedVo.fadeOut.toFixed(1)}s<input type="range" min={0} max={2} step={0.1} value={selectedVo.fadeOut} onChange={(e) => updateVideoOverlay(selectedVo.id, { fadeOut: Number(e.target.value) })} className="mt-1 w-full accent-amber-400" /></label>
<button onClick={() => updateVideoOverlay(selectedVo.id, { muted: !selectedVo.muted })} disabled={selectedVo.hasAudio === false} className={`w-full rounded-lg py-2 text-sm font-semibold transition-colors ${selectedVo.muted ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}>{selectedVo.muted ? '🔇 Sin audio (click para activar)' : '🔊 Con audio'}</button>
<p className="text-[11px] leading-relaxed text-slate-500"> De {selectedVo.start.toFixed(1)}s a {selectedVo.end.toFixed(1)}s · empieza en {selectedVo.offset.toFixed(1)}s del archivo</p>
<button onClick={() => { setVideoOverlays((prev) => prev.filter((a) => a.id !== selectedVo.id)); setSelectedVoId(null); }} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 text-xs font-semibold text-slate-400 transition-colors hover:border-red-400 hover:text-red-400">Eliminar capa</button>
</div>
)}

            {!selectedClip && !selectedImage && !selectedText && !selectedAudio && !selectedVo && (
              <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-xs text-slate-500">Hacé clic en un bloque de la timeline para ver sus propiedades acá.</p>
            )}
          </aside>
        </div>
      </div>
      
            {/* ===== TARJETA DE HERRAMIENTAS MÓVIL (3 grupos funcionales) ===== */}
      <div className="flex shrink-0 gap-1.5 lg:hidden">
        <div className="flex flex-[3] rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          <button onClick={cycleRatio} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold text-slate-300 hover:bg-slate-800">
            <span className="flex h-5 w-full items-center justify-center"><span className="rounded border border-slate-600 px-1.5 font-mono text-[9px] leading-none">{exportSettings.ratio}</span></span>
            <span className="w-full truncate leading-none">Relación</span>
          </button>
          <button onClick={() => setExportSettings((s) => ({ ...s, fit: 'adaptar' }))} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold hover:bg-slate-800 ${exportSettings.fit === 'adaptar' ? 'text-cyan-300' : 'text-slate-300'}`}>
            <span className="flex h-5 w-full items-center justify-center"><IconFit className="h-5 w-5" /></span>
            <span className="w-full truncate leading-none">Adaptar</span>
          </button>
          <button onClick={() => setExportSettings((s) => ({ ...s, fit: 'recortar' }))} className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold hover:bg-slate-800 ${exportSettings.fit === 'recortar' ? 'text-cyan-300' : 'text-slate-300'}`}>
            <span className="flex h-5 w-full items-center justify-center"><IconCrop className="h-5 w-5" /></span>
            <span className="w-full truncate leading-none">Recortar</span>
          </button>
        </div>
        <div className="flex flex-[4] rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          <button onClick={undo} disabled={historyPast.current.length === 0} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40">
            <span className="flex h-5 w-full items-center justify-center"><IconUndo className="h-5 w-5" /></span>
            <span className="w-full truncate leading-none">Deshacer</span>
          </button>
          <button onClick={redo} disabled={historyFuture.current.length === 0} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40">
            <span className="flex h-5 w-full items-center justify-center"><IconRedo className="h-5 w-5" /></span>
            <span className="w-full truncate leading-none">Rehacer</span>
          </button>
          <button onClick={splitAtPlayhead} disabled={!selectedClip && !selectedImage && !selectedText && !selectedAudio} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40">
            <span className="flex h-5 w-full items-center justify-center"><IconScissors className="h-5 w-5" /></span>
            <span className="w-full truncate leading-none">Dividir</span>
          </button>
          <button onClick={deleteSelected} disabled={!selectedClip && !selectedImage && !selectedText && !selectedAudio} className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[9px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-40">
            <span className="flex h-5 w-full items-center justify-center"><IconTrash className="h-5 w-5" /></span>
            <span className="w-full truncate leading-none">Eliminar</span>
          </button>
        </div>
        <div className="flex shrink-0 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          <button onClick={togglePreviewTransitions} disabled={clips.length < 2} className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 text-[9px] font-semibold hover:bg-slate-800 disabled:opacity-40 ${previewTransitions ? 'text-green-300' : 'text-slate-300'}`}>
            <span className="flex h-5 w-full items-center justify-center"><span className={`inline-block h-2.5 w-2.5 rounded-full ${previewTransitions ? (previewRenderStatus.rendering ? 'animate-pulse bg-amber-400' : 'bg-green-400') : 'bg-red-500'}`} /></span>
            <span className="w-full truncate leading-none">{previewRenderStatus.rendering ? `${previewPercent}%` : 'Transiciones'}</span>
          </button>
        </div>
      </div>
      {/* ===== TIMELINE CON ZOOM ===== */}
      <div className="relative flex min-h-[15rem] flex-1 flex-col rounded-xl border border-slate-800 bg-slate-900/60 lg:flex-none lg:shrink-0">
                <div className="absolute right-1.5 top-1.5 z-30 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 shadow-lg backdrop-blur lg:right-3 lg:top-3">
          <button onClick={() => zoomBy(1 / 1.25)} className="rounded px-2 py-0.5 text-xs font-bold text-slate-300 hover:bg-slate-800" title="Alejar">−</button>
          <span className="w-12 text-center font-mono text-[10px] text-cyan-300">{Math.round((pps / DEFAULT_PPS) * 100)}%</span>
          <button onClick={() => zoomBy(1.25)} className="rounded px-2 py-0.5 text-xs font-bold text-slate-300 hover:bg-slate-800" title="Acercar">+</button>
          <button onClick={() => { pendingAnchorRef.current = null; setPps(DEFAULT_PPS); }} className="rounded px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:bg-slate-800" title="Restablecer zoom">1:1</button>
        </div>
         <div ref={timelineScrollRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain p-2 lg:flex-none lg:max-h-none lg:overflow-y-hidden lg:p-4">
          <div className="relative" style={{ width: Math.max(projectDuration * pps + 160, 700) }}>
            <div ref={rulerRef} className="sticky top-0 z-10 h-6 cursor-pointer select-none border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm lg:h-7" onPointerDown={(e) => { scrubbingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); seek(timeFromPointer(e)); }} onPointerMove={(e) => { if (scrubbingRef.current) seek(timeFromPointer(e)); }} onPointerUp={() => { scrubbingRef.current = false; }} onPointerCancel={() => { scrubbingRef.current = false; }}>
              {ticks.map((s) => (<div key={s} className="absolute top-0 h-full" style={{ left: s * pps }}><div className="h-2 w-px bg-slate-600" /><span className="ml-1 text-[10px] text-slate-500">{s}s</span></div>))}
            </div>
            <div className="relative mt-1.5 h-9 rounded-lg bg-slate-800/20 lg:mt-2">
              {imageOverlays.map((img) => {
                const isSelected = img.id === selectedImageId; const width = (img.end - img.start) * pps; const left = img.start * pps;
                return (<div key={img.id} onPointerDown={(e) => startOverlayTimeDrag(e, img.id, 'image', 'move')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} style={{ left, width }} className={`absolute bottom-1 top-1 cursor-grab select-none touch-pan-y overflow-hidden rounded-md border px-2 ${isSelected ? 'border-pink-400 bg-pink-500/20 ring-1 ring-pink-400' : 'border-pink-400/60 bg-pink-500/10'}`} title="Arrastrá para mover · bordes para recortar">
                  <p className="relative z-10 truncate text-[10px] font-semibold text-pink-200 drop-shadow">🖼️ {img.name}</p>
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, img.id, 'image', 'start')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} className="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize touch-none bg-pink-400/50 hover:bg-pink-400" />
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, img.id, 'image', 'end')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize touch-none bg-pink-400/50 hover:bg-pink-400" />
                </div>);
              })}
              {imageOverlays.length === 0 && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-600">🖼️ Pista de imagen — arrastrá una imagen o hacé clic en "+ Imagen"</div>)}
              <div className="pointer-events-none absolute inset-y-0 left-1 flex items-center text-[10px] font-semibold text-slate-600">I</div>
            </div>
            <div className="relative mt-2 h-12 rounded-lg bg-slate-800/20 lg:h-9">
              {textOverlays.map((txt) => {
                const isSelected = txt.id === selectedTextId; const width = (txt.end - txt.start) * pps; const left = txt.start * pps;
                return (<div key={txt.id} onPointerDown={(e) => startOverlayTimeDrag(e, txt.id, 'text', 'move')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} style={{ left, width }} className={`absolute bottom-1 top-1 cursor-grab select-none touch-pan-y overflow-hidden rounded-md border px-2 ${isSelected ? 'border-fuchsia-400 bg-fuchsia-500/20 ring-1 ring-fuchsia-400' : 'border-fuchsia-400/60 bg-fuchsia-500/10'}`} title="Arrastrá para mover · bordes para recortar">
                  <p className="relative z-10 truncate text-[10px] font-semibold text-fuchsia-200 drop-shadow">T: {txt.text}</p>
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, txt.id, 'text', 'start')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} className="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize touch-none bg-fuchsia-400/50 hover:bg-fuchsia-400" />
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, txt.id, 'text', 'end')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize touch-none bg-fuchsia-400/50 hover:bg-fuchsia-400" />
                </div>);
              })}
              {textOverlays.length === 0 && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-600">T Pista de texto — hacé clic en "+ Texto"</div>)}
              <div className="pointer-events-none absolute inset-y-0 left-1 flex items-center text-[10px] font-semibold text-slate-600">T</div>
            </div>

<div className="relative mt-2 h-12 rounded-lg bg-slate-800/20 lg:h-9">
{videoOverlays.map((vo) => {
const isSelected = vo.id === selectedVoId; const width = (vo.end - vo.start) * pps; const left = vo.start * pps;
return (<div key={vo.id} onPointerDown={(e) => startOverlayTimeDrag(e, vo.id, 'video', 'move')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} style={{ left, width }} className={`absolute bottom-1 top-1 cursor-grab select-none touch-pan-y overflow-hidden rounded-md border px-2 ${isSelected ? 'border-amber-400 bg-amber-500/20 ring-1 ring-amber-400' : 'border-amber-400/60 bg-amber-500/10'}`} title="Arrastrá para mover · bordes para recortar">
<p className="relative z-10 truncate text-[10px] font-semibold text-amber-200 drop-shadow"><IconVideo className="mr-1 inline h-3 w-3" />{vo.name}{vo.muted ? ' 🔇' : ''}</p>
<div onPointerDown={(e) => startOverlayTimeDrag(e, vo.id, 'video', 'start')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} className="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize touch-none bg-amber-400/50 hover:bg-amber-400" />
<div onPointerDown={(e) => startOverlayTimeDrag(e, vo.id, 'video', 'end')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize touch-none bg-amber-400/50 hover:bg-amber-400" />
</div>);
})}
{videoOverlays.length === 0 && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-600">Capa de superposición — agregá un video con "+ Superponer"</div>)}
<div className="pointer-events-none absolute inset-y-0 left-1 flex items-center text-[10px] font-semibold text-slate-600">S</div>
</div>

            <div className="relative mt-1.5 h-16 rounded-lg bg-slate-800/40 lg:mt-2 lg:h-20">
              {clips.map((c, i) => {
                const hasTransition = c.transition && c.transition.type !== 'none' && i < clips.length - 1;
                return (
                  <React.Fragment key={c.id}>
                    <div onPointerDown={(e) => startMoveDrag(e, c)} onPointerMove={moveMoveDrag} onPointerUp={endMoveDrag} onPointerCancel={endMoveDrag} style={{ left: videoStarts[i] * pps, width: Math.max(effLen(c) * pps - 2, 8) }} className={`absolute bottom-1 top-1 select-none touch-pan-y overflow-hidden rounded-md border px-2 py-1 ${draggingId === c.id ? 'cursor-grabbing border-cyan-300 bg-cyan-500/30 opacity-60 ring-2 ring-cyan-300' : c.id === selectedId ? 'cursor-grab border-violet-400 bg-violet-500/20 ring-1 ring-violet-400' : i === activeIndex ? 'cursor-grab border-cyan-400 bg-cyan-500/20' : 'cursor-grab border-slate-600 bg-gradient-to-br from-cyan-500/10 to-violet-500/10'}`}>
                                            <ClipFilmstrip clip={c} />
<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/25 to-slate-950/70" />
{blendLen(i) > 0 && (
  <div className="pointer-events-none absolute bottom-0 right-0 top-0 border-l border-dashed border-violet-300/70"
    style={{ width: `${(blendLen(i) / effLen(c)) * 100}%`, background: 'repeating-linear-gradient(-45deg, rgba(167,139,250,0.38) 0 5px, rgba(167,139,250,0.10) 5px 10px)' }} />
)}
{blendLen(i - 1) > 0 && (
  <div className="pointer-events-none absolute bottom-0 left-0 top-0 border-r border-dashed border-cyan-300/70"
    style={{ width: `${(blendLen(i - 1) / effLen(c)) * 100}%`, background: 'repeating-linear-gradient(-45deg, rgba(34,211,238,0.32) 0 5px, rgba(34,211,238,0.10) 5px 10px)' }} />
)}
                      <p className="relative truncate text-xs font-semibold text-cyan-200 drop-shadow">{c.name}{c.muted && ' 🔇'}</p>
                      <p className="relative text-[10px] text-slate-400 drop-shadow">{effLen(c).toFixed(1)}s{c.speed !== 1 && ` · ${c.speed}x`}{c.rotate !== 0 && ` · ${c.rotate}°`}</p>
                      <div onPointerDown={(e) => startTrimDrag(e, c, 'start')} onPointerMove={moveTrimDrag} onPointerUp={endTrimDrag} onPointerCancel={endTrimDrag} className="absolute bottom-0 left-0 top-0 w-2 cursor-ew-resize touch-none bg-cyan-400/40 transition-colors hover:bg-cyan-400" title="Recortar inicio" />
                      <div onPointerDown={(e) => startTrimDrag(e, c, 'end')} onPointerMove={moveTrimDrag} onPointerUp={endTrimDrag} onPointerCancel={endTrimDrag} className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize touch-none bg-cyan-400/40 transition-colors hover:bg-cyan-400" title="Recortar final" />
                    </div>
                    {i < clips.length - 1 && (
<div className="absolute z-20" style={{ left: videoStarts[i + 1] * pps - 12, top: '50%' }}>
<button
onClick={(e) => {
e.stopPropagation();
setTransitionPicker(i);
}}
className={`flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold transition-all hover:scale-125 ${
hasTransition
? 'border-violet-300 bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/60 ring-2 ring-violet-400/40'
: 'border-slate-600 bg-slate-800 text-slate-400 hover:border-violet-400 hover:text-violet-400'
}`}
title={hasTransition ? `${TRANSITION_TYPES.find((t) => t.id === c.transition?.type)?.label || c.transition?.type} · clic para editar` : 'Agregar transición'}>
<IconSparkles className="h-3 w-3" />
</button>
{hasTransition && pps >= 20 && (
<span className="pointer-events-none absolute left-1/2 top-3.5 w-max max-w-[84px] -translate-x-1/2 truncate rounded-md border border-violet-400/40 bg-slate-950/90 px-1.5 py-0.5 text-center text-[8px] font-semibold text-violet-200 backdrop-blur-sm">
{TRANSITION_TYPES.find((t) => t.id === c.transition?.type)?.label || c.transition?.type}
</span>
)}
</div>
)}
                  </React.Fragment>
                );
              })}
              <div onClick={() => fileInputRef.current?.click()} style={{ left: projectDuration * pps + 4, width: 150 }} className="absolute bottom-1 top-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-600 text-xs text-slate-500 transition-colors hover:border-cyan-400 hover:text-cyan-400">+ Agregar clip</div>
              {clips.length === 0 && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-600">Pista de video</div>)}
            </div>
            {audioTracks.map((track) => {
              const isSelected = track.id === selectedAudioId; const width = track.duration * pps; const left = track.start * pps;
              return (
                <div key={track.id} className="relative mt-1.5 h-10 rounded-lg bg-slate-800/20 lg:mt-2 lg:h-12" style={{ width: Math.max(projectDuration * pps + 160, 700) }}>
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, track.id, 'audio', 'move')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} style={{ left, width }} className={`absolute bottom-1 top-1 cursor-grab select-none touch-pan-y overflow-hidden rounded-md border px-2 ${isSelected ? 'border-green-400 bg-green-500/20 ring-1 ring-green-400' : 'border-green-400/60 bg-green-500/10'}`} title="Arrastrá para mover · bordes para recortar">
                                        <WaveformCanvas id={track.id} offset={track.offset} duration={track.duration} width={width} selected={isSelected} />
                    <p className="relative z-10 truncate text-[10px] font-semibold text-green-200 drop-shadow">🎵 {track.name}{track.sourceVideoId ? ' (video)' : ''}</p>
                    <div onPointerDown={(e) => startOverlayTimeDrag(e, track.id, 'audio', 'start')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} className="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize touch-none bg-green-400/50 hover:bg-green-400" />
                    <div onPointerDown={(e) => startOverlayTimeDrag(e, track.id, 'audio', 'end')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} onPointerCancel={endOverlayTimeDrag} className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize touch-none bg-green-400/50 hover:bg-green-400" />
                  </div>
                </div>
              );
            })}
            {audioTracks.length === 0 && (<div className="mt-1.5 flex h-10 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-800/20 text-xs text-slate-600 lg:mt-2 lg:h-12">🎵 Pista de audio — arrastrá un MP3/WAV o hacé clic en "+ Audio"</div>)}
            <div ref={playheadLineRef} className="pointer-events-none absolute bottom-0 top-0 z-20" style={{ left: 0 }}>
              <div className="h-full w-px bg-cyan-400" />
              <div className="absolute -left-[5px] top-0 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-cyan-400" />
            </div>
          </div>
        </div>
      </div>
      {/* ===== GRILLA DE IMPORTS MÓVIL ===== */}
         
      <p className="hidden shrink-0 text-center text-[11px] text-slate-600 lg:block">
        Arrastrá videos, imágenes o audios · Ruedita del mouse = zoom en la timeline · Ctrl+Z deshacer · Tu proyecto se autoguarda en este navegador · Supr = eliminar seleccionado · ✨ entre clips = transición · 🟢 Previsualizar = verlas en el preview
      </p>
    </div>
  );
}