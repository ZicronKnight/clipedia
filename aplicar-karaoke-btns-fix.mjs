// aplicar-karaoke-btns-fix.mjs — botones de modo Karaoke: flex, altura pareja, sin saltos de línea
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-karaokebtns', src);

const mark = src.indexOf("{ id: 'static', label:");
if (mark < 0) { console.error('❌ No encontré el array de modos de subtítulo. NO se tocó nada.'); process.exit(1); }
const open = src.lastIndexOf('{([', mark);
const btnClose = src.indexOf('</button', mark);
if (open < 0 || btnClose < 0) { console.error('❌ No pude delimitar el bloque de botones. NO se tocó nada.'); process.exit(1); }
const close = src.indexOf('})}', btnClose);
if (close < 0) { console.error('❌ No encontré el cierre del map. NO se tocó nada.'); process.exit(1); }
const end = close + 3;

const HAS_UI = /from '\.\/uiIcons'/.test(src) && src.includes('SUBSTYLE_ICON');
const ICON = HAS_UI
  ? '<UiIcon name={SUBSTYLE_ICON[st.id] || \'textLines\'} className="h-3 w-3 shrink-0" />\n'
  : '';

const BLOCK = `{([
{ id: 'static', label: 'Estático', hint: 'Subtítulo completo, sin resaltado por palabra' },
{ id: 'karaoke-color', label: 'Karaoke Color', hint: 'La palabra activa cambia al color de acento' },
{ id: 'karaoke-box', label: 'Karaoke Caja', hint: 'La palabra activa se resalta en una pastilla de color' },
{ id: 'single-word', label: '1 Palabra', hint: 'Una sola palabra a la vez, en grande' },
] as { id: SubtitleStyle; label: string; hint: string }[]).map((st) => {
const cur = selectedText.subStyle || 'static';
const on = cur === st.id;
return (
<button key={st.id} type="button" title={st.hint} onClick={() => updateTextOverlay(selectedText.id, { subStyle: st.id, highlightColor: selectedText.highlightColor || '#facc15' })}
className={cx('flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg border px-1.5 text-[10px] font-bold leading-none transition', on ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600')}>
${ICON}<span className="truncate">{st.label}</span>
</button>
);
})}`;

src = src.slice(0, open) + BLOCK + src.slice(end);
fs.writeFileSync(PATH, src);
console.log('✅ Botones de Karaoke arreglados: flex centrado, h-8 parejo, ícono alineado y label en una línea.');
console.log('📦 Backup en:', PATH + '.bak-karaokebtns');