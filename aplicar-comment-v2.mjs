// aplicar-comment-v2.mjs — plantillas de comentarios recalibradas contra las capturas de referencia
import fs from 'node:fs';
const PATH = 'components/studio/commentStudio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-v2', src);
const ops = [];
function span(name, startAnchor, endAnchor, newContent) {
  const s = src.indexOf(startAnchor);
  const e = src.indexOf(endAnchor);
  if (s === -1 || e === -1 || e <= s) { console.error('❌ [' + name + '] anclas no encontradas (start=' + s + ', end=' + e + '). NO se tocó el archivo.'); process.exit(1); }
  src = src.slice(0, s) + newContent + src.slice(e);
  ops.push(name);
}
// 1) Métricas de layout por variante (alturas de cromo acordes a las refs)
span('meta',
'const VARIANT_META: Record<CommentVariant',
'const FONT =',
`const VARIANT_META: Record<CommentVariant, { W: number; fs: number; cpl: number; base: number }> = {
'tiktok-reply': { W: 560, fs: 24, cpl: 32, base: 150 },
'tiktok-video': { W: 560, fs: 16, cpl: 50, base: 150 },
'insta-post': { W: 560, fs: 15, cpl: 54, base: 140 },
'insta-reels': { W: 470, fs: 17, cpl: 40, base: 130 },
'yt-video': { W: 600, fs: 15, cpl: 58, base: 215 },
'yt-shorts': { W: 480, fs: 17, cpl: 42, base: 120 },
'tw-post': { W: 600, fs: 16, cpl: 54, base: 185 },
};
`);
// 2) bodyHtml completo, redibujado contra las 5 capturas
span('body',
'function bodyHtml(cfg: CommentConfig): string {',
'function buildSvg(cfg: CommentConfig)',
`function bodyHtml(cfg: CommentConfig): string {
const light = cfg.theme === 'light';
const CARD = light ? '#f7f8fa' : '#161823';
const TX = light ? '#0f1419' : '#f1f2f6';
const SUB = light ? '#6b7280' : '#8a939b';
const IC = light ? '#57606a' : '#c3c9cf';
const BD = light ? '#d4d9de' : '#333a41';
const W = VARIANT_META[cfg.variant].W;
const badgeFor = (p: CommentPlatform, s = 15): string => {
const color = p === 'instagram' ? '#3897f0' : p === 'twitter' ? '#1d9bf0' : p === 'youtube' ? '#8a939b' : '#20d5ec';
return \`<svg width="\${s}" height="\${s}" viewBox="0 0 24 24" style="vertical-align:-2px"><circle cx="12" cy="12" r="10" fill="\${color}"/><path d="M8.5 12.2l2.3 2.3 4.7-5" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>\`;
};
const badge = cfg.verified ? badgeFor(PLATFORM_OF[cfg.variant]) : '';
const av = (size: number): string => {
if (cfg.avatar) return \`<img src="\${cfg.avatar}" style="width:\${size}px;height:\${size}px;border-radius:50%;object-fit:cover;display:block;flex:none"/>\`;
return \`<svg width="\${size}" height="\${size}" viewBox="0 0 24 24" style="flex:none;border-radius:50%"><clipPath id="avc"><circle cx="12" cy="12" r="12"/></clipPath><g clip-path="url(#avc)"><rect width="24" height="24" fill="#c9d3dd"/><circle cx="12" cy="9.6" r="4.1" fill="#66727f"/><ellipse cx="12" cy="21.5" rx="8.6" ry="7.2" fill="#66727f"/></g></svg>\`;
};
const ic = {
bubble: (c: string, s = 17) => svgIcon('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4c-1.5 0-3-.4-4.2-1L3 20l1.1-5.3a8.4 8.4 0 1 1 16.9-3.2z"/>', c, s),
dots: (c: string, s = 18) => \`<svg width="\${s}" height="\${s}" viewBox="0 0 24 24" fill="\${c}" style="vertical-align:-3px"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>\`,
slash: (c: string, s = 17) => svgIcon('<circle cx="12" cy="12" r="9"/><path d="m5.8 5.8 12.4 12.4"/>', c, s),
chevD: (c: string, s = 14) => svgIcon('<path d="m6 9 6 6 6-6"/>', c, s),
chevR: (c: string, s = 15) => svgIcon('<path d="m9 6 6 6-6 6"/>', c, s),
};
switch (cfg.variant) {
case 'tiktok-reply':
return \`<div style="position:relative;max-width:\${W}px;background:\${CARD};border-radius:16px;padding:20px 26px 24px 20px;display:flex;gap:16px;align-items:flex-start">
\${av(52)}<div style="min-width:0">
<div style="color:\${SUB};font-size:15px;font-weight:500;margin-bottom:6px">Reply to \${esc(cfg.username || cfg.displayName)}\${badge}'s comment</div>
<div style="color:\${TX};font-size:24px;font-weight:800;line-height:1.3;white-space:pre-wrap">\${esc(cfg.text)}</div></div>
<div style="position:absolute;left:22px;bottom:-15px;width:32px;height:32px;background:\${CARD};clip-path:polygon(0 0,100% 0,0 100%)"></div></div>\`;
case 'tiktok-video':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:16px 18px;display:flex;gap:12px;align-items:flex-start">
\${av(44)}<div style="min-width:0;flex:1">
<div style="color:\${TX};font-size:14px;font-weight:700">\${esc(cfg.displayName)}\${badge}</div>
<div style="color:\${TX};font-size:16px;font-weight:600;line-height:1.35;margin-top:4px;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="display:flex;align-items:center;gap:16px;margin-top:10px;color:\${SUB};font-size:13px;font-weight:500"><span>\${esc(cfg.timeAgo)}</span><span>Reply</span><span style="margin-left:auto;display:flex;align-items:center;gap:5px">\${I_HEART(SUB, 17)} \${esc(cfg.likes)}</span>\${I_DOWN(SUB, 17)}</div>
<div style="display:flex;align-items:center;gap:8px;margin-top:10px;color:\${SUB};font-size:13px;font-weight:600"><span style="width:24px;height:1.5px;background:\${SUB};display:inline-block"></span>View \${esc(cfg.replies)} replies \${ic.chevD(SUB)}</div></div></div>\`;
case 'insta-post':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:16px 18px;display:flex;gap:12px;align-items:flex-start">
\${av(40)}<div style="min-width:0;flex:1">
<div style="color:\${TX};font-size:14px;font-weight:700">\${esc(cfg.displayName)}\${badge} <span style="color:\${SUB};font-weight:500">\${esc(cfg.timeAgo)}</span></div>
<div style="color:\${TX};font-size:15px;font-weight:500;line-height:1.4;margin-top:4px;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="display:flex;align-items:center;margin-top:10px;color:\${SUB};font-size:13px;font-weight:600"><span>Reply</span><span style="margin-left:auto;display:flex;align-items:center;gap:5px">\${I_HEART(SUB, 17)} \${esc(cfg.likes)}</span></div></div></div>\`;
case 'insta-reels':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:16px 18px;display:flex;gap:12px;align-items:flex-start">
\${av(44)}<div style="min-width:0">
<div style="color:\${TX};font-size:17px;font-weight:700;line-height:1.35;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="color:\${SUB};font-size:14px;font-weight:500;margin-top:8px">Replying to \${esc(cfg.username || cfg.displayName)}</div></div></div>\`;
case 'yt-video':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:18px 20px;display:flex;gap:14px;align-items:flex-start">
\${av(44)}<div style="min-width:0;flex:1">
<div style="color:\${TX};font-size:14px;font-weight:700">\${esc(cfg.displayName)}\${badge} <span style="color:\${SUB};font-weight:500">• \${esc(cfg.timeAgo)}</span></div>
<div style="color:\${TX};font-size:15px;font-weight:500;line-height:1.4;margin-top:6px;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="display:flex;align-items:center;gap:16px;margin-top:12px;color:\${IC}">
<span style="display:flex;align-items:center;gap:6px">\${I_UP(IC, 19)}<span style="color:\${SUB};font-size:13px;font-weight:600">\${esc(cfg.likes)}</span></span>
\${I_DOWN(IC, 19)}
<span style="margin-left:12px">\${ic.bubble(IC, 19)}</span></div>
<div style="display:flex;align-items:flex-end;gap:10px;margin-top:12px">
<div style="width:24px;height:32px;border-left:2px solid \${BD};border-bottom:2px solid \${BD};border-bottom-left-radius:14px"></div>
<span style="color:\${TX};font-size:14px;font-weight:700;padding-bottom:2px">\${esc(cfg.replies)} replies \${ic.chevR(IC, 15)}</span></div></div>
<div style="color:\${IC};flex:none">\${ic.dots(IC, 20)}</div></div>\`;
case 'yt-shorts':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:16px 18px;display:flex;gap:12px;align-items:flex-start">
\${av(44)}<div style="min-width:0">
<div style="color:\${SUB};font-size:13px;font-weight:500;margin-bottom:5px">Comment from @\${esc(cfg.username || cfg.displayName)}\${badge}</div>
<div style="color:\${TX};font-size:17px;font-weight:700;line-height:1.35;white-space:pre-wrap">\${esc(cfg.text)}</div></div></div>\`;
case 'tw-post':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:10px;padding:18px 20px;display:flex;gap:12px;align-items:flex-start">
\${av(48)}<div style="min-width:0;flex:1">
<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
<span style="color:\${TX};font-size:15px;font-weight:800">\${esc(cfg.displayName)}\${badge}</span>
<span style="color:\${SUB};font-size:15px;font-weight:500">@\${esc(cfg.username)} · \${esc(cfg.timeAgo)}</span>
<span style="margin-left:auto;display:flex;gap:10px;align-items:center;color:\${IC}">\${ic.slash(IC, 17)}\${ic.dots(IC, 17)}</span></div>
<div style="color:\${TX};font-size:16px;font-weight:500;line-height:1.4;margin-top:6px;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="display:flex;align-items:center;gap:30px;margin-top:14px;color:\${SUB};font-size:13px;font-weight:600">
<span style="display:flex;gap:7px;align-items:center">\${ic.bubble(SUB, 17)}\${esc(cfg.replies)}</span>
<span style="display:flex;gap:7px;align-items:center">\${I_RT(SUB, 17)}\${esc(cfg.retweets)}</span>
<span style="display:flex;gap:7px;align-items:center">\${I_HEART(SUB, 17)}\${esc(cfg.likes)}</span>
<span style="display:flex;gap:7px;align-items:center">\${I_VIEWS(SUB, 17)}\${esc(cfg.views)}</span>
<span style="margin-left:auto;display:flex;gap:14px;align-items:center">\${I_BM(SUB, 17)}\${I_SHARE(SUB, 17)}</span></div></div></div>\`;
}
}
`);
fs.writeFileSync(PATH, src);
console.log('✅ Comment Studio v2 (fidelidad) aplicado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-v2');