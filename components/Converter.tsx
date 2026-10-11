'use client';

import { useRef, useState } from 'react';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Todo el motor vive ahora en /public (tu disco D). Cero dependencia de CDNs externos.
const CORE_JS = '/ffmpeg-core.js';
const CORE_WASM = '/ffmpeg-core.wasm';

// Carga la versión UMD de FFmpeg directo en el navegador,
// esquivando a Turbopack, que no digiere el build ESM de la librería.
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

const VIDEO_FORMATS = [
  { id: 'mp4', label: 'MP4 (H.264) — el más compatible', plus: false },
  { id: 'mov', label: 'MOV (QuickTime)', plus: false },
  { id: 'mkv', label: 'MKV (Matroska)', plus: false },
  { id: 'gif', label: 'GIF animado', plus: false },
];
const VIDEO_RESOLUTIONS = [
  { id: 480, label: '480p', plus: false },
  { id: 720, label: '720p (máx. del plan gratis)', plus: false },
  { id: 1080, label: '1080p 🔒 Clipedia Plus', plus: true },
  { id: 2160, label: '4K 🔒 Clipedia Plus', plus: true },
];
const AUDIO_FORMATS = [
  { id: 'mp3', label: 'MP3 128kbps', plus: false },
  { id: 'wav', label: 'WAV sin compresión 🔒 Clipedia Plus', plus: true },
  { id: 'flac', label: 'FLAC lossless 🔒 Clipedia Plus', plus: true },
  { id: 'm4a', label: 'M4A 192kbps 🔒 Clipedia Plus', plus: true },
];

export default function Converter() {
  const [ffmpeg, setFfmpeg] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [videoFormat, setVideoFormat] = useState('mp4');
  const [videoRes, setVideoRes] = useState(720);
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [lastLog, setLastLog] = useState('');
  const [outUrl, setOutUrl] = useState<string | null>(null);
  const [outName, setOutName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setStatus('Cargando librería FFmpeg local (1/3)...');
    const { FFmpeg } = await loadFFmpegLib();
    const ff = new FFmpeg();
    ff.on('progress', ({ progress: p }) => setProgress(p));
    ff.on('log', ({ message }) => setLastLog(message));
    setStatus('Cargando núcleo local (2/3)...');
    const coreURL = await toBlobURL(CORE_JS, 'text/javascript');
    setStatus('Cargando motor wasm local (3/3, ~32 MB)...');
    const wasmURL = await toBlobURL(CORE_WASM, 'application/wasm');
    setStatus('Arrancando el motor de conversión...');
    await ff.load({ coreURL, wasmURL });
    setFfmpeg(ff);
    return ff;
  }

  async function convert() {
    if (!file) return;
    setBusy(true);
    setOutUrl(null);
    setProgress(0);
    setLastLog('');
    try {
      const ff = ffmpeg ?? (await load());
      const ext = file.name.match(/\.[a-z0-9]+$/i)?.[0] ?? '.mp4';
      const inName = 'input' + ext;
      const base = file.name.replace(/\.[a-z0-9]+$/i, '');
      setStatus('Cargando tu archivo en memoria local...');
      await ff.writeFile(inName, await fetchFile(file));

      let args: string[];
      let outExt: string;

      if (mode === 'audio') {
        outExt = audioFormat;
        if (audioFormat === 'mp3') {
          args = ['-i', inName, '-vn', '-acodec', 'libmp3lame', '-b:a', '128k', `output.${outExt}`];
        } else if (audioFormat === 'wav') {
          args = ['-i', inName, '-vn', '-acodec', 'pcm_s16le', `output.${outExt}`];
        } else if (audioFormat === 'flac') {
          args = ['-i', inName, '-vn', '-acodec', 'flac', `output.${outExt}`];
        } else {
          args = ['-i', inName, '-vn', '-acodec', 'aac', '-b:a', '192k', `output.${outExt}`];
        }
        setOutName(`${base}_clipedia.${outExt}`);
      } else if (videoFormat === 'gif') {
        outExt = 'gif';
        args = ['-i', inName, '-vf', "scale=-2:'min(480,ih)',fps=12,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse", '-an', `output.${outExt}`];
        setOutName(`${base}_clipedia.gif`);
      } else {
        outExt = videoFormat;
        args = ['-i', inName, '-vf', `scale=-2:'min(${videoRes},ih)'`, '-c:v', 'libx264', '-preset', 'veryfast', '-c:a', 'aac', `output.${outExt}`];
        setOutName(`${base}_clipedia_${videoRes}p.${outExt}`);
      }

      setStatus('Convirtiendo en TU máquina (nada se sube a internet 🔒)...');
      await ff.exec(args);
      const data = await ff.readFile(`output.${outExt}`);
      const mime =
        outExt === 'mp3' || outExt === 'wav' || outExt === 'flac' || outExt === 'm4a'
          ? 'audio/' + (outExt === 'm4a' ? 'mp4' : outExt)
          : outExt === 'gif' ? 'image/gif' : 'video/' + (outExt === 'mov' ? 'quicktime' : outExt === 'mkv' ? 'x-matroska' : 'mp4');
      const blob = new Blob([data as unknown as BlobPart], { type: mime });
      setOutUrl(URL.createObjectURL(blob));
      setStatus('¡Listo! ✅');
      setLastLog('');
    } catch (e) {
      setStatus('Error: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selectCls = 'w-full rounded-xl bg-slate-800 px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-cyan-400';

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <div
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-600 p-10 text-center hover:border-cyan-400"
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*"
          className="hidden"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setOutUrl(null); }}
        />
        {file ? (
          <p className="text-cyan-300">{file.name} <span className="text-slate-400">({(file.size / 1048576).toFixed(1)} MB)</span></p>
        ) : (
          <p className="text-slate-300">Arrastrá o hacé clic para elegir tu archivo</p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setMode('video')}
          className={`flex-1 rounded-xl py-3 ${mode === 'video' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300'}`}
        >
          🎬 Convertir video
        </button>
        <button
          onClick={() => setMode('audio')}
          className={`flex-1 rounded-xl py-3 ${mode === 'audio' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300'}`}
        >
          🎵 Extraer audio
        </button>
      </div>

      {mode === 'video' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select value={videoFormat} onChange={(e) => setVideoFormat(e.target.value)} className={selectCls}>
            {VIDEO_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
          {videoFormat !== 'gif' && (
            <select value={videoRes} onChange={(e) => setVideoRes(Number(e.target.value))} className={selectCls}>
              {VIDEO_RESOLUTIONS.map((r) => (
                <option key={r.id} value={r.id} disabled={r.plus}>{r.label}</option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <select value={audioFormat} onChange={(e) => setAudioFormat(e.target.value)} className={selectCls}>
          {AUDIO_FORMATS.map((f) => (
            <option key={f.id} value={f.id} disabled={f.plus}>{f.label}</option>
          ))}
        </select>
      )}

      <button
        onClick={convert}
        disabled={!file || busy}
        className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 py-4 font-bold text-black disabled:opacity-40"
      >
        {busy ? `Procesando... ${(progress * 100).toFixed(0)}%` : 'Convertir GRATIS'}
      </button>

      {status && <p className="text-center text-sm text-slate-400">{status}</p>}
      {busy && lastLog && (
        <p className="truncate text-center font-mono text-[11px] text-slate-600">{lastLog}</p>
      )}

      {outUrl && (
        <div className="space-y-3 rounded-xl bg-slate-800 p-4 text-center">
          <a href={outUrl} download={outName} className="block rounded-lg bg-green-500 py-3 font-bold text-black">
            ⬇️ Descargar {outName}
          </a>
          <p className="text-xs text-slate-400">
            ¿Necesitás 1080p/4K, WAV/FLAC o convertir 20 archivos a la vez?{' '}
            <span className="font-bold text-cyan-300">Conocé Clipedia Plus →</span>
          </p>
        </div>
      )}
    </div>
  );
}