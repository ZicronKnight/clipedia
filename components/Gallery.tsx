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

const CDN_BASE = 'https://cdn.clipedia.net';
const PACK_TITLES: Record<string, string> = {
  pack1: 'Tech & Abstract',
  pack2: 'Mystery & Documentary',
  pack3: 'Business & Finance',
  pack4: 'Sci-Fi & Fantasy',
  pack5: 'Aesthetic & Lo-Fi',
};

function previewUrl(clip: Clip) {
  if (!clip.preview_path) return '';
  return clip.preview_path.startsWith('http') ? clip.preview_path : `${CDN_BASE}/${clip.preview_path}`;
}

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clipsByPack = clips.reduce((acc, clip) => {
    const pack = clip.pack || 'Otros';
    if (!acc[pack]) acc[pack] = [];
    acc[pack].push(clip);
    return acc;
  }, {} as Record<string, Clip[]>);

  if (loading) return <p className="text-center text-slate-400 py-8">Cargando clips...</p>;

  return (
    <div className="space-y-12">
      {error && (
        <p className="rounded-lg bg-red-900/40 p-3 text-center text-sm text-red-300">
          Error de Supabase: {error}
        </p>
      )}
      {clips.length === 0 ? (
        <p className="text-center text-slate-400">Aún no hay clips publicados.</p>
      ) : (
        Object.keys(clipsByPack)
          .sort()
          .map((packName) => {
            const packClips = clipsByPack[packName];
            return (
              <section key={packName} className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h2 className="text-2xl font-bold text-white">{PACK_TITLES[packName] ?? packName}</h2>
                  <span className="text-sm text-slate-500">{packClips.length} clips</span>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {packClips.map((clip) => (
                    <div key={clip.id} className="group relative overflow-hidden rounded-xl bg-slate-800 shadow-lg transition-transform hover:scale-[1.02]">
                      <div className="aspect-video bg-slate-900" onContextMenu={(e) => e.preventDefault()}>
                        <video
                          src={`${previewUrl(clip)}#t=0.5`}
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
                          <p className="text-sm text-slate-400">{clip.keywords.slice(0, 3).join(', ')}</p>
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
              </section>
            );
          })
      )}
    </div>
  );
}