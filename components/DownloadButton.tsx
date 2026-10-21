'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

type Props = {
  clipId: string;
  clipTitle: string;
  freePath?: string | null;
  hdPath?: string | null;
  uhdPath?: string | null;
};

const MSGS: Record<string, string> = {
  auth: 'Iniciá sesión o creá una cuenta gratis para descargar.',
  plus: 'Esta calidad es exclusiva de Clipedia Plus. ¡Conocelo arriba!',
  quota: 'Llegaste a las 10 descargas gratis del mes. ¡Pasate a Plus para seguir sin límites!',
  missing: 'Este clip todavía no tiene esa calidad disponible.',
  'not-found': 'Clip no encontrado.',
  'bad-quality': 'Calidad no válida.',
  server: 'Error del servidor. Probá de nuevo en unos segundos.',
};

export default function DownloadButton({ clipId, clipTitle }: Props) {
  const supabase = createClient();
  const [working, setWorking] = useState<'720p' | '1080p' | '4k' | null>(null);
  const [msg, setMsg] = useState('');

  async function handle(quality: '720p' | '1080p' | '4k') {
    setWorking(quality);
    setMsg('');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.dispatchEvent(new Event('clipedia:login'));
      setMsg(MSGS.auth);
      setWorking(null);
      return;
    }
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ clipId, quality }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        setMsg(MSGS[body.error] || MSGS.server);
        setWorking(null);
        return;
      }
      const a = document.createElement('a');
      a.href = body.url;
      a.download = `${clipTitle}-${quality}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setMsg(MSGS.server);
    }
    setWorking(null);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => handle('720p')}
        disabled={working !== null}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 py-2 font-bold text-black transition-transform hover:scale-105 disabled:opacity-50"
      >
        {working === '720p' ? 'Preparando...' : 'Descargar 720p gratis'}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handle('1080p')}
          disabled={working !== null}
          className="rounded-lg bg-slate-700 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
        >
          {working === '1080p' ? '...' : '1080p 🔒 Plus'}
        </button>
        <button
          onClick={() => handle('4k')}
          disabled={working !== null}
          className="rounded-lg bg-slate-700 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-600 disabled:opacity-50"
        >
          {working === '4k' ? '...' : '4K 🔒 Plus'}
        </button>
      </div>
      {msg && <p className="text-center text-[11px] text-amber-300">{msg}</p>}
    </div>
  );
}