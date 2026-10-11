import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-300">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-3xl font-bold text-white">Términos y Condiciones</h1>
        <div className="space-y-4 text-sm leading-relaxed">
          <p>Bienvenido a Clipedia. Al utilizar nuestro sitio web y servicios, aceptas estos términos.</p>
          <h2 className="mt-6 text-xl font-semibold text-white">1. Uso del Servicio</h2>
          <p>Clipedia ofrece una biblioteca de clips de video generados por IA y herramientas de conversión de formatos. El uso gratuito está limitado a 5 descargas mensuales en 720p. El plan Plus ofrece acceso ilimitado en 1080p/4K.</p>
          <h2 className="mt-6 text-xl font-semibold text-white">2. Propiedad Intelectual</h2>
          <p>Los clips descargados a través de Clipedia se proporcionan con licencia libre de regalías (royalty-free) para uso en proyectos personales y comerciales. No puedes revender los clips tal cual como tu propio producto.</p>
          <h2 className="mt-6 text-xl font-semibold text-white">3. Cancelaciones</h2>
          <p>Las suscripciones a Clipedia Plus se gestionan a través de LemonSqueezy. Puedes cancelar tu suscripción en cualquier momento desde tu panel de control, y seguirás teniendo acceso hasta el final del período facturado.</p>
        </div>
        <div className="mt-8">
          <Link href="/" className="text-cyan-400 underline hover:text-cyan-300">← Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}