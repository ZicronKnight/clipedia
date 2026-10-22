import Link from 'next/link';
import Converter from '@/components/Converter';
import Gallery from '@/components/Gallery';
import AuthUI from '@/components/AuthUI';

export const metadata = {
  title: 'Clipedia — B-Roll royalty-free generado por IA',
  description:
    'Clips royalty-free y herramientas de video que procesan todo en tu navegador. Nada se sube a ningún servidor.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* ===== HEADER FLOTANTE ===== */}
      <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo/monogram.png"
              alt="Clipedia"
              className="h-9 w-9 object-contain"
            />
            <span className="text-xl font-bold text-white">
              Clipedia <span className="text-cyan-400">.net</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-400 md:flex">
            <a href="#gallery" className="transition-colors hover:text-cyan-400">Galería</a>
            <a href="#converter" className="transition-colors hover:text-cyan-400">Convertidor</a>
            <Link href="/plus" className="transition-colors hover:text-cyan-400">Plus</Link>
          </nav>
          <AuthUI />
        </div>
      </header>

            {/* ===== HERO ===== */}
      <section className="relative overflow-hidden border-b border-slate-800/50">
        {/* Aurora de fondo (CSS puro, peso cero) */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -right-40 top-10 h-[32rem] w-[32rem] rounded-full bg-violet-600/25 blur-3xl" />
          <div className="absolute -bottom-40 left-1/3 h-[30rem] w-[30rem] rounded-full bg-fuchsia-600/15 blur-3xl" />
          <div className="absolute left-1/2 top-1/4 h-64 w-64 rounded-full bg-cyan-400/10 blur-2xl" />
          {/* Partículas con pulso suave */}
          <div className="absolute left-[12%] top-[30%] h-1 w-1 animate-pulse rounded-full bg-cyan-300/70 [animation-duration:3s]" />
          <div className="absolute left-[22%] top-[65%] h-1.5 w-1.5 rounded-full bg-violet-300/60" />
          <div className="absolute left-[45%] top-[20%] h-1 w-1 animate-pulse rounded-full bg-fuchsia-300/60 [animation-duration:4s]" />
          <div className="absolute left-[70%] top-[70%] h-1 w-1 rounded-full bg-cyan-200/60" />
          <div className="absolute left-[85%] top-[35%] h-1.5 w-1.5 animate-pulse rounded-full bg-violet-200/50 [animation-duration:5s]" />
          <div className="absolute left-[60%] top-[50%] h-1 w-1 rounded-full bg-cyan-300/50" />
          {/* Velo de contraste detrás del texto */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/30 to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          {/* Columna de texto */}
          <div className="text-center lg:text-left">
            <h1 className="mb-4 text-5xl font-black tracking-tight md:text-6xl">
              Clips B-Roll{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 bg-clip-text text-transparent">
                + Convertidor + Editor
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-lg text-slate-400 lg:mx-0">
              Todo en tu navegador. 100% privado. Sin subir tus archivos a ningún servidor.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4 lg:justify-start">
              <Link
                href="/plus"
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 font-bold text-black transition-transform hover:scale-105"
              >
                Ver plan Plus
              </Link>
              <Link
                href="/studio"
                className="rounded-xl border border-slate-700 bg-slate-900/70 px-6 py-3 font-bold text-white transition-colors hover:border-cyan-400 hover:text-cyan-400"
              >
                Edita tu video con Clipedia Studio
              </Link>
            </div>
          </div>

          {/* Columna de arte (oculta en mobile) */}
          <div className="relative hidden lg:block">
            <img
              src="/hero/hero-art.webp"
              alt=""
              aria-hidden="true"
              loading="eager"
              fetchPriority="high"
              className="pointer-events-none relative z-10 ml-auto w-full max-w-xl select-none drop-shadow-[0_0_45px_rgba(139,92,246,0.35)]"
            />
          </div>
        </div>
      </section>

      {/* ===== LAYOUT DE DOS COLUMNAS ===== */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
          {/* COLUMNA IZQUIERDA: Galería */}
          <section id="gallery">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white">Biblioteca de Clips IA</h2>
                <p className="mt-1 text-slate-400">Clips royalty-free listos para tus proyectos</p>
              </div>
              <Link
                href="/plus"
                className="hidden rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-400 transition-colors hover:bg-cyan-400/20 sm:block"
              >
                Ver plan Plus →
              </Link>
            </div>
            <Gallery />
          </section>

          {/* COLUMNA DERECHA: Conversor sticky */}
                    <aside id="converter" className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl bg-gradient-to-br from-cyan-400/70 via-slate-700 to-fuchsia-500/70 p-[1px] shadow-2xl shadow-cyan-900/20">
              <div className="relative overflow-hidden rounded-2xl bg-slate-900/95 p-6">
                {/* Manchas de luz (aurora) */}
                <div className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-cyan-400/25 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-fuchsia-500/25 blur-3xl" />
                <div className="pointer-events-none absolute -right-20 top-1/3 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
                <h2 className="relative mb-1 text-xl font-bold text-white">Convertidor</h2>
                <p className="relative mb-6 text-sm text-slate-400">Video y audio, en tu navegador</p>
                <div className="relative">
                  <Converter />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ===== FOOTER PROMO ===== */}
      <section className="border-t border-slate-800">
        <div className="bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10 py-10">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-6 text-center md:flex-row md:text-left">
            <div>
              <h3 className="text-2xl font-black text-white">
                Descargá clips en{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
                  1080p y 4K
                </span>
              </h3>
              <p className="mt-1 text-slate-400">Con Clipedia Plus, sin límites.</p>
            </div>
            <Link
              href="/plus"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 font-bold text-black transition-transform hover:scale-105"
            >
              Activar Clipedia Plus →
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER LEGAL ===== */}
      <footer className="border-t border-slate-800 py-8 text-center">
        <div className="mb-4 flex justify-center gap-6 text-sm text-slate-500">
          <Link href="/plus" className="hover:text-cyan-400 transition-colors">Clipedia Plus</Link>
          <Link href="/terms" className="hover:text-cyan-400 transition-colors">Términos</Link>
          <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacidad</Link>
        </div>
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} Clipedia. Todos los derechos reservados.{' '}
          Contacto: soporte@clipedia.net
        </p>
      </footer>
    </main>
  );
}