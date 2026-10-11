import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 p-8 text-slate-300">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-3xl font-bold text-white">Política de Privacidad</h1>
        <div className="space-y-4 text-sm leading-relaxed">
          <p>En Clipedia, respetamos tu privacidad. Esta política explica cómo manejamos tus datos.</p>
          <h2 className="mt-6 text-xl font-semibold text-white">1. Datos que recopilamos</h2>
          <p>Solo recopilamos tu dirección de correo electrónico (para crear tu cuenta y enviarte recibos) y tu historial de descargas para gestionar los límites de tu plan.</p>
          <h2 className="mt-6 text-xl font-semibold text-white">2. Conversión de archivos</h2>
          <p>Nuestra herramienta de conversión de video/audio funciona 100% en tu navegador (client-side). Tus archivos <strong>nunca</strong> se suben a nuestros servidores, garantizando tu privacidad total.</p>
          <h2 className="mt-6 text-xl font-semibold text-white">3. Contacto</h2>
          <p>Si tienes dudas sobre tu privacidad, puedes escribirnos a: <span className="text-cyan-400">soporte@clipedia.net</span> (o tu correo real).</p>
        </div>
        <div className="mt-8">
          <Link href="/" className="text-cyan-400 underline hover:text-cyan-300">← Volver al inicio</Link>
        </div>
      </div>
    </main>
  );
}