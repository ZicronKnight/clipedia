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

export default function DownloadButton({ clipId, clipTitle, freePath, hdPath, uhdPath }: Props) {
  const supabase = createClient();
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState('');

  async function handle(quality: '720p' | '1080p' | '4k') {
    setWorking(true);
    setMsg('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.dispatchEvent(new Event('clipedia:login'));
      setMsg('Iniciá sesión o creá una cuenta gratis para descargar.');
      setWorking(false);
      return;
    }

    const { data: sub } = await supabase.from('subscriptions').select('*').eq('user_id', user.id).single();
    const isPlus = !!sub && sub.plan === 'plus' && sub.status === 'active';

    if (quality !== '720p' && !isPlus) {
      setMsg('La calidad ' + quality + ' es exclusiva de Clipedia Plus.');
      setWorking(false);
      return;
    }

    const { error: insertError } = await supabase
      .from('downloads')
      .insert({ user_id: user.id, clip_id: clipId, quality });
    if (insertError) {
      setMsg('Llegaste a las 5 descargas gratis del mes. ¡Pasate a Plus para seguir sin límites!');
      setWorking(false);
      return;
    }

    // Ahora TODAS las calidades salen de buckets privados con enlace firmado
    const bucket = quality === '720p' ? 'free' : 'full';
    const path = quality === '720p' ? freePath : quality === '1080p' ? hdPath : uhdPath;

    if (!path) {
      setMsg('Este clip todavía no tiene versión ' + quality + '.');
      setWorking(false);
      return;
    }

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      setMsg('No se pudo generar el enlace seguro.');
      setWorking(false);
      return;
    }

    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = `${clipTitle}-${quality}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setWorking(false);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => handle('720p')}
        disabled={working}
        className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 py-2 font-bold text-black transition-transform hover:scale-105 disabled:opacity-50"
      >
        Descargar 720p gratis
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => handle('1080p')} className="rounded-lg bg-slate-700 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-600">
          1080p 🔒 Plus
        </button>
        <button onClick={() => handle('4k')} className="rounded-lg bg-slate-700 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-600">
          4K 🔒 Plus
        </button>
      </div>
      {msg && <p className="text-center text-[11px] text-amber-300">{msg}</p>}
    </div>
  );
}