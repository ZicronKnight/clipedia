'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import DownloadButton from './DownloadButton';

type Clip = {
  id: string;
  title: string;
  slug: string;
  pack: string;
  keywords: string[];
  preview_path: string;
  free_path: string | null;
  hd_path: string | null;
  uhd_path: string | null;
};

export default function Gallery() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function loadClips() {
      const { data, error } = await supabase
        .from('clips')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error Supabase:', error);
        setError(error.message);
      } else if (data) {
        setClips(data);
      }
      setLoading(false);
    }
    loadClips();
  }, []);

  if (loading) return <p className="text-center text-slate-400">Cargando clips...</p>;

  return (
    <div className="mx-auto max-w-6xl p-8">
      {error && (
        <p className="mb-4 rounded-lg bg-red-900/40 p-3 text-center text-sm text-red-300">Error de Supabase: {error}</p>
      )}
      <h2 className="mb-8 text-3xl font-bold text-white">Biblioteca de Clips IA</h2>
      {clips.length === 0 ? (
        <p className="text-center text-slate-400">Aún no hay clips publicados.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip) => (
            <div key={clip.id} className="group relative overflow-hidden rounded-xl bg-slate-800 shadow-lg">
              <div
  className="aspect-video bg-slate-900"
  onContextMenu={(e) => e.preventDefault()}
>
  <video
    src={`${supabase.storage.from('previews').getPublicUrl(clip.preview_path).data.publicUrl}#t=0.5`}
    muted
    loop
    playsInline
    preload="metadata"
    controlsList="nodownload noremoteplayback"
    disablePictureInPicture
    onContextMenu={(e) => e.preventDefault()}
    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    onMouseEnter={(e) => e.currentTarget.play()}
    onMouseLeave={(e) => {
      e.currentTarget.pause();
      e.currentTarget.currentTime = 0.5;
    }}
  />
</div>
              <div className="space-y-3 p-4">
                <div>
                  <h3 className="mb-1 font-bold text-white">{clip.title}</h3>
                  <p className="text-sm text-slate-400">{clip.pack}</p>
                </div>
                <DownloadButton
                clipId={clip.id}
                clipTitle={clip.slug}
                freePath={clip.free_path}
                hdPath={clip.hd_path}
                uhdPath={clip.uhd_path}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}