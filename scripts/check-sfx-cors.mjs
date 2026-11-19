// check-sfx-cors.mjs — diagnostica CORS y caché del manifest de R2
const URL_TEST = process.argv[2] || 'https://sfx.clipedia.net/sfx/manifest.json';
const ORIGINS = ['https://clipedia.net', 'http://localhost:3000'];

async function probe(url, origin) {
  try {
    const r = await fetch(url, { headers: { Origin: origin }, redirect: 'follow' });
    return {
      status: r.status,
      acao: r.headers.get('access-control-allow-origin'),
      vary: r.headers.get('vary'),
      cf: r.headers.get('cf-cache-status'),
      age: r.headers.get('age'),
    };
  } catch (e) {
    return { status: 'ERR', acao: null, vary: null, cf: null, age: null, err: String(e?.message || e) };
  }
}

console.log('🔎 ' + URL_TEST + '\n');
let freshOk = false;
let cachedOk = false;

for (const origin of ORIGINS) {
  const fresh = await probe(URL_TEST + '?cb=' + Date.now(), origin);
  const cached = await probe(URL_TEST, origin);
  console.log('Origin: ' + origin);
  console.log('  FRESCO (con cache-buster) → HTTP ' + fresh.status + ' · ACAO: ' + (fresh.acao || 'AUSENTE') + ' · cf: ' + (fresh.cf || '-') + ' · vary: ' + (fresh.vary || '-'));
  console.log('  CACHEADO (URL limpia)     → HTTP ' + cached.status + ' · ACAO: ' + (cached.acao || 'AUSENTE') + ' · cf: ' + (cached.cf || '-') + ' · age: ' + (cached.age || '-'));
  if (fresh.acao) freshOk = true;
  if (cached.acao) cachedOk = true;
  console.log('');
}

// Preflight OPTIONS (lo que el navegador manda si hay headers no simples)
try {
  const r = await fetch(URL_TEST, {
    method: 'OPTIONS',
    headers: {
      Origin: ORIGINS[0],
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'cache-control',
    },
  });
  console.log('Preflight OPTIONS → HTTP ' + r.status + ' · ACAO: ' + (r.headers.get('access-control-allow-origin') || 'AUSENTE') + ' · Methods: ' + (r.headers.get('access-control-allow-methods') || '-'));
} catch (e) {
  console.log('Preflight OPTIONS → ERR ' + String(e?.message || e));
}

console.log('\n──── VEREDICTO ────');
if (freshOk && cachedOk) {
  console.log('✅ CORS OK en fresco y cacheado. El fetch del navegador debería andar.');
  console.log('   Si sigue fallando, hard-refresh (Ctrl+Shift+R): el navegador también cachea el rechazo.');
} else if (freshOk && !cachedOk) {
  console.log('⚠️  CORS bien configurado, pero la CACHÉ de Cloudflare sirve la copia vieja sin headers.');
  console.log('   → Cloudflare → Caching → Custom Purge → ' + URL_TEST);
} else {
  console.log('❌ El bucket NO devuelve Access-Control-Allow-Origin ni en fresco.');
  console.log('   → R2 → bucket → Settings → CORS Policy → pegá el JSON con AllowedOrigins ["*"].');
  console.log('   → Guardá y volvé a correr este script.');
}