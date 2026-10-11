import Link from 'next/link';
import Converter from '@/components/Converter';
import Gallery from '@/components/Gallery';
import AuthUI from '@/components/AuthUI';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      <header className="flex justify-end p-4">
        <AuthUI />
      </header>

      <div className="mx-auto max-w-6xl px-8 pb-8">
        <h1 className="mb-2 text-center text-5xl font-black text-white">
          Clipedia<span className="text-cyan-400">.net</span>
        </h1>
        <p className="text-center text-xl text-slate-400">
          B-Roll de IA + Convertidor de Video. Todo en tu navegador, 100% privado.
        </p>
      </div>

      <section className="border-t border-slate-800 py-16">
        <Gallery />
      </section>

      <section className="border-t border-slate-800 py-16">
        <div className="mx-auto max-w-xl px-8">
          <h2 className="mb-8 text-center text-3xl font-bold text-white">Convertidor Gratis</h2>
          <Converter />
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center">
        <div className="mb-4 flex justify-center gap-6 text-sm text-slate-500">
          <Link href="/plus" className="hover:text-cyan-400 transition-colors">Clipedia Plus</Link>
          <Link href="/terms" className="hover:text-cyan-400 transition-colors">Términos</Link>
          <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacidad</Link>
        </div>
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} Clipedia. Todos los derechos reservados. 
          Contacto: soporte@clipedia.net
        </p>
      </footer>
    </main>
  );
}