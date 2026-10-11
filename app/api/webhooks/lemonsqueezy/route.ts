import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Inicializamos Supabase con la clave de servicio (ADMIN)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // 1. Obtener el cuerpo crudo de la petición y la firma
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature');
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    // 2. Verificar que la petición viene realmente de LemonSqueezy
    if (!signature || !secret) {
      return NextResponse.json({ error: 'Faltan credenciales' }, { status: 401 });
    }

    const hmac = crypto.createHmac('sha256', secret);
    const digest = Buffer.from(hmac.update(rawBody).digest('hex'), 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (!crypto.timingSafeEqual(digest, signatureBuffer)) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    // 3. Procesar el evento
    const payload = JSON.parse(rawBody);
    const eventName = payload.meta.event_name;

    // Escuchamos cuando se crea o actualiza una suscripción
    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const attributes = payload.data.attributes;
      const userEmail = attributes.user_email;
      const status = attributes.status; // 'active', 'trialing', 'cancelled', etc.

      if (userEmail && (status === 'active' || status === 'trialing')) {
        // Actualizamos el perfil del usuario en Supabase
        // NOTA: Si tu tabla se llama 'users' en vez de 'profiles', cambiá 'profiles' por 'users' aquí abajo.
        const { error } = await supabase
          .from('profiles') 
          .update({ 
            subscription_status: status,
            plan: 'plus'
          })
          .eq('email', userEmail);

        if (error) {
          console.error('Error actualizando Supabase:', error);
          return NextResponse.json({ error: 'Error en base de datos' }, { status: 500 });
        }
        
        console.log(`✅ Usuario ${userEmail} actualizado a plan PLUS`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Error en el webhook:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}