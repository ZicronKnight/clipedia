// aplicar-color-manual.mjs — sliders de brillo/contraste/saturación/tono/blur en la pestaña Estilo
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-color', src);
const ops = [];
const L = (...lines) => lines.join('\n');
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) Campo adjust en el tipo Clip
rep('type-adjust',
"filter?: FilterType;\ntransition?: { type: TransitionType; duration: number };",
"filter?: FilterType;\nadjust?: FilterSpec;\ntransition?: { type: TransitionType; duration: number };");
// 2) Helper de spec efectivo (preset + manual), fuente única de verdad
rep('effspec',
"FILTERS.forEach((f) => { FILTER_MAP[f.id] = f.spec; });",
"FILTERS.forEach((f) => { FILTER_MAP[f.id] = f.spec; });\n// Spec efectivo = preset + ajustes manuales. UNA sola fuente para preview y export.\nfunction effSpec(c: Clip): FilterSpec { return { ...(FILTER_MAP[c.filter || 'none'] || {}), ...(c.adjust || {}) }; }");
// 3) Preview: clipCssFilter usa effSpec
rep('css-filter',
L("const sp = c?.filter ? FILTER_MAP[c.filter] : undefined;",
"if (!sp) return undefined;",
"const css = specToCss(sp, stageScale);"),
L("if (!c) return undefined;",
"const sp = effSpec(c);",
"const css = specToCss(sp, stageScale);"));
// 4) Preview DOM directo: applyClipVisualsToDom usa effSpec
rep('dom-filter',
L("const sp = clip.filter ? FILTER_MAP[clip.filter] : undefined;",
"const cssFilter = sp ? specToCss(sp, scale) : 'none';"),
L("const sp = effSpec(clip);",
"const cssFilter = specToCss(sp, scale);"));
// 5) Snippets de transición: paridad de filtros en el preview real
rep('snippet-filters',
L("const fA = specToFF(FILTER_MAP[a.filter || 'none'] || {});",
"const fB = specToFF(FILTER_MAP[b.filter || 'none'] || {});"),
L("const fA = specToFF(effSpec(a));",
"const fB = specToFF(effSpec(b));"));
// 6+7) Cache key de transiciones: que un slider invalide el snippet
rep('cachekey-a',
"a.fadeOut.toFixed(1), a.filter || 'none',",
"a.fadeOut.toFixed(1), a.filter || 'none', a.adjust ? JSON.stringify(a.adjust) : '-',");
rep('cachekey-b',
"b.fadeIn.toFixed(1), b.filter || 'none',",
"b.fadeIn.toFixed(1), b.filter || 'none', b.adjust ? JSON.stringify(b.adjust) : '-',");
// 8) Export clásico
rep('export-classic',
"const fFF = specToFF(FILTER_MAP[c.filter || 'none'] || {});",
"const fFF = specToFF(effSpec(c));");
// 9) Export chunked
rep('export-chunked',
"const fFF = specToFF(FILTER_MAP[clip.filter || 'none'] || {});",
"const fFF = specToFF(effSpec(clip));");
// 10) Sliders en la pestaña Estilo del panel
rep('ui-sliders',
"<p className=\"text-[11px] leading-relaxed text-slate-500\">{FILTERS.find((f) => f.id === (selectedClip.filter || 'none'))?.desc}</p>",
"<p className=\"text-[11px] leading-relaxed text-slate-500\">{FILTERS.find((f) => f.id === (selectedClip.filter || 'none'))?.desc}</p>" + `
<p className="pt-1 text-[10px] font-black uppercase tracking-wider text-cyan-300">Ajustes manuales</p>
<label className="block select-none text-xs text-slate-400">☀️ Brillo: {Math.round((effSpec(selectedClip).b ?? 1) * 100)}%<input type="range" min={0.5} max={1.5} step={0.05} value={effSpec(selectedClip).b ?? 1} onChange={(e) => updateClip(selectedClip.id, { adjust: { ...(selectedClip.adjust || {}), b: Number(e.target.value) } })} className="mt-1 w-full accent-cyan-400" /></label>
<label className="block select-none text-xs text-slate-400">🎚 Contraste: {Math.round((effSpec(selectedClip).c ?? 1) * 100)}%<input type="range" min={0.5} max={1.5} step={0.05} value={effSpec(selectedClip).c ?? 1} onChange={(e) => updateClip(selectedClip.id, { adjust: { ...(selectedClip.adjust || {}), c: Number(e.target.value) } })} className="mt-1 w-full accent-cyan-400" /></label>
<label className="block select-none text-xs text-slate-400">🎨 Saturación: {Math.round((effSpec(selectedClip).s ?? 1) * 100)}%<input type="range" min={0} max={2} step={0.05} value={effSpec(selectedClip).s ?? 1} onChange={(e) => updateClip(selectedClip.id, { adjust: { ...(selectedClip.adjust || {}), s: Number(e.target.value) } })} className="mt-1 w-full accent-cyan-400" /></label>
<label className="block select-none text-xs text-slate-400">🌈 Tono: {Math.round(effSpec(selectedClip).h ?? 0)}°<input type="range" min={-180} max={180} step={5} value={effSpec(selectedClip).h ?? 0} onChange={(e) => updateClip(selectedClip.id, { adjust: { ...(selectedClip.adjust || {}), h: Number(e.target.value) } })} className="mt-1 w-full accent-cyan-400" /></label>
<label className="block select-none text-xs text-slate-400">💧 Desenfoque: {(effSpec(selectedClip).blur ?? 0).toFixed(1)}px<input type="range" min={0} max={10} step={0.5} value={effSpec(selectedClip).blur ?? 0} onChange={(e) => updateClip(selectedClip.id, { adjust: { ...(selectedClip.adjust || {}), blur: Number(e.target.value) } })} className="mt-1 w-full accent-cyan-400" /></label>
<button onClick={() => updateClip(selectedClip.id, { adjust: {} })} className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400 hover:text-cyan-400" title="Vuelve al preset elegido sin ajustes manuales">↺ Resetear ajustes manuales</button>`);
fs.writeFileSync(PATH, src);
console.log('✅ Color manual aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-color');