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
      <section className="border-b border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950 py-16 text-center">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="mb-4 text-5xl font-black tracking-tight md:text-6xl">
            B-Roll de{' '}
             <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
              IA + Convertidor
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Todo en tu navegador. 100% privado. Sin subir tus archivos a ningún servidor.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/plus"
              className="rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 font-bold text-black transition-transform hover:scale-105"
            >
              Ver plan Plus
            </Link>
            <a
              href="#converter"
              className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-bold text-white transition-colors hover:border-cyan-400 hover:text-cyan-400"
            >
              Convertir video gratis
            </a>
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