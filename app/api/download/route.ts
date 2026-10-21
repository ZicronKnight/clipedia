import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(req: Request) {
  try {
    const { clipId, quality } = await req.json();
    if (!['720p', '1080p', '4k'].includes(quality)) {
      return NextResponse.json({ error: 'bad-quality' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 });

    const isPlus =
      process.env.BETA_PLUS_UNLOCK === 'true' ||
      !!(await (async () => {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('plan,status')
          .eq('user_id', user.id)
          .single();
        return sub && sub.plan === 'plus' && sub.status === 'active';
      })());

    if (quality !== '720p' && !isPlus) {
      return NextResponse.json({ error: 'plus' }, { status: 403 });
    }

    if (quality === '720p' && !isPlus) {
      const start = new Date();
      start.setDate(1); start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('downloads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('quality', '720p')
        .gte('created_at', start.toISOString());
      if ((count ?? 0) >= 10) {
        return NextResponse.json({ error: 'quota' }, { status: 403 });
      }
    }

    const { data: clip } = await supabase
      .from('clips')
      .select('free_path, hd_path, uhd_path')
      .eq('id', clipId)
      .single();
    if (!clip) return NextResponse.json({ error: 'not-found' }, { status: 404 });
    const raw = quality === '720p' ? clip.free_path : quality === '1080p' ? clip.hd_path : clip.uhd_path;
    if (!raw) return NextResponse.json({ error: 'missing' }, { status: 404 });
    const key = raw.startsWith('r2:') ? raw.slice(3) : raw;

    const { error: insErr } = await supabase
      .from('downloads')
      .insert({ user_id: user.id, clip_id: clipId, quality });
    if (insErr) return NextResponse.json({ error: 'quota' }, { status: 403 });

    const s3 = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
      { expiresIn: 300 }
    );
    return NextResponse.json({ url });
  } catch (e) {
    console.error('[download]', e);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}