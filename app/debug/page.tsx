'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

export default function DebugPage() {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [clips, setClips] = useState<any[]>([]);

  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NO DEFINIDA';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'NO DEFINIDA';
    
    setUrl(supabaseUrl);
    setKey(supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'NO DEFINIDA');

    // Intentar conectar
    const supabase = createClient();
    supabase
      .from('clips')
      .select('*')
      .eq('is_published', true)
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
        } else if (data) {
          setClips(data);
        }
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <h1 className="mb-8 text-3xl font-bold">Debug de Supabase</h1>
      
      <div className="space-y-4 rounded-lg bg-slate-800 p-6">
        <div>
          <h2 className="font-bold text-cyan-400">NEXT_PUBLIC_SUPABASE_URL:</h2>
          <p className="break-all font-mono text-sm">{url}</p>
        </div>
        
        <div>
          <h2 className="font-bold text-cyan-400">NEXT_PUBLIC_SUPABASE_ANON_KEY:</h2>
          <p className="break-all font-mono text-sm">{key}</p>
        </div>
        
        {error && (
          <div className="rounded-lg bg-red-900/40 p-4">
            <h2 className="font-bold text-red-400">Error de conexión:</h2>
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {clips.length > 0 && (
          <div className="rounded-lg bg-green-900/40 p-4">
            <h2 className="font-bold text-green-400">¡Conexión exitosa! {clips.length} clips cargados.</h2>
          </div>
        )}
      </div>
      
      <div className="mt-8">
        <a href="/" className="text-cyan-400 underline">← Volver al inicio</a>
      </div>
    </div>
  );
}