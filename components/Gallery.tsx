'use client';

import { useEffect, useMemo, useState } from 'react';
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
  duration_s: number | null;
  orientation: string | null;
  created_at: string;
};

type SortKey = 'recientes' | 'duracion' | 'az';

const CDN_BASE = 'https://cdn.clipedia.net';

const PACK_TITLES: Record<string, string> = {
  pack1: 'Tech & Abstract',
  pack2: 'Mystery & Documentary',
  pack3: 'Business & Finance',
  pack4: 'Sci-Fi & Fantasy',
  pack5: 'Aesthetic & Lo-Fi',
};
const PACK_ORDER = ['pack1', 'pack2', 'pack3', 'pack4', 'pack5'];

const SUGERENCIAS = ['neon', 'rain', 'night', 'macro', 'cozy', 'space'];

// Normaliza para búsqueda sin tildes ni mayúsculas
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function previewUrl(clip: Clip) {
  if (!clip.preview_path) return '';
  return clip.preview_path.startsWith('http') ? clip.preview_path : `${CDN_BASE}/${clip.preview_path}`;
}

function chipCls(active: boolean) {
  return active
    ? 'rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-1.5 text-sm font-bold text-black transition-transform hover:scale-105'
    : 'rounded-full border border-slate-700 bg-slate-900/60 px-4 py-1.5 text-sm font-semibold text-slate-300 transition-colors hover:border-cyan-400 hover:text-cyan-300';
}

export default function Gallery() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activePack, setActivePack] = useState<string>('todos');
  const [sort, setSort] = useState<SortKey>('recientes');
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

  // Contadores por pack
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of clips) m[c.pack] = (m[c.pack] || 0) + 1;
    return m;
  }, [clips]);

  // Ordenador reutilizable
  function sortList(list: Clip[]) {
    const sorted = [...list];
    if (sort === 'duracion') sorted.sort((a, b) => (b.duration_s ?? 0) - (a.duration_s ?? 0));
    else if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return sorted;
  }

  // Búsqueda + filtro de chip (en memoria, instantáneo)
  const filtered = useMemo(() => {
    const q = norm(query.trim());
    let list = clips;
    if (activePack !== 'todos') list = list.filter((c) => c.pack === activePack);
    if (q) {
      list = list.filter((c) => {
        const haystack = norm(
          [c.title, c.slug, (c.keywords || []).join(' '), PACK_TITLES[c.pack] ?? c.pack].join(' ')
        );
        return haystack.includes(q);
      });
    }
    return sortList(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, query, activePack, sort]);

  const isFiltering = query.trim() !== '' || activePack !== 'todos';

  if (loading) return <p className="text-center text-slate-400 py-8">Cargando clips...</p>;

  // Grilla reutilizable (cards idénticas a las de hoy + glow sutil)
  function renderGrid(list: Clip[]) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((clip) => (
          <div
            key={clip.id}
            className="group relative overflow-hidden rounded-xl bg-slate-800 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-400/10 transition-all duration-300 hover:scale-[1.02] hover:shadow-cyan-400/25 hover:ring-cyan-400/40"
          >
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
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-lg bg-red-900/40 p-3 text-center text-sm text-red-300">
          Error de Supabase: {error}
        </p>
      )}

      {/* ===== BARRA DE BÚSQUEDA + ORDEN ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clips por título, palabra clave o categoría…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/70 py-3 pl-11 pr-10 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-1.5 text-slate-500 transition-colors hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300 outline-none transition-colors focus:border-cyan-400"
        >
          <option value="recientes">Más recientes</option>
          <option value="duracion">Mayor duración</option>
          <option value="az">Título A–Z</option>
        </select>
      </div>

      {/* ===== CHIPS DE CATEGORÍAS ===== */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActivePack('todos')} className={chipCls(activePack === 'todos')}>
          Todos ({clips.length})
        </button>
        {PACK_ORDER.filter((p) => counts[p]).map((p) => (
          <button
            key={p}
            onClick={() => setActivePack(activePack === p ? 'todos' : p)}
            className={chipCls(activePack === p)}
          >
            {PACK_TITLES[p]} ({counts[p]})
          </button>
        ))}
      </div>

      {/* ===== CONTENIDO ===== */}
      {clips.length === 0 ? (
        <p className="text-center text-slate-400">Aún no hay clips publicados.</p>
      ) : isFiltering ? (
        /* Modo filtrado: una sola grilla */
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-2xl font-bold text-white">
              {query.trim() ? (
                <>
                  Resultados para <span className="text-cyan-400">“{query.trim()}”</span>
                  {activePack !== 'todos' && (
                    <span className="text-base font-semibold text-slate-500"> en {PACK_TITLES[activePack]}</span>
                  )}
                </>
              ) : (
                PACK_TITLES[activePack] ?? activePack
              )}
            </h2>
            <span className="text-sm text-slate-500">
              {filtered.length} {filtered.length === 1 ? 'clip' : 'clips'}
            </span>
          </div>
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
              <p className="text-4xl">🥐</p>
              <p className="mt-3 font-semibold text-white">No encontramos nada para “{query.trim()}”</p>
              <p className="mt-1 text-sm text-slate-400">Probá con alguna de estas búsquedas:</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); setActivePack('todos'); }}
                    className={chipCls(false)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            renderGrid(filtered)
          )}
        </section>
      ) : (
        /* Modo vidriera: secciones por pack */
        PACK_ORDER.filter((p) => counts[p]).map((packName) => (
          <section key={packName} className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-2xl font-bold text-white">{PACK_TITLES[packName] ?? packName}</h2>
              <span className="text-sm text-slate-500">{counts[packName]} clips</span>
            </div>
            {renderGrid(sortList(clips.filter((c) => c.pack === packName)))}
          </section>
        ))
      )}
    </div>
  );
}