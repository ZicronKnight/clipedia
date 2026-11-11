// aplicar-comment-fix1.mjs — badge verificado por plataforma + presente en las 7 variantes
import fs from 'node:fs';
const PATH = 'components/studio/commentStudio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-badge', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Badge con color por plataforma (TikTok cyan, IG azul, YT gris, X azul)
rep('badge-fn',
"const I_BADGE = `<svg width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" style=\"vertical-align:-2px\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#20d5ec\"/><path d=\"M8.5 12.2l2.3 2.3 4.7-5\" stroke=\"#fff\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\"/></svg>`;",
"function badgeFor(platform: CommentPlatform, size = 15): string {\nconst color = platform === 'instagram' ? '#3897f0' : platform === 'twitter' ? '#1d9bf0' : platform === 'youtube' ? '#8a939b' : '#20d5ec';\nreturn `<svg width=\"${size}\" height=\"${size}\" viewBox=\"0 0 24 24\" style=\"vertical-align:-2px\"><circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"${color}\"/><path d=\"M8.5 12.2l2.3 2.3 4.7-5\" stroke=\"#fff\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\"/></svg>`;\n}");
// 2) El nombre lleva el badge de SU plataforma
rep('badge-name',
"const name = esc(cfg.displayName) + (cfg.verified ? ' ' + I_BADGE : '');",
"const name = esc(cfg.displayName) + (cfg.verified ? ' ' + badgeFor(PLATFORM_OF[cfg.variant]) : '');");
// 3) tiktok-reply: badge después del nombre en la línea de respuesta
rep('badge-reply',
"<div style=\"color:${sub};font-size:15px;margin-bottom:6px\">Reply to ${esc(cfg.username || cfg.displayName)}'s comment</div>",
"<div style=\"color:${sub};font-size:15px;margin-bottom:6px\">Reply to ${esc(cfg.username || cfg.displayName)}${cfg.verified ? badgeFor('tiktok', 13) : ''}'s comment</div>");
// 4) insta-reels: badge en "Replying to …"
rep('badge-reels',
"<div style=\"color:${sub};font-size:12px;margin-top:8px\">Replying to ${esc(cfg.username || cfg.displayName)}</div>",
"<div style=\"color:${sub};font-size:12px;margin-top:8px\">Replying to ${esc(cfg.username || cfg.displayName)}${cfg.verified ? badgeFor('instagram', 12) : ''}</div>");
// 5) yt-shorts: badge en "Comment from @…"
rep('badge-shorts',
"<div style=\"color:rgba(255,255,255,.6);font-size:12px;margin-bottom:6px\">Comment from @${esc(cfg.username || cfg.displayName)}</div>",
"<div style=\"color:rgba(255,255,255,.6);font-size:12px;margin-bottom:6px\">Comment from @${esc(cfg.username || cfg.displayName)}${cfg.verified ? badgeFor('youtube', 12) : ''}</div>");
fs.writeFileSync(PATH, src);
console.log('✅ Badge verificado arreglado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-badge');