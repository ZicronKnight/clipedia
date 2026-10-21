'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toBlobURL } from '@ffmpeg/util';
import { putAsset, getAsset, saveProject, loadProject, clearProject, StoredProject } from '@/lib/projectStore';

type Clip = {
  id: string; assetId: string; name: string; url: string; duration: number; trimStart: number; trimEnd: number;
  rotate: 0 | 90 | 180 | 270; speed: number; fadeIn: number; fadeOut: number; muted: boolean;
  cropX: number; cropY: number;
};
type ImageOverlay = {
  id: string; assetId: string; name: string; url: string; start: number; end: number;
  x: number; y: number; size: number; rotate: 0 | 90 | 180 | 270; fadeIn: number; fadeOut: number;
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

const RATIO_PRESETS: Record<AspectRatio, { w: number; h: number; label: string }> = {
  '16:9': { w: 1920, h: 1080, label: 'YouTube / Paisaje' },
  '9:16': { w: 1080, h: 1920, label: 'Reels / TikTok' },
  '1:1':  { w: 1080, h: 1080, label: 'Feed cuadrado' },
  '4:3':  { w: 1440, h: 1080, label: 'Clásico' },
};
const RESOLUTION_PRESETS: Record<Resolution, { factor: number; plus: boolean; label: string }> = {
  '480p':  { factor: 480 / 1080, plus: false, label: '480p (SD)' },
  '720p':  { factor: 720 / 1080, plus: false, label: '720p (HD)' },
  '1080p': { factor: 1.0,        plus: true,  label: '1080p (Full HD)' },
  '4K':    { factor: 2.0,        plus: true,  label: '4K (Ultra HD)' },
};
const FORMAT_PRESETS: Record<ExportFormat, { video: string; audio: string; ext: string; label: string }> = {
  mp4: { video: 'libx264', audio: 'aac', ext: 'mp4', label: 'MP4 — Universal' },
  mov: { video: 'libx264', audio: 'aac', ext: 'mov', label: 'MOV — Pro / Apple' },
  mkv: { video: 'libx264', audio: 'aac', ext: 'mkv', label: 'MKV — Matroska' },
};
const QUALITY_PRESETS: Record<Quality, { preset: string; crf264: number; crfVp9: number; bitrate: string; label: string; desc: string }> = {
  fast:     { preset: 'ultrafast', crf264: 26, crfVp9: 40, bitrate: '128k', label: 'Veloz',       desc: 'Para borradores' },
  balanced: { preset: 'medium',    crf264: 23, crfVp9: 32, bitrate: '192k', label: 'Equilibrada', desc: 'Recomendada' },
  high:     { preset: 'slow',      crf264: 18, crfVp9: 24, bitrate: '320k', label: 'Alta calidad', desc: 'Entrega final' },
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
const FONT_FACE_CSS = `
@font-face { font-family: 'Roboto'; src: url('/fonts/Roboto-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Roboto'; src: url('/fonts/Roboto-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Merriweather'; src: url('/fonts/Merriweather-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Merriweather'; src: url('/fonts/Merriweather-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Source Code Pro'; src: url('/fonts/SourceCodePro-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Source Code Pro'; src: url('/fonts/SourceCodePro-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Playfair Display'; src: url('/fonts/PlayfairDisplay-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Playfair Display'; src: url('/fonts/PlayfairDisplay-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Montserrat'; src: url('/fonts/Montserrat-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Montserrat'; src: url('/fonts/Montserrat-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Open Sans'; src: url('/fonts/OpenSans-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Open Sans'; src: url('/fonts/OpenSans-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Lato'; src: url('/fonts/Lato-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Lato'; src: url('/fonts/Lato-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Oswald'; src: url('/fonts/Oswald-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Oswald'; src: url('/fonts/Oswald-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Raleway'; src: url('/fonts/Raleway-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Raleway'; src: url('/fonts/Raleway-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Poppins'; src: url('/fonts/Poppins-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Poppins'; src: url('/fonts/Poppins-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
@font-face { font-family: 'Nunito'; src: url('/fonts/Nunito-Regular.ttf') format('truetype'); font-weight: 400; font-display: swap; }
@font-face { font-family: 'Nunito'; src: url('/fonts/Nunito-Bold.ttf') format('truetype'); font-weight: 700; font-display: swap; }
`;

let counter = 0;
function uid() { counter += 1; return `clip-${Date.now()}-${counter}`; }
function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max); }
function effLen(c: Clip) { return (c.trimEnd - c.trimStart) / c.speed; }
function formatTime(t: number) {
  const m = Math.floor(t / 60); const s = Math.floor(t % 60); const d = Math.floor((t % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${d}`;
}
function locateVideo(t: number, list: Clip[]) {
  let acc = 0;
  for (let i = 0; i < list.length; i++) {
    const len = effLen(list[i]);
    if (t < acc + len) {
      const localProj = t - acc;
      const localFile = list[i].trimStart + localProj * list[i].speed;
      return { index: i, start: acc, localProj, localFile };
    }
    acc += len;
  }
  const last = list.length - 1;
  if (last >= 0) {
    const c = list[last]; const len = effLen(c);
    return { index: last, start: acc - len, localProj: len, localFile: c.trimEnd };
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

type TrimDrag = { id: string; edge: 'start' | 'end'; startX: number; origStart: number; origEnd: number };
type MoveDrag = { id: string; startX: number; active: boolean };
type OverlayTimeDrag = { id: string; type: 'text' | 'image' | 'audio'; mode: 'move' | 'start' | 'end'; startX: number; origStart: number; origEnd: number; origDuration?: number; origOffset?: number };
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef(0);
  const lastTsRef = useRef(0);
  const playheadRef = useRef(0);
  const clipsRef = useRef<Clip[]>([]);
  const imageOverlaysRef = useRef<ImageOverlay[]>([]);
  const textOverlaysRef = useRef<TextOverlay[]>([]);
  const audioTracksRef = useRef<AudioTrack[]>([]);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const projectDurationRef = useRef(0);
  const playingRef = useRef(false);
  const scrubbingRef = useRef(false);
  const dragDepthRef = useRef(0);
  const trimDragRef = useRef<TrimDrag | null>(null);
  const moveDragRef = useRef<MoveDrag | null>(null);
  const overlayTimeDragRef = useRef<OverlayTimeDrag | null>(null);
  const overlayPosDragRef = useRef<{ type: 'text' | 'image'; id: string } | null>(null);
  const panDragRef = useRef<PanDrag | null>(null);
  const historyPast = useRef<string[]>([]);
  const historyFuture = useRef<string[]>([]);
  const lastSnapshotRef = useRef<string>('');
  const applyingRef = useRef(false);
  const ppsRef = useRef(pps);
  const pendingAnchorRef = useRef<{ time: number; offsetX: number } | null>(null);
  const renderStartRef = useRef(0);

  clipsRef.current = clips;
  imageOverlaysRef.current = imageOverlays;
  textOverlaysRef.current = textOverlays;
  audioTracksRef.current = audioTracks;
  playingRef.current = playing;
  ppsRef.current = pps;

  const currentRatio = RATIO_PRESETS[exportSettings.ratio];
  const REF_WIDTH = currentRatio.w;
  const REF_HEIGHT = currentRatio.h;
  const isCover = exportSettings.fit === 'recortar';
  const isPlus = BETA_PLUS_UNLOCK;
  const resInfo = RESOLUTION_PRESETS[exportSettings.resolution];
  const fmtInfo = FORMAT_PRESETS[exportSettings.format];
  const qualInfo = QUALITY_PRESETS[exportSettings.quality];

  const projectDuration = Math.max(
    clips.reduce((a, c) => a + effLen(c), 0),
    audioTracks.reduce((a, t) => Math.max(a, t.start + t.duration), 0),
    imageOverlays.reduce((a, t) => Math.max(a, t.end), 0),
    textOverlays.reduce((a, t) => Math.max(a, t.end), 0), 0
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
      // Gestos horizontales de trackpad = pan nativo, no zoom
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
        const rt: TextOverlay[] = proj.textOverlays || [];
        if (cancelled) return;
        if (rc.length || ri.length || rt.length || ra.length || missing) {
          applyingRef.current = true;
          setClips(rc); setImageOverlays(ri); setTextOverlays(rt); setAudioTracks(ra);
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
  const snapshotOf = (c: Clip[], i: ImageOverlay[], t: TextOverlay[], a: AudioTrack[]) => JSON.stringify([c, i, t, a]);

  useEffect(() => {
    if (applyingRef.current) return;
    const snap = snapshotOf(clips, imageOverlays, textOverlays, audioTracks);
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
  }, [clips, imageOverlays, textOverlays, audioTracks]);

  const applySnapshot = useCallback((s: string) => {
    applyingRef.current = true;
    const [c, i, t, a] = JSON.parse(s);
    setClips(c); setImageOverlays(i); setTextOverlays(t); setAudioTracks(a);
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
      const proj: StoredProject = { version: 1, savedAt: Date.now(), settings: exportSettings, clips, imageOverlays, textOverlays, audioTracks };
      saveProject(proj).catch((e) => console.error('[Autosave] Error guardando:', e));
    }, 1200);
    return () => clearTimeout(t);
  }, [clips, imageOverlays, textOverlays, audioTracks, exportSettings]);

  const videoStarts: number[] = [];
  let accStart = 0;
  for (const c of clips) { videoStarts.push(accStart); accStart += effLen(c); }

  const { index: activeIndex, localProj: activeLocalProj, localFile: activeLocalFile } = locateVideo(playhead, clips);
  const activeClip = activeIndex >= 0 ? clips[activeIndex] : null;
  const selectedClip = clips.find((c) => c.id === selectedId) ?? null;
  const selectedImage = imageOverlays.find((t) => t.id === selectedImageId) ?? null;
  const selectedText = textOverlays.find((t) => t.id === selectedTextId) ?? null;
  const selectedAudio = audioTracks.find((t) => t.id === selectedAudioId) ?? null;

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
        else if (selectedId) { e.preventDefault(); setClips((prev) => prev.filter((c) => c.id !== selectedId)); setSelectedId(null); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, selectedAudioId, selectedImageId, selectedTextId, undo, redo]);

  useEffect(() => {
    if (playheadRef.current > projectDurationRef.current) seek(projectDurationRef.current);
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
    if (v.src !== clip.url) v.src = clip.url;
    v.currentTime = Math.min(activeLocalFile, clip.trimEnd);
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
        if (Math.abs(audio.currentTime - targetTime) > 0.3) audio.currentTime = targetTime;
        let volume = track.muted ? 0 : track.volume;
        if (track.fadeIn > 0 && localTime < track.fadeIn) volume *= localTime / track.fadeIn;
        if (track.fadeOut > 0 && localTime > track.duration - track.fadeOut) volume *= (track.duration - localTime) / track.fadeOut;
        audio.volume = clamp(volume, 0, 1);
        if (isPlaying && audio.paused) audio.play().catch(() => {});
        else if (!isPlaying && !audio.paused) audio.pause();
      } else { if (!audio.paused) audio.pause(); }
    });
  }, [playhead, playing, audioTracks]);

  const tick = useCallback((ts: number) => {
    if (!playingRef.current) return;
    const dt = lastTsRef.current ? (ts - lastTsRef.current) / 1000 : 0;
    lastTsRef.current = ts;
    const total = projectDurationRef.current;
    let t = playheadRef.current + dt;
    if (t >= total) { t = total; playingRef.current = false; setPlaying(false); }
    playheadRef.current = t;
    setPlayhead(t);
    const v = videoRef.current;
    if (v && clipsRef.current.length > 0) {
      const { localFile, index } = locateVideo(t, clipsRef.current);
      if (index >= 0) {
        const clip = clipsRef.current[index];
        const clampedLocalFile = Math.min(localFile, clip.trimEnd);
        if (Math.abs(v.currentTime - clampedLocalFile) > 0.25) v.currentTime = clampedLocalFile;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (playing) { lastTsRef.current = 0; v?.play().catch(() => {}); rafRef.current = requestAnimationFrame(tick); }
    else { v?.pause(); cancelAnimationFrame(rafRef.current); }
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, tick]);

  const seek = useCallback((t: number) => {
    const total = projectDurationRef.current;
    const clamped = Math.min(Math.max(t, 0), total);
    playheadRef.current = clamped;
    setPlayhead(clamped);
    const v = videoRef.current;
    if (!v || clipsRef.current.length === 0) return;
    const { index, localFile } = locateVideo(clamped, clipsRef.current);
    if (index < 0) return;
    const clip = clipsRef.current[index];
    if (v.src !== clip.url) v.src = clip.url;
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
          const newClip: Clip = { id: clipId, assetId, name: f.name, url, duration, trimStart: 0, trimEnd: duration, rotate: 0, speed: 1, fadeIn: 0, fadeOut: 0, muted: false, cropX: 0.5, cropY: 0.5 };
          const audioData = await extractAudioFromVideo(url);
          if (audioData) {
            const audioTrackId = uid();
            const newAudioTrack: AudioTrack = { id: audioTrackId, assetId, name: `Audio de ${f.name}`, url, duration: audioData.duration, offset: 0, start: playheadRef.current, volume: 1, fadeIn: 0, fadeOut: 0, muted: false, peaks: [], sourceVideoId: clipId };
            audioDataMap.set(audioTrackId, { channelData: audioData.channelData, sampleRate: audioData.sampleRate });
            newAudioTrack.peaks = getPeaksForSegment(audioTrackId, 0, audioData.duration);
            newClip.muted = true;
            setClips((prev) => [...prev, newClip]);
            setAudioTracks((prev) => [...prev, newAudioTrack]);
            showToast(`🎬 Video "${f.name}" con audio separado`, 'info');
          } else {
            setClips((prev) => [...prev, newClip]);
            showToast(`🎬 Video "${f.name}" agregado (sin audio)`, 'info');
          }
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

  function togglePlay() { if (!playing) videoRef.current?.play().catch(() => {}); setPlaying(!playing); }
  function updateClip(id: string, patch: Partial<Clip>) { setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))); }
  function updateImageOverlay(id: string, patch: Partial<ImageOverlay>) { setImageOverlays((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); }
  function updateTextOverlay(id: string, patch: Partial<TextOverlay>) { setTextOverlays((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); }
  function updateAudioTrack(id: string, patch: Partial<AudioTrack>) { setAudioTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); }
  function selectOnly(id: string, type: 'clip' | 'image' | 'text' | 'audio') {
    setSelectedId(type === 'clip' ? id : null); setSelectedImageId(type === 'image' ? id : null);
    setSelectedTextId(type === 'text' ? id : null); setSelectedAudioId(type === 'audio' ? id : null);
  }
  function selectAndSeek(id: string) { selectOnly(id, 'clip'); }

  function newProject() {
    if (!window.confirm('¿Empezar un proyecto nuevo? Se descarta el actual (y su autoguardado).')) return;
    applyingRef.current = true;
    setClips([]); setImageOverlays([]); setTextOverlays([]); setAudioTracks([]);
    setSelectedId(null); setSelectedImageId(null); setSelectedTextId(null); setSelectedAudioId(null);
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
      const { index, localFile } = locateVideo(currentTime, clipsRef.current);
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
    else if (selectedId) { setClips((prev) => prev.filter((c) => c.id !== selectedId)); setSelectedId(null); }
  }

  function timeFromPointer(e: React.PointerEvent) { const rect = rulerRef.current?.getBoundingClientRect(); if (!rect) return 0; return (e.clientX - rect.left) / pps; }
  function reorderToPointer(e: React.PointerEvent, dragId: string) {
    const t = timeFromPointer(e); const list = clipsRef.current; const dragged = list.find((c) => c.id === dragId); if (!dragged) return;
    const others = list.filter((c) => c.id !== dragId); let acc = 0; let idx = others.length;
    for (let i = 0; i < others.length; i++) { const len = effLen(others[i]); if (t < acc + len / 2) { idx = i; break; } acc += len; }
    const next = [...others]; next.splice(idx, 0, dragged);
    const same = next.length === list.length && next.every((c, i) => c.id === list[i].id); if (!same) setClips(next);
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

  function startOverlayTimeDrag(e: React.PointerEvent, id: string, type: 'text' | 'image' | 'audio', mode: OverlayTimeDrag['mode']) {
    e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); selectOnly(id, type);
    let origStart = 0; let origEnd = 0; let origDuration = 0; let origOffset = 0;
    if (type === 'text') { const t = textOverlaysRef.current.find((x) => x.id === id); if (t) { origStart = t.start; origEnd = t.end; } }
    else if (type === 'image') { const t = imageOverlaysRef.current.find((x) => x.id === id); if (t) { origStart = t.start; origEnd = t.end; } }
    else { const t = audioTracksRef.current.find((x) => x.id === id); if (t) { origStart = t.start; origEnd = t.start + t.duration; origDuration = t.duration; origOffset = t.offset; } }
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
    } else {
      const track = audioTracksRef.current.find((t) => t.id === d.id); if (!track) return; const patch: Partial<AudioTrack> = {};
      const origDur = d.origDuration || track.duration; const origOff = d.origOffset ?? track.offset;
      if (d.mode === 'move') patch.start = Math.max(d.origStart + delta, 0);
      else if (d.mode === 'start') { const newTimelineStart = Math.max(d.origStart + delta, 0); const trimmedAmount = newTimelineStart - d.origStart; if (origDur - trimmedAmount > MIN_OVERLAY_LEN) { patch.start = newTimelineStart; patch.duration = origDur - trimmedAmount; patch.offset = origOff + trimmedAmount; } }
      else { const newEnd = Math.max(d.origEnd + delta, d.origStart + MIN_OVERLAY_LEN); patch.duration = Math.max(newEnd - d.origStart, MIN_OVERLAY_LEN); }
      updateAudioTrack(d.id, patch);
    }
  }
  function endOverlayTimeDrag() { overlayTimeDragRef.current = null; }

  function startOverlayPosDrag(e: React.PointerEvent, type: 'text' | 'image', id: string) {
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
    else updateImageOverlay(overlayPosDragRef.current.id, { x: absX, y: absY });
  }
  function endOverlayPosDrag() { overlayPosDragRef.current = null; }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) { const files = e.target.files; if (!files || files.length === 0) return; addFiles(files); e.target.value = ''; }
  function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) { const files = e.target.files; if (!files || files.length === 0) return; addFiles(files); e.target.value = ''; }
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
    setExportProgress({ phase: 'preparing', percent: 0, speed: 0 });
    showToast('⏳ Preparando motor de exportación...', 'info');
    const ffLogs: string[] = [];
    let ff: any = null;
    try {
      const { FFmpeg } = await loadFFmpegLib();
      ff = new FFmpeg();
      ff.on('log', ({ message }: any) => { console.log('[FFmpeg Log]', message); ffLogs.push(message); });
      ff.on('progress', ({ progress, time }: any) => {
        // Clamp a 100%: FFmpeg a veces estima de más y mostraba 136%
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

      let baseVideoLabel = 'basev';
      if (videoLabels.length > 0) {
        const concatInputs = videoLabels.map(l => `[${l}]`).join('');
        filterComplex += `${concatInputs}concat=n=${videoLabels.length}:v=1:a=0[${baseVideoLabel}];`;
      } else {
        filterComplex += `color=c=black:s=${REF_WIDTH}x${REF_HEIGHT}:d=${projectDuration}:r=30[${baseVideoLabel}];`;
      }

      let currentVideoLabel = baseVideoLabel;
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

      const audioLabels: string[] = [];
      clips.forEach((c, i) => {
        if (!c.muted) {
          const sp = c.speed;
          const pts = sp === 1 ? 'asetpts=PTS-STARTPTS' : `asetpts=(PTS-STARTPTS)/${sp}`;
          const tempo = sp === 1 ? '' : `,atempo=${sp}`;
          filterComplex += `[${i}:a]atrim=${c.trimStart}:${c.trimEnd},${pts}${tempo},volume=1.0[va${i}];`;
          audioLabels.push(`va${i}`);
        }
      });
      audioTracks.forEach((aud, i) => {
        if (!aud.muted) {
          const audInputIdx = clips.length + imageOverlays.length + i;
          const delay = aud.start * 1000;
          let afades = '';
          if (aud.fadeIn > 0) afades += `,afade=t=in:st=0:d=${aud.fadeIn}`;
          if (aud.fadeOut > 0) afades += `,afade=t=out:st=${Math.max(aud.duration - aud.fadeOut, 0)}:d=${aud.fadeOut}`;
          filterComplex += `[${audInputIdx}:a]atrim=${aud.offset}:${aud.offset + aud.duration},asetpts=PTS-STARTPTS,adelay=${delay}|${delay},volume=${aud.volume}${afades}[sa${i}];`;
          audioLabels.push(`sa${i}`);
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
      if (exitCode !== 0 && !execError) throw new Error(`FFmpeg terminó con código ${exitCode}.`);

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

  return (
    <div className="flex h-[calc(100dvh-57px)] min-h-[620px] flex-col gap-4 p-4" onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <style>{FONT_FACE_CSS}</style>
      {exportModal}

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
      {audioTracks.map((track) => (<AudioElement key={track.id} track={track} onReady={registerAudio} onCleanup={unregisterAudio} />))}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div ref={previewBoxRef} className="relative min-h-0 overflow-hidden rounded-xl border border-slate-800 bg-black">
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
                    onPointerUp={endPanDrag}
                    playsInline suppressHydrationWarning
                  />
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
                </div>
              </div>
            )}
          </div>
          {clips.length === 0 && imageOverlays.length === 0 && audioTracks.length === 0 && (
            <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 transition-colors hover:text-cyan-300">
              <p className="text-lg font-semibold">Arrastrá tus videos, imágenes o audios acá</p>
              <p className="text-sm">Videos → pista de video · Imágenes → pista de imagen · Audios → pista de audio</p>
            </button>
          )}
        </div>

        <aside className="min-h-0 space-y-4 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div><h2 className="text-lg font-bold text-white">Propiedades</h2><p className="mt-1 text-xs text-slate-400">Seleccioná un elemento en la timeline para editarlo.</p></div>
          {selectedClip && !selectedImage && !selectedText && !selectedAudio && (
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
              <button onClick={() => updateClip(selectedClip.id, { muted: !selectedClip.muted })} className={`w-full rounded-lg py-2 text-sm font-semibold transition-colors ${selectedClip.muted ? 'bg-red-500/20 text-red-300 border border-red-400/40' : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'}`}>{selectedClip.muted ? '🔇 Audio separado (video muteado)' : '🔊 Video con audio'}</button>
            </div>
          )}
          {selectedImage && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imagen: <span className="normal-case text-pink-300">{selectedImage.name}</span></p>
              <label className="block select-none text-xs text-slate-400">Tamaño: {selectedImage.size}%<input type="range" min={5} max={50} step={1} value={selectedImage.size} onChange={(e) => updateImageOverlay(selectedImage.id, { size: Number(e.target.value) })} className="mt-1 w-full accent-pink-400" /></label>
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
              <label className="block select-none text-xs text-slate-400">Tamaño: {selectedText.size}px<input type="range" min={16} max={96} step={2} value={selectedText.size} onChange={(e) => updateTextOverlay(selectedText.id, { size: Number(e.target.value) })} className="mt-1 w-full accent-fuchsia-400" /></label>
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
          {!selectedClip && !selectedImage && !selectedText && !selectedAudio && (
            <p className="rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-xs text-slate-500">Hacé clic en un bloque de la timeline para ver sus propiedades acá.</p>
          )}
        </aside>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
        <button onClick={() => seek(0)} disabled={projectDuration === 0} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40" title="Ir al inicio">⏮</button>
        <button onClick={togglePlay} disabled={projectDuration === 0} className="rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2 text-sm font-bold text-black transition-transform hover:scale-[1.03] disabled:opacity-40">{playing ? '⏸ Pausar' : '▶ Reproducir'}</button>
        <div className="rounded-lg bg-slate-800 px-3 py-2 font-mono text-sm text-cyan-300">{formatTime(playhead)} <span className="text-slate-500">/ {formatTime(projectDuration)}</span></div>
        <div className="mx-1 h-6 w-px bg-slate-700" />
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900/50 p-1">
          {(Object.keys(RATIO_PRESETS) as AspectRatio[]).map((r) => (
            <button key={r} onClick={() => setExportSettings((s) => ({ ...s, ratio: r }))} disabled={exporting}
              className={`rounded px-2 py-1 text-xs font-bold transition ${exportSettings.ratio === r ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black shadow-sm shadow-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'} disabled:opacity-50`}
              title={RATIO_PRESETS[r].label}>{r}</button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-700 bg-slate-900/50 p-1">
          <button onClick={() => setExportSettings((s) => ({ ...s, fit: 'adaptar' }))} disabled={exporting}
            className={`rounded px-2.5 py-1 text-xs font-bold transition ${exportSettings.fit === 'adaptar' ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black shadow-sm shadow-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'} disabled:opacity-50`}
            title="El video entra completo (letterbox)">Adaptar</button>
          <button onClick={() => { setExportSettings((s) => ({ ...s, fit: 'recortar' })); showToast('✂️ Modo Recortar: arrastrá el video en el preview para reencuadrar', 'info'); }} disabled={exporting}
            className={`rounded px-2.5 py-1 text-xs font-bold transition ${exportSettings.fit === 'recortar' ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black shadow-sm shadow-cyan-500/30' : 'text-slate-300 hover:bg-slate-800'} disabled:opacity-50`}
            title="El video cubre todo el canvas (recorta sobrantes)">Recortar</button>
        </div>
        <div className="mx-1 h-6 w-px bg-slate-700" />
                <button onClick={undo} disabled={historyPast.current.length === 0} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40" title="Deshacer (Ctrl+Z)">↩️ Deshacer</button>
        <button onClick={redo} disabled={historyFuture.current.length === 0} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40" title="Rehacer (Ctrl+Shift+Z)">↪️ Rehacer</button>
        <button onClick={splitAtPlayhead} disabled={!selectedClip && !selectedImage && !selectedText && !selectedAudio} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400 disabled:opacity-40">✂️ Dividir</button>
        <button onClick={deleteSelected} disabled={!selectedClip && !selectedImage && !selectedText && !selectedAudio} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-40">🗑 Eliminar</button>
        <div className="flex-1" />
        <button onClick={newProject} disabled={exporting} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-amber-400 hover:text-amber-400 disabled:opacity-40" title="Proyecto nuevo (descarta el actual)">🆕 Nuevo</button>
        <button onClick={openExportModal} disabled={projectDuration === 0 || exporting} className="rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-2 text-sm font-bold text-black transition-transform hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100">
          {exporting ? '⏳ Exportando...' : '⬇️ Exportar'}
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400 hover:text-cyan-400">+ Video</button>
        <button onClick={() => imageInputRef.current?.click()} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-pink-400 hover:text-pink-400">+ Imagen</button>
        <button onClick={addTextOverlay} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-fuchsia-400 hover:text-fuchsia-400">+ Texto</button>
        <button onClick={() => audioInputRef.current?.click()} className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-green-400 hover:text-green-400">+ Audio</button>
      </div>

      {/* ===== TIMELINE CON ZOOM ===== */}
      <div className="relative shrink-0 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-950/90 p-1 shadow-lg backdrop-blur">
          <button onClick={() => zoomBy(1 / 1.25)} className="rounded px-2 py-0.5 text-xs font-bold text-slate-300 hover:bg-slate-800" title="Alejar">−</button>
          <span className="w-12 text-center font-mono text-[10px] text-cyan-300">{Math.round((pps / DEFAULT_PPS) * 100)}%</span>
          <button onClick={() => zoomBy(1.25)} className="rounded px-2 py-0.5 text-xs font-bold text-slate-300 hover:bg-slate-800" title="Acercar">+</button>
          <button onClick={() => { pendingAnchorRef.current = null; setPps(DEFAULT_PPS); }} className="rounded px-2 py-0.5 text-[10px] font-bold text-slate-400 hover:bg-slate-800" title="Restablecer zoom">1:1</button>
        </div>
        <div ref={timelineScrollRef} className="overflow-x-auto p-4">
          <div className="relative" style={{ width: Math.max(projectDuration * pps + 160, 700) }}>
            <div ref={rulerRef} className="relative h-7 cursor-pointer select-none border-b border-slate-700" onPointerDown={(e) => { scrubbingRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); seek(timeFromPointer(e)); }} onPointerMove={(e) => { if (scrubbingRef.current) seek(timeFromPointer(e)); }} onPointerUp={() => { scrubbingRef.current = false; }}>
              {ticks.map((s) => (<div key={s} className="absolute top-0 h-full" style={{ left: s * pps }}><div className="h-2 w-px bg-slate-600" /><span className="ml-1 text-[10px] text-slate-500">{s}s</span></div>))}
            </div>

            <div className="relative mt-2 h-9 rounded-lg bg-slate-800/20">
              {imageOverlays.map((img) => {
                const isSelected = img.id === selectedImageId; const width = (img.end - img.start) * pps; const left = img.start * pps;
                return (<div key={img.id} onPointerDown={(e) => startOverlayTimeDrag(e, img.id, 'image', 'move')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} style={{ left, width }} className={`absolute bottom-1 top-1 cursor-grab select-none overflow-hidden rounded-md border px-2 ${isSelected ? 'border-pink-400 bg-pink-500/20 ring-1 ring-pink-400' : 'border-pink-400/60 bg-pink-500/10'}`} title="Arrastrá para mover · bordes para recortar">
                  <p className="relative z-10 truncate text-[10px] font-semibold text-pink-200 drop-shadow">🖼️ {img.name}</p>
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, img.id, 'image', 'start')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} className="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize touch-none bg-pink-400/50 hover:bg-pink-400" />
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, img.id, 'image', 'end')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize touch-none bg-pink-400/50 hover:bg-pink-400" />
                </div>);
              })}
              {imageOverlays.length === 0 && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-600">🖼️ Pista de imagen — arrastrá una imagen o hacé clic en "+ Imagen"</div>)}
              <div className="pointer-events-none absolute inset-y-0 left-1 flex items-center text-[10px] font-semibold text-slate-600">I</div>
            </div>

            <div className="relative mt-2 h-9 rounded-lg bg-slate-800/20">
              {textOverlays.map((txt) => {
                const isSelected = txt.id === selectedTextId; const width = (txt.end - txt.start) * pps; const left = txt.start * pps;
                return (<div key={txt.id} onPointerDown={(e) => startOverlayTimeDrag(e, txt.id, 'text', 'move')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} style={{ left, width }} className={`absolute bottom-1 top-1 cursor-grab select-none overflow-hidden rounded-md border px-2 ${isSelected ? 'border-fuchsia-400 bg-fuchsia-500/20 ring-1 ring-fuchsia-400' : 'border-fuchsia-400/60 bg-fuchsia-500/10'}`} title="Arrastrá para mover · bordes para recortar">
                  <p className="relative z-10 truncate text-[10px] font-semibold text-fuchsia-200 drop-shadow">T: {txt.text}</p>
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, txt.id, 'text', 'start')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} className="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize touch-none bg-fuchsia-400/50 hover:bg-fuchsia-400" />
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, txt.id, 'text', 'end')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize touch-none bg-fuchsia-400/50 hover:bg-fuchsia-400" />
                </div>);
              })}
              {textOverlays.length === 0 && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-600">T Pista de texto — hacé clic en "+ Texto"</div>)}
              <div className="pointer-events-none absolute inset-y-0 left-1 flex items-center text-[10px] font-semibold text-slate-600">T</div>
            </div>

            <div className="relative mt-2 h-20 rounded-lg bg-slate-800/40">
              {clips.map((c, i) => (
                <div key={c.id} onPointerDown={(e) => startMoveDrag(e, c)} onPointerMove={moveMoveDrag} onPointerUp={endMoveDrag} style={{ left: videoStarts[i] * pps, width: Math.max(effLen(c) * pps - 2, 8) }} className={`absolute bottom-1 top-1 select-none overflow-hidden rounded-md border px-2 py-1 ${draggingId === c.id ? 'cursor-grabbing border-cyan-300 bg-cyan-500/30 opacity-60 ring-2 ring-cyan-300' : c.id === selectedId ? 'cursor-grab border-violet-400 bg-violet-500/20 ring-1 ring-violet-400' : i === activeIndex ? 'cursor-grab border-cyan-400 bg-cyan-500/20' : 'cursor-grab border-slate-600 bg-gradient-to-br from-cyan-500/10 to-violet-500/10'}`}>
                  <p className="truncate text-xs font-semibold text-cyan-200">{c.name}{c.muted && ' 🔇'}</p>
                  <p className="text-[10px] text-slate-400">{effLen(c).toFixed(1)}s{c.speed !== 1 && ` · ${c.speed}x`}{c.rotate !== 0 && ` · ${c.rotate}°`}</p>
                  <div onPointerDown={(e) => startTrimDrag(e, c, 'start')} onPointerMove={moveTrimDrag} onPointerUp={endTrimDrag} className="absolute bottom-0 left-0 top-0 w-2 cursor-ew-resize touch-none bg-cyan-400/40 transition-colors hover:bg-cyan-400" title="Recortar inicio" />
                  <div onPointerDown={(e) => startTrimDrag(e, c, 'end')} onPointerMove={moveTrimDrag} onPointerUp={endTrimDrag} className="absolute bottom-0 right-0 top-0 w-2 cursor-ew-resize touch-none bg-cyan-400/40 transition-colors hover:bg-cyan-400" title="Recortar final" />
                </div>
              ))}
              <div onClick={() => fileInputRef.current?.click()} style={{ left: projectDuration * pps + 4, width: 150 }} className="absolute bottom-1 top-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-600 text-xs text-slate-500 transition-colors hover:border-cyan-400 hover:text-cyan-400">+ Agregar clip</div>
              {clips.length === 0 && (<div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-600">Pista de video</div>)}
            </div>

            {audioTracks.map((track) => {
              const isSelected = track.id === selectedAudioId; const width = track.duration * pps; const left = track.start * pps;
              return (
                <div key={track.id} className="relative mt-2 h-12 rounded-lg bg-slate-800/20" style={{ width: Math.max(projectDuration * pps + 160, 700) }}>
                  <div onPointerDown={(e) => startOverlayTimeDrag(e, track.id, 'audio', 'move')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} style={{ left, width }} className={`absolute bottom-1 top-1 cursor-grab select-none overflow-hidden rounded-md border px-2 ${isSelected ? 'border-green-400 bg-green-500/20 ring-1 ring-green-400' : 'border-green-400/60 bg-green-500/10'}`} title="Arrastrá para mover · bordes para recortar">
                    <canvas className="absolute inset-0 h-full w-full" ref={(canvas) => { if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return; canvas.width = width; canvas.height = 48; ctx.clearRect(0, 0, width, 48); const peaks = getPeaksForSegment(track.id, track.offset, track.duration); const barWidth = width / peaks.length; peaks.forEach((peak, i) => { const height = peak * 40; const x = i * barWidth; const y = (48 - height) / 2; ctx.fillStyle = isSelected ? '#4ade80' : '#22c55e'; ctx.fillRect(x, y, Math.max(barWidth - 1, 1), height); }); }} />
                    <p className="relative z-10 truncate text-[10px] font-semibold text-green-200 drop-shadow">🎵 {track.name}{track.sourceVideoId ? ' (video)' : ''}</p>
                    <div onPointerDown={(e) => startOverlayTimeDrag(e, track.id, 'audio', 'start')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} className="absolute bottom-0 left-0 top-0 w-1.5 cursor-ew-resize touch-none bg-green-400/50 hover:bg-green-400" />
                    <div onPointerDown={(e) => startOverlayTimeDrag(e, track.id, 'audio', 'end')} onPointerMove={moveOverlayTimeDrag} onPointerUp={endOverlayTimeDrag} className="absolute bottom-0 right-0 top-0 w-1.5 cursor-ew-resize touch-none bg-green-400/50 hover:bg-green-400" />
                  </div>
                </div>
              );
            })}
            {audioTracks.length === 0 && (<div className="mt-2 flex h-12 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-800/20 text-xs text-slate-600">🎵 Pista de audio — arrastrá un MP3/WAV o hacé clic en "+ Audio"</div>)}

            <div className="pointer-events-none absolute bottom-0 top-0" style={{ left: playhead * pps }}>
              <div className="h-full w-px bg-cyan-400" />
              <div className="absolute -left-[5px] top-0 h-2.5 w-2.5 rotate-45 rounded-[2px] bg-cyan-400" />
            </div>
          </div>
        </div>
      </div>

      <p className="shrink-0 text-center text-[11px] text-slate-600">
        Arrastrá videos, imágenes o audios · Ruedita del mouse = zoom en la timeline · Ctrl+Z deshacer · Tu proyecto se autoguarda en este navegador · Supr = eliminar seleccionado
      </p>
    </div>
  );
}