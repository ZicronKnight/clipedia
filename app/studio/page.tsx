import Link from 'next/link';
import Studio from '@/components/studio/Studio';

export const metadata = {
  title: 'Clipedia Studio — Editor de video en el navegador',
  description:
    'Editá, recortá y exportá videos 4K sin subir nada: todo ocurre en tu pestaña.',
};

export default function StudioPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="sticky top-0 z-40 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo/monogram-studio.png"
              alt="Clipedia Studio"
              className="h-8 w-8 object-contain"
            />
            <span className="font-bold">
              Clipedia <span className="text-cyan-400">Studio</span>
            </span>
          </Link>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-400">
            Beta privada — tus archivos nunca salen de esta pestaña 🔒
          </span>
        </div>
      </header>
      <Studio />
    </main>
  );
}