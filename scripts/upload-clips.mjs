// Sube las 4 rendiciones a Cloudflare R2 y publica en la tabla clips.
//   node --env-file=.env.local scripts/upload-clips.mjs                 → todo
//   node --env-file=.env.local scripts/upload-clips.mjs --pack pack1    → un pack
//   node --env-file=.env.local scripts/upload-clips.mjs --sign pack1/neural-network-tunnel 4k
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

// DEBUG: verificar que las env vars se cargan
console.log('🔍 Verificando env vars:');
console.log('R2_ENDPOINT:', process.env.R2_ENDPOINT?.slice(0, 20) + '...');
console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ existe (' + process.env.R2_ACCESS_KEY_ID.length + ' chars)' : '❌ FALTA');
console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ existe (' + process.env.R2_SECRET_ACCESS_KEY.length + ' chars)' : '❌ FALTA');
console.log('R2_BUCKET:', process.env.R2_BUCKET || '❌ FALTA');
console.log('---');

const SOURCE_DIR = 'D:/proyectos/Clips'; // ← AJUSTÁ a tu carpeta real
const MANIFEST = 'scripts/clips-manifest.json';
const CDN_BASE = 'https://cdn.clipedia.net';

const R2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});
const BUCKET_PREVIEWS = 'clipedia-previews';
const BUCKET_VIDEOS = process.env.R2_BUCKET;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const packFilter = has('--pack') ? args[args.indexOf('--pack') + 1] : null;

function probe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration', '-of', 'json', file], { encoding: 'utf8' });
  const s = JSON.parse(out).streams[0];
  return { w: s.width, h: s.height, d: parseFloat(s.duration) || 0 };
}
async function putR2(bucket, key, file) {
  await R2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.readFileSync(file), ContentType: 'video/mp4' }));
}

if (has('--sign')) {
  const base = args[args.indexOf('--sign') + 1];
  const quality = args[args.indexOf('--sign') + 2] || '4k';
  const key = `${base}-${quality}.mp4`;
  const url = await getSignedUrl(R2, new GetObjectCommand({ Bucket: BUCKET_VIDEOS, Key: key }), { expiresIn: 3600 });
  console.log(`\n🔗 ${key} — link válido 1 hora:\n${url}\n`);
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).filter((c) => !packFilter || c.pack === packFilter);
let ok = 0, skip = 0, fail = 0;

for (const c of manifest) {
  const f480 = path.join(SOURCE_DIR, `${c.slug}-480p.mp4`);
  const f720 = path.join(SOURCE_DIR, `${c.slug}-720p.mp4`);
  const f1080 = path.join(SOURCE_DIR, `${c.slug}-1080p.mp4`);
  const f4k = path.join(SOURCE_DIR, `${c.slug}-4k.mp4`);

  if (!fs.existsSync(f480)) { console.log(`⏭️  ${c.slug}: falta 480p, se saltea`); skip++; continue; }
  const meta = probe(fs.existsSync(f720) ? f720 : f480);

  try {
    console.log(`⬆️  ${c.slug} (${c.pack})`);
    await putR2(BUCKET_PREVIEWS, `${c.pack}/${c.slug}-480p.mp4`, f480);
    console.log('   🌐 480p → cdn.clipedia.net');
    if (fs.existsSync(f720)) { await putR2(BUCKET_VIDEOS, `${c.pack}/${c.slug}-720p.mp4`, f720); console.log('   ☁️ 720p → R2 privado'); }
    if (fs.existsSync(f1080)) { await putR2(BUCKET_VIDEOS, `${c.pack}/${c.slug}-1080p.mp4`, f1080); console.log('   ☁️ 1080p → R2 privado'); }
    if (fs.existsSync(f4k)) { await putR2(BUCKET_VIDEOS, `${c.pack}/${c.slug}-4k.mp4`, f4k); console.log('   ☁️ 4k → R2 privado'); }
  } catch (e) {
    console.error(`   ❌ Upload: ${e.message}`);
    fail++;
    continue;
  }

  const { error } = await sb.from('clips').upsert({
    title: c.title,
    slug: c.slug,
    pack: c.pack,
    keywords: c.kw,
    duration_s: Math.round(meta.d),
    orientation: meta.w >= meta.h ? 'landscape' : 'portrait',
    preview_path: `${CDN_BASE}/${c.pack}/${c.slug}-480p.mp4`,
    free_path: fs.existsSync(f720) ? `r2:${c.pack}/${c.slug}-720p.mp4` : null,
    hd_path: fs.existsSync(f1080) ? `r2:${c.pack}/${c.slug}-1080p.mp4` : null,
    uhd_path: fs.existsSync(f4k) ? `r2:${c.pack}/${c.slug}-4k.mp4` : null,
    is_published: true,
  }, { onConflict: 'slug' });

  if (error) { console.error(`   ❌ DB: ${error.message}`); fail++; }
  else { console.log('   ✅ publicado'); ok++; }
}

console.log(`\n🎉 Terminó: ${ok} OK · ${skip} salteados · ${fail} errores.`);