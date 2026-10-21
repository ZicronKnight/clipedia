import Link from 'next/link';

export const metadata = {
  title: 'Clipedia Plus — Precios y beneficios',
  description:
    'Descargas ilimitadas 1080p/4K, formatos pro y export Studio en alta calidad por US$ 7.99/mes.',
};

// 🔑 Cuando conectemos Mercado Pago / Paddle, pegá acá la URL del checkout.
// Mientras esté vacía, el CTA abre un mail a hola@clipedia.net (activación manual de beta).
const CHECKOUT_URL = '';

const FREE_FEATURES = [
  '10 descargas de clips por mes (720p)',
  'Convertidor ilimitado hasta 720p',
  'Formatos básicos: MP4, MOV, MKV, GIF y MP3',
  'Studio: export hasta 720p',
  'Sin marca de agua',
  'Todo en tu navegador: nada se sube a un servidor',
];

const PLUS_FEATURES = [
  'Descargas ilimitadas en 1080p y 4K',
  'Formatos pro: WAV, FLAC, M4A y más',
  'Conversión por lotes (hasta 50 archivos)',
  'Studio: export 1080p y 4K',
  'Acceso anticipado a packs nuevos',
  'Soporte prioritario vía soporte@clipedia.net',
];

const FAQ = [
  {
    q: '¿Mis archivos se suben a un servidor?',
    a: 'Nunca. Todo el procesamiento (conversión, edición y export) ocurre en tu navegador con FFmpeg.wasm. Es la promesa central de Clipedia.',
  },
  {
    q: '¿Por qué los clips en Clipedia no tienen marca de agua?',
    a: 'En Clipedia creemos que el contenido debe ser realmente útil. Por eso, los clips que descargues estarán libres de marcas de agua. Sabemos que muchos creadores encuentran suficiente calidad en 720p para sus proyectos, y no tendría sentido arruinar esos recursos con un sello molesto. Queremos que trabajes rápido, con privacidad y con material listo para usar',
  },
  {
    q: '¿Puedo cancelar cuando quiera?',
    a: 'Sí. La suscripción es mensual y se cancela en un clic desde tu cuenta. Mantenés el acceso hasta el fin del período ya pagado.',
  },
  {
    q: '¿Cómo funciona durante la beta privada?',
    a: 'Hoy todas las funciones Plus están desbloqueadas para quienes prueban la plataforma. Al lanzamiento oficial, los beta testers mantienen condiciones especiales.',
  },
  {
    q: '¿Qué métodos de pago van a aceptar?',
    a: 'Al lanzamiento: tarjetas y métodos locales vía Mercado Pago, y tarjetas internacionales vía Paddle/PayPal. Durante la beta, la activación es manual por email.',
  },
];

function CtaPlus({ big = false }: { big?: boolean }) {
  const classes = big
    ? 'rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-8 py-4 text-lg font-black text-black transition-transform hover:scale-105'
    : 'rounded-xl bg-gradient-to-r from-cyan-500 to-violet-500 px-6 py-3 font-bold text-black transition-transform hover:scale-105';
  if (CHECKOUT_URL) {
    return (
      <a href={CHECKOUT_URL} className={classes}>
        Conseguir Plus →
      </a>
    );
  }
  return (
    <a
      href="mailto:hola@clipedia.net?subject=Quiero%20Clipedia%20Plus%20(beta%20privada)"
      className={classes}
    >
      Activar Plus →
    </a>
  );
}

export default function PlusPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-40 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo/monogram-plus.png" alt="Clipedia Plus" className="h-8 w-8 object-contain" />
            <span className="font-bold">
              Clipedia <span className="text-cyan-400">Plus</span>
            </span>
          </Link>
          <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-400">
            Beta privada — todo desbloqueado 🎁
          </span>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="border-b border-slate-800/50 bg-gradient-to-b from-slate-900/50 to-slate-950 py-16 text-center">
        <div className="mx-auto max-w-3xl px-6">
          <img src="/logo/monogram-plus.png" alt="" className="mx-auto mb-6 h-20 w-20 object-contain" />
          <h1 className="mb-4 text-5xl font-black tracking-tight md:text-6xl">
            Todo Clipedia,{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
              sin límites
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-slate-400">
            La misma privacidad de siempre (nada se sube a un servidor), con toda la calidad
            que tus proyectos necesitan.
          </p>
          <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 px-6 py-3">
            <span className="text-3xl font-black text-white">US$ 7.99</span>
            <span className="text-sm text-slate-400">/mes · cancelás cuando quieras</span>
          </div>
        </div>
      </section>

      {/* ===== COMPARATIVA ===== */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Plan Gratis */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
            <h2 className="text-2xl font-bold text-white">Gratis</h2>
            <p className="mt-1 text-sm text-slate-400">Para crear y probar sin compromiso.</p>
            <p className="mt-6 text-4xl font-black text-white">
              $0 <span className="text-base font-semibold text-slate-500">/mes</span>
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <span className="mt-0.5 text-slate-500">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/"
              className="mt-10 block rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 text-center font-bold text-white transition-colors hover:border-cyan-400 hover:text-cyan-400"
            >
              Empezar gratis
            </Link>
          </div>

          {/* Plan Plus */}
          <div className="rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-500 p-[1px] shadow-2xl shadow-cyan-900/20">
            <div className="relative rounded-2xl bg-slate-900 p-8">
              <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-1 text-xs font-black text-black">
                RECOMENDADO
              </span>
              <h2 className="text-2xl font-bold text-white">Plus</h2>
              <p className="mt-1 text-sm text-slate-400">Para quienes viven de crear contenido.</p>
              <p className="mt-6 text-4xl font-black text-white">
                $7.99 <span className="text-base font-semibold text-slate-500">/mes</span>
              </p>
              <ul className="mt-8 space-y-3 text-sm text-slate-200">
                {PLUS_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <span className="mt-0.5 font-black text-cyan-400">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-10">
                <CtaPlus />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="border-t border-slate-800/50 bg-slate-900/30 py-16">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-8 text-center text-3xl font-black text-white">Preguntas frecuentes</h2>
          <div className="space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-slate-800 bg-slate-900/50 p-5 open:border-cyan-400/40"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-white">
                  {item.q}
                  <span className="text-cyan-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="border-t border-slate-800">
        <div className="bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-cyan-500/10 py-12">
          <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-6 px-6 text-center md:flex-row md:text-left">
            <div>
              <h3 className="text-2xl font-black text-white">
                Listo para crear en{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-violet-500 bg-clip-text text-transparent">
                  4K
                </span>
                ?
              </h3>
              <p className="mt-1 text-slate-400">
                Cancelás cuando quieras. Tus archivos, siempre tuyos.
              </p>
            </div>
            <CtaPlus big />
          </div>
        </div>
      </section>

      {/* ===== FOOTER MINI ===== */}
      <footer className="border-t border-slate-800 py-8 text-center">
        <div className="mb-4 flex justify-center gap-6 text-sm text-slate-500">
          <Link href="/" className="transition-colors hover:text-cyan-400">Inicio</Link>
          <Link href="/studio" className="transition-colors hover:text-cyan-400">Studio</Link>
          <Link href="/terms" className="transition-colors hover:text-cyan-400">Términos</Link>
          <Link href="/privacy" className="transition-colors hover:text-cyan-400">Privacidad</Link>
        </div>
        <p className="text-xs text-slate-600">
          © {new Date().getFullYear()} Clipedia. Todos los derechos reservados. Contacto: hola@clipedia.net
        </p>
      </footer>
    </main>
  );
}