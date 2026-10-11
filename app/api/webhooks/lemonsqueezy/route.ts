import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-signature');
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    // 1. Validación básica
    if (!signature || !secret) {
      return NextResponse.json({ error: 'Faltan credenciales' }, { status: 401 });
    }

    // 2. Verificación de firma (versión a prueba de fallos)
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(rawBody).digest('hex');
    
    // Comparamos directamente para evitar crashes por longitud distinta en pruebas
    if (signature !== digest) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    // 3. Procesar el evento
    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;

    if (eventName === 'subscription_created' || eventName === 'subscription_updated') {
      const attributes = payload.data?.attributes;
      const userEmail = attributes?.user_email;
      const status = attributes?.status;

      if (userEmail && (status === 'active' || status === 'trialing')) {
        // Inicializamos el cliente con la clave de servicio (ADMIN)
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Actualizamos el perfil del usuario
        // NOTA: Si tu tabla se llama 'users' en vez de 'profiles', cambiá 'profiles' por 'users' aquí.
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
    return NextResponse.json({ error: 'Error interno', details: String(error) }, { status: 500 });
  }
}