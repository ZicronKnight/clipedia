// aplicar-comment-v3.mjs — plantillas de comentarios fieles a las capturas de referencia
import fs from 'node:fs';
const PATH = 'components/studio/commentStudio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-v3', src);
const ops = [];
function span(name, startAnchor, endAnchor, newContent) {
  const s = src.indexOf(startAnchor);
  const e = src.indexOf(endAnchor);
  if (s === -1 || e === -1 || e <= s) { console.error('❌ [' + name + '] anclas no encontradas (start=' + s + ', end=' + e + '). NO se tocó el archivo.'); process.exit(1); }
  src = src.slice(0, s) + newContent + src.slice(e);
  ops.push(name);
}
// 1) Métricas ajustadas a los layouts reales (YouTube y Twitter son más altos)
span('meta',
'const VARIANT_META: Record<CommentVariant',
'const FONT =',
`const VARIANT_META: Record<CommentVariant, { W: number; fs: number; cpl: number; base: number }> = {
'tiktok-reply': { W: 560, fs: 23, cpl: 32, base: 140 },
'tiktok-video': { W: 560, fs: 15, cpl: 50, base: 165 },
'insta-post': { W: 560, fs: 15, cpl: 52, base: 150 },
'insta-reels': { W: 470, fs: 16, cpl: 40, base: 130 },
'yt-video': { W: 620, fs: 15, cpl: 56, base: 235 },
'yt-shorts': { W: 480, fs: 16, cpl: 42, base: 120 },
'tw-post': { W: 620, fs: 16, cpl: 54, base: 195 },
};
`);
// 2) bodyHtml redibujado contra las capturas (colita curva, conectores, columnas de íconos)
span('body',
'function bodyHtml(cfg: CommentConfig): string {',
'function buildSvg(cfg: CommentConfig)',
`function bodyHtml(cfg: CommentConfig): string {
const light = cfg.theme === 'light';
const CARD = light ? '#fafbfc' : '#161823';
const TX = light ? '#0f1419' : '#f1f2f6';
const SUB = light ? '#6b7280' : '#8a939b';
const IC = light ? '#3c4348' : '#d7dbe0';
const ICG = light ? '#8a939b' : '#71767b';
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
const S = (path: string, c: string, s = 18, sw = 1.8): string => \`<svg width="\${s}" height="\${s}" viewBox="0 0 24 24" fill="none" stroke="\${c}" stroke-width="\${sw}" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px">\${path}</svg>\`;
const bubble = (c: string, s = 18) => S('<path d="M21 11.5a8.4 8.4 0 0 1-8.5 8.4c-1.5 0-3-.4-4.2-1L3 20l1.1-5.3a8.4 8.4 0 1 1 16.9-3.2z"/>', c, s);
const sqc = (c: string, s = 18) => S('<path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z"/><path d="M8 8h8"/><path d="M8 11.5h5"/>', c, s);
const dotsV = (c: string, s = 18) => \`<svg width="\${s}" height="\${s}" viewBox="0 0 24 24" fill="\${c}" style="vertical-align:-3px"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>\`;
const dotsH = (c: string, s = 18) => \`<svg width="\${s}" height="\${s}" viewBox="0 0 24 24" fill="\${c}" style="vertical-align:-3px"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>\`;
const slash = (c: string, s = 18) => S('<circle cx="12" cy="12" r="9"/><path d="m5.8 5.8 12.4 12.4"/>', c, s);
const chevR = (c: string, s = 16) => S('<path d="m9 6 6 6-6 6"/>', c, s, 2.2);
const chevD = (c: string, s = 14) => S('<path d="m6 9 6 6 6-6"/>', c, s, 2.2);
const tail = \`<svg width="26" height="22" viewBox="0 0 26 22" style="position:absolute;left:16px;bottom:-19px;display:block"><path d="M0 0 L0 8 Q0 16 12 22 Q6 12 8 0 Z" fill="\${CARD}"/></svg>\`;
switch (cfg.variant) {
case 'tiktok-reply':
return \`<div style="position:relative;max-width:\${W}px;background:\${CARD};border-radius:12px;padding:18px 24px 20px 18px;display:flex;gap:14px;align-items:flex-start">
\${av(52)}<div style="min-width:0">
<div style="color:\${SUB};font-size:15px;font-weight:500;margin-bottom:4px">Reply to \${esc(cfg.username || cfg.displayName)}\${badge}'s comment</div>
<div style="color:\${TX};font-size:23px;font-weight:800;line-height:1.3;white-space:pre-wrap">\${esc(cfg.text)}</div></div>\${tail}</div>\`;
case 'tiktok-video':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start">
\${av(40)}<div style="min-width:0;flex:1">
<div style="color:\${TX};font-size:14px;font-weight:700">\${esc(cfg.displayName)}\${badge}</div>
<div style="color:\${TX};font-size:15px;font-weight:600;line-height:1.35;margin-top:3px;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="display:flex;align-items:center;gap:16px;margin-top:8px;color:\${SUB};font-size:13px;font-weight:500">
<span>\${esc(cfg.timeAgo)}</span><span>Reply</span>
<span style="margin-left:auto;display:flex;align-items:center;gap:5px;color:\${IC}">\${I_HEART(IC, 18)}<span style="color:\${SUB};font-size:13px">\${esc(cfg.likes)}</span></span>
<span style="color:\${IC}">\${I_DOWN(IC, 18)}</span></div>
<div style="display:flex;align-items:center;gap:8px;margin-top:8px;color:\${SUB};font-size:13px;font-weight:600"><span style="width:22px;height:1.5px;background:\${BD};display:inline-block"></span>View \${esc(cfg.replies)} replies \${chevD(SUB)}</div></div></div>\`;
case 'insta-post':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start">
\${av(40)}<div style="min-width:0;flex:1">
<div style="color:\${TX};font-size:14px;font-weight:700">\${esc(cfg.displayName)}\${badge} <span style="color:\${SUB};font-weight:500">\${esc(cfg.timeAgo)}</span></div>
<div style="color:\${TX};font-size:15px;font-weight:500;line-height:1.4;margin-top:3px;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="color:\${SUB};font-size:13px;font-weight:600;margin-top:8px">Reply</div></div>
<div style="flex:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding-top:4px;color:\${ICG}">\${I_HEART(ICG, 20)}<span style="color:\${SUB};font-size:12px;font-weight:600">\${esc(cfg.likes)}</span></div></div>\`;
case 'insta-reels':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start">
\${av(40)}<div style="min-width:0">
<div style="color:\${TX};font-size:16px;font-weight:700;line-height:1.35;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="color:\${SUB};font-size:14px;font-weight:500;margin-top:6px">Replying to \${esc(cfg.username || cfg.displayName)}</div></div></div>\`;
case 'yt-video':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:16px;padding:16px 18px;display:flex;gap:14px;align-items:flex-start">
\${av(42)}<div style="min-width:0;flex:1">
<div style="color:\${TX};font-size:14px;font-weight:700">\${esc(cfg.displayName)}\${badge} <span style="color:\${SUB};font-weight:500">• \${esc(cfg.timeAgo)}</span></div>
<div style="color:\${TX};font-size:15px;font-weight:500;line-height:1.4;margin-top:4px;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="display:flex;align-items:center;gap:18px;margin-top:12px;color:\${IC}">
<span style="display:flex;align-items:center;gap:6px">\${I_UP(IC, 20)}<span style="color:\${SUB};font-size:13px;font-weight:600">\${esc(cfg.likes)}</span></span>
\${I_DOWN(IC, 20)}
<span style="margin-left:10px">\${sqc(IC, 20)}</span></div>
<div style="display:flex;align-items:flex-end;gap:10px;margin-top:12px">
<div style="width:26px;height:36px;border-left:2px solid \${BD};border-bottom:2px solid \${BD};border-bottom-left-radius:16px;margin-left:-4px"></div>
<span style="color:\${TX};font-size:14px;font-weight:700;padding-bottom:3px">\${esc(cfg.replies)} replies \${chevR(IC, 16)}</span></div></div>
<div style="flex:none;color:\${IC}">\${dotsV(IC, 20)}</div></div>\`;
case 'yt-shorts':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start">
\${av(40)}<div style="min-width:0">
<div style="color:\${SUB};font-size:13px;font-weight:500;margin-bottom:4px">Comment from @\${esc(cfg.username || cfg.displayName)}\${badge}</div>
<div style="color:\${TX};font-size:16px;font-weight:700;line-height:1.35;white-space:pre-wrap">\${esc(cfg.text)}</div></div></div>\`;
case 'tw-post':
return \`<div style="max-width:\${W}px;background:\${CARD};border-radius:12px;padding:16px 18px;display:flex;gap:12px;align-items:flex-start">
\${av(46)}<div style="min-width:0;flex:1">
<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
<span style="color:\${TX};font-size:15px;font-weight:800">\${esc(cfg.displayName)}\${badge}</span>
<span style="color:\${SUB};font-size:15px;font-weight:500">@\${esc(cfg.username)} · \${esc(cfg.timeAgo)}</span>
<span style="margin-left:auto;display:flex;gap:12px;align-items:center;color:\${ICG}">\${slash(ICG, 18)}\${dotsH(ICG, 18)}</span></div>
<div style="color:\${TX};font-size:16px;font-weight:500;line-height:1.4;margin-top:4px;white-space:pre-wrap">\${esc(cfg.text)}</div>
<div style="display:flex;align-items:center;gap:34px;margin-top:14px;color:\${ICG};font-size:13px;font-weight:600">
<span style="display:flex;gap:8px;align-items:center">\${bubble(ICG, 18)}\${esc(cfg.replies)}</span>
<span style="display:flex;gap:8px;align-items:center">\${I_RT(ICG, 18)}\${esc(cfg.retweets)}</span>
<span style="display:flex;gap:8px;align-items:center">\${I_HEART(ICG, 18)}\${esc(cfg.likes)}</span>
<span style="display:flex;gap:8px;align-items:center">\${I_VIEWS(ICG, 18)}\${esc(cfg.views)}</span>
<span style="margin-left:auto;display:flex;gap:16px;align-items:center">\${I_BM(ICG, 18)}\${I_SHARE(ICG, 18)}</span></div></div></div>\`;
}
}
`);
fs.writeFileSync(PATH, src);
console.log('✅ Comment Studio v3 (fidelidad) aplicado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-v3');