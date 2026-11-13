// aplicar-iconos-svg.mjs — migra los emojis de controles a SVG (Studio.tsx + commentStudio.tsx)
import fs from 'node:fs';

if (!fs.existsSync('components/studio/uiIcons.tsx')) {
  console.error('❌ Falta components/studio/uiIcons.tsx. Crealo primero. NO se tocó nada.');
  process.exit(1);
}

const CLS = 'inline h-[1.15em] w-[1.15em] shrink-0 align-[-0.18em]';
const TABLE = [
  ['🖼️','image'],['🖼','image'],['🎵','music'],['🎙️','mic'],['🎙','mic'],['🎤','mic'],
  ['🗑️','trash'],['🗑','trash'],['✂️','scissors'],['✂','scissors'],['☀️','sun'],['☀','sun'],
  ['👁️','eye'],['👁','eye'],['⬇️','download'],['⬇','download'],['✍️','pen'],['✍','pen'],
  ['⚙️','gear'],['⚙','gear'],['❤️','heartFilled'],['❤','heartFilled'],['🌙','moon'],
  ['⟲','rotate'],['↺','reset'],['⌖','crosshair'],['🎞️','film'],['🎞','film'],['🎚️','contrast'],['🎚','contrast'],
  ['🎨','palette'],['🌈','spectrum'],['💧','droplet'],['🌑','moon'],['💡','bulb'],['🟩','chroma'],
  ['🎬','clapper'],['🔍','search'],['🧰','toolbox'],['💬','comment'],['📋','copy'],['📑','duplicate'],
  ['📥','paste'],['🔗','link'],['🔓','unlock'],['🔒','lock'],['🔇','volumeX'],['🔊','volume'],
  ['🙈','eyeOff'],['↑','arrowUp'],['↓','arrowDown'],['＋','plus'],['➕','plus'],['🧲','magnet'],
  ['✨','sparkles'],['⚡','bolt'],['✕','x'],['🎯','target'],['📦','package'],['⏳','hourglass'],
  ['✅','check'],['📊','chart'],['📝','textLines'],['🕒','clock'],['♡','heart'],['🔁','repeat'],
  ['🔀','shuffle'],['👤','user'],['🏁','checkerboard'],['▢','roundedSquare'],['✓','badgeCheck'],
  ['📷','camera'],['🔲','squareOutline'],['📂','package'],['🎥','film'],
].sort((a, b) => b[0].length - a[0].length);

const EMOJI_SRC = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const fails = [];
const report = [];

function load(p) {
  const raw = fs.readFileSync(p, 'utf8');
  fs.writeFileSync(p + '.bak-icons', raw);
  return { raw, eol: raw.includes('\r\n') ? '\r\n' : '\n' };
}
function one(src, name, search, replace, label) {
  const c = src.split(search).length - 1;
  if (c !== 1) { fails.push(label + ' [' + name + '] → ' + c); return src; }
  report.push(label + ':' + name);
  return src.replace(search, replace);
}
function rex(src, name, re, replace, label) {
  const c = (src.match(new RegExp(re.source, 'g')) || []).length;
  if (c !== 1) { fails.push(label + ' [' + name + '] → ' + c); return src; }
  report.push(label + ':' + name);
  return src.replace(re, replace);
}
function iconize(src, label) {
  let n = 0;
  for (const [emo, name] of TABLE) {
    const re = new RegExp('>\\s*' + esc(emo) + '[ \\t]*', 'g');
    const hits = (src.match(re) || []).length;
    if (!hits) continue;
    n += hits;
    src = src.replace(re, '><UiIcon name="' + name + '" className="' + CLS + '" /> ');
  }
  report.push(label + ':jsx(' + n + ')');
  return src;
}

// ============ STUDIO ============
{
  const P = 'components/studio/Studio.tsx';
  const { raw, eol } = load(P);
  let s = raw;

  s = one(s, 'import', "import { CommentStudioModal } from './commentStudio';",
    "import { CommentStudioModal } from './commentStudio';" + eol + "import { UiIcon, DialogGlyph, cleanLabel } from './uiIcons';", 'Studio');

  s = one(s, 'toast-clean', 'setToasts((prev) => [...prev, { id, msg, kind }]);',
    'setToasts((prev) => [...prev, { id, msg: cleanLabel(msg), kind }]);', 'Studio');

  s = rex(s, 'toast-icon', />\s*\{t\.msg\}\s*<\/div>/,
    '><span className="flex items-center gap-2"><UiIcon name={t.kind === \'warn\' ? \'warn\' : \'info\'} className="h-4 w-4 shrink-0" /><span>{t.msg}</span></span></div>', 'Studio');

  s = one(s, 'dlg-trash', "icon: '🗑️',", "icon: 'trash',", 'Studio');
  s = one(s, 'dlg-new', "icon: '🆕',", "icon: 'new',", 'Studio');
  s = one(s, 'dlg-comment', "icon: '💬',", "icon: 'comment',", 'Studio');
  s = rex(s, 'dlg-glyph', />\s*\{confirmDialog\.icon\}\s*<\/div>/,
    '><DialogGlyph name={confirmDialog.icon} className="h-6 w-6" /></div>', 'Studio');

  // Ternarios que no pueden resolverse con ancla ">"
  s = one(s, 'lock-tern', "{linked ? '🔒' : '🔓'}",
    '{linked ? <UiIcon name="lock" className="h-3 w-3" /> : <UiIcon name="unlock" className="h-3 w-3" />}', 'Studio');
  s = one(s, 'vo-mute-tern', "{vo.muted ? ' 🔇' : ''}",
    '{vo.muted ? <UiIcon name="volumeX" className="ml-1 inline h-3 w-3 align-[-0.15em]" /> : null}', 'Studio');
  s = one(s, 'clip-mute-tern', "{c.muted && ' 🔇'}",
    '{c.muted && <UiIcon name="volumeX" className="ml-1 inline h-3 w-3 align-[-0.15em]" />}', 'Studio');
  s = one(s, 'audio-link-tern', "{linked ? ' 🔗' : track.sourceVideoId ? ' (video)' : ''}",
    '{linked ? <UiIcon name="link" className="ml-1 inline h-3 w-3 align-[-0.15em]" /> : track.sourceVideoId ? \' (video)\' : \'\'}', 'Studio');
  s = one(s, 'lane-audio-tern', "<span>{lane.muted ? '🔇' : '🔊'}</span>",
    '<UiIcon name={lane.muted ? \'volumeX\' : \'volume\'} className="h-3.5 w-3.5 shrink-0" />', 'Studio');
  s = one(s, 'lane-eye-tern', "<span>{lane.muted ? '🙈' : '👁️'}</span>",
    '<UiIcon name={lane.muted ? \'eyeOff\' : \'eye\'} className="h-3.5 w-3.5 shrink-0" />', 'Studio');
  s = one(s, 'lane-vol-tern', "{(lane.volume ?? 1) === 0 ? '🔇' : '🔊'}",
    '<UiIcon name={(lane.volume ?? 1) === 0 ? \'volumeX\' : \'volume\'} className="h-3.5 w-3.5 shrink-0" />', 'Studio');
  s = one(s, 'ctx-vol-tern', "{isMutedItem || curVol === 0 ? '🔇' : '🔊'}",
    '<UiIcon name={isMutedItem || curVol === 0 ? \'volumeX\' : \'volume\'} className="h-3.5 w-3.5 shrink-0" />', 'Studio');
  s = one(s, 'audio-mute-btn', "{selectedAudio.muted ? '🔇 Desmutear' : '🔊 Mutear'}",
    '{selectedAudio.muted ? <><UiIcon name="volumeX" className="' + CLS + '" /> Desmutear</> : <><UiIcon name="volume" className="' + CLS + '" /> Mutear</>}', 'Studio');
  s = one(s, 'vo-mute-btn', "{selectedVo.muted ? '🔇 Sin audio (click para activar)' : '🔊 Con audio'}",
    '{selectedVo.muted ? <><UiIcon name="volumeX" className="' + CLS + '" /> Sin audio (activar)</> : <><UiIcon name="volume" className="' + CLS + '" /> Con audio</>}', 'Studio');
  s = one(s, 'karaoke-box-label', "{ id: 'karaoke-box', label: '📦 Karaoke Caja' }", "{ id: 'karaoke-box', label: 'Karaoke Caja' }", 'Studio');

  s = iconize(s, 'Studio');

  // Restos en literales (toasts, titles, <option>): texto limpio, sin emoji
  const before = (s.match(EMOJI_SRC) || []).length;
  s = s.replace(EMOJI_SRC, '');
  s = s.replace(/([>'"`]) {2,}/g, '$1 ');
  report.push('Studio:literales(' + before + ')');

  fs.writeFileSync(P, s);
}

// ============ COMMENT STUDIO ============
{
  const P = 'components/studio/commentStudio.tsx';
  if (!fs.existsSync(P)) { console.log('ℹ️ commentStudio.tsx no encontrado: se omite.'); }
  else {
    const { raw, eol } = load(P);
    let s = raw;
    s = one(s, 'import', "import React, { useEffect, useRef, useState } from 'react';",
      "import React, { useEffect, useRef, useState } from 'react';" + eol + "import { UiIcon } from './uiIcons';", 'Comments');
    s = one(s, 'theme-tern', "<span>{cfg.theme === 'dark' ? '🌙' : '☀️'}</span>",
      '<UiIcon name={cfg.theme === \'dark\' ? \'moon\' : \'sun\'} className="h-3.5 w-3.5 shrink-0" />', 'Comments');
    s = one(s, 'copy-tern', "<span>{copied ? '✅' : '📋'}</span>",
      '<UiIcon name={copied ? \'check\' : \'copy\'} className="h-3.5 w-3.5 shrink-0" />', 'Comments');
    s = iconize(s, 'Comments');
    const before = (s.match(EMOJI_SRC) || []).length;
    s = s.replace(EMOJI_SRC, '');
    s = s.replace(/([>'"`]) {2,}/g, '$1 ');
    report.push('Comments:literales(' + before + ')');
    fs.writeFileSync(P, s);
  }
}

if (fails.length) {
  console.error('⚠️ Anclas que no entraron (el resto SÍ se aplicó; los .bak-icons permiten volver atrás):');
  fails.forEach((f) => console.error('   · ' + f));
  console.error('Pasame esta lista y las recalibro.');
}
console.log('✅ Migración a SVG aplicada:', report.join(' · '));
console.log('📦 Backups: Studio.tsx.bak-icons · commentStudio.tsx.bak-icons');