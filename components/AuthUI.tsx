'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';

type User = { email?: string } | null;

type Screen = 'signin' | 'signup' | 'signup-sent' | 'reset-sent';

export default function AuthUI() {
  const supabase = createClient();
  const [user, setUser] = useState<User>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [screen, setScreen] = useState<Screen>('signin');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user as any));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user as any);
    });
    const openLogin = () => setOpen(true);
    window.addEventListener('clipedia:login', openLogin);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('clipedia:login', openLogin);
    };
  }, []);

  async function submit() {
    setMsg('');
    setLoading(true);
    try {
      if (screen === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setMsg('Email o contraseña incorrectos. ¿Olvidaste tu contraseña?');
        } else {
          const { data } = await supabase.auth.getUser();
          if (data.user) {
            setUser(data.user as any);
            setOpen(false);
            resetForm();
          }
        }
      } else if (screen === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          if (error.message.toLowerCase().includes('already registered')) {
            setMsg('Ese email ya tiene cuenta. ¿Querés iniciar sesión?');
            setScreen('signin');
          } else {
            setMsg('Error al crear la cuenta. Probá de nuevo.');
          }
        } else {
          setScreen('signup-sent');
          setPassword('');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  function resetForm() {
    setEmail('');
    setPassword('');
    setMsg('');
    setScreen('signin');
  }

  function openModal() {
    resetForm();
    setOpen(true);
  }

  // Si ya hay usuario, mostrá el badge de cuenta
  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-green-400" />
          <span className="max-w-48 truncate text-sm text-slate-200">{user.email}</span>
        </div>
        <button onClick={logout} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
          Salir
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={openModal}
        className="rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-1.5 text-sm font-bold text-black hover:opacity-90"
      >
        Entrar / Crear cuenta
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
            
            {/* PANTALLA: Login */}
            {screen === 'signin' && (
              <>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">Bienvenido de vuelta</h3>
                  <p className="mt-1 text-xs text-slate-400">Entrá para acceder a tus descargas</p>
                </div>
                <input
                  type="email" placeholder="tu@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  disabled={loading}
                />
                <input
                  type="password" placeholder="Contraseña" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  disabled={loading}
                />
                <button 
                  onClick={submit} 
                  disabled={loading || !email || !password}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 py-2.5 font-bold text-black transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Entrando...' : 'Iniciar sesión'}
                </button>
                {msg && <p className="text-center text-xs text-amber-300">{msg}</p>}
                <div className="space-y-1 text-center">
                  <button
                    onClick={() => { resetForm(); setScreen('signup'); }}
                    className="w-full text-xs text-slate-400 underline hover:text-slate-200"
                  >
                    ¿No tenés cuenta? Creá una gratis
                  </button>
                </div>
              </>
            )}

            {/* PANTALLA: Registro */}
            {screen === 'signup' && (
              <>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">Creá tu cuenta gratis</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    🎁 5 descargas de clips por mes<br />
                    🎬 Convertidor de video ilimitado<br />
                    ✨ Sin marca de agua
                  </p>
                </div>
                <input
                  type="email" placeholder="tu@email.com" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  disabled={loading}
                />
                <input
                  type="password" placeholder="Elegí una contraseña" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-white outline-none focus:ring-2 focus:ring-cyan-400"
                  disabled={loading}
                />
                <button 
                  onClick={submit} 
                  disabled={loading || !email || !password}
                  className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 py-2.5 font-bold text-black transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
                </button>
                {msg && <p className="text-center text-xs text-amber-300">{msg}</p>}
                <div className="space-y-1 text-center">
                  <button
                    onClick={() => { resetForm(); setScreen('signin'); }}
                    className="w-full text-xs text-slate-400 underline hover:text-slate-200"
                  >
                    ¿Ya tenés cuenta? Iniciá sesión
                  </button>
                </div>
              </>
            )}

            {/* PANTALLA: Cuenta creada - mensaje de verificación */}
            {screen === 'signup-sent' && (
              <div className="text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500/20 to-violet-500/20">
                  <svg className="h-8 w-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">¡Cuenta creada! 🎉</h3>
                  <p className="mt-2 text-sm text-slate-300">
                    Te enviamos un correo de verificación a:
                  </p>
                  <p className="mt-1 font-bold text-cyan-300 break-all">{email}</p>
                </div>
                <div className="rounded-lg bg-slate-800 p-3">
                  <p className="text-xs text-slate-300">
                    <strong className="text-white">Próximos pasos:</strong>
                  </p>
                  <ol className="mt-2 space-y-1 text-left text-xs text-slate-400">
                    <li>1. Abrí el correo de Supabase</li>
                    <li>2. Hacé click en el botón de verificación</li>
                    <li>3. Volvé acá e iniciá sesión</li>
                  </ol>
                </div>
                <button
                  onClick={() => setScreen('signin')}
                  className="w-full rounded-lg bg-slate-700 py-2.5 font-bold text-white hover:bg-slate-600"
                >
                  Ya verifiqué, iniciar sesión
                </button>
                <p className="text-[10px] text-slate-500">
                  ¿No llegó? Revisá spam o <button onClick={() => setScreen('signup')} className="underline hover:text-slate-300">probá con otro email</button>
                </p>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}