// aplicar-anim-picker.mjs — selects de animación → AnimPicker con íconos SVG animados
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
if (!fs.existsSync('components/studio/AnimPicker.tsx')) {
  console.error('❌ Falta components/studio/AnimPicker.tsx. Crealo primero (Pieza 1). NO se tocó nada.');
  process.exit(1);
}
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-animpicker', src);
const ops = [];

const IMP = "import { CommentStudioModal } from './commentStudio';";
if (src.split(IMP).length - 1 !== 1) { console.error('❌ [import] ancla no única. NO se tocó nada.'); process.exit(1); }
if (!src.includes("from './AnimPicker'")) {
  src = src.replace(IMP, IMP + "\nimport { AnimPicker } from './AnimPicker';");
  ops.push('import');
} else ops.push('import-ya-existia');

const IN_TEXT = src.includes('TEXT_ANIM_IN_KEYS') ? 'TEXT_ANIM_IN_KEYS' : '(Object.keys(ANIM_IN_LABELS) as OverlayAnim[])';
const OUT_TEXT = src.includes('TEXT_ANIM_OUT_KEYS') ? 'TEXT_ANIM_OUT_KEYS' : '(Object.keys(ANIM_OUT_LABELS) as OverlayAnimOut[])';
const IN_MEDIA = src.includes('MEDIA_ANIM_IN_KEYS') ? 'MEDIA_ANIM_IN_KEYS' : '(Object.keys(ANIM_IN_LABELS) as OverlayAnim[]).filter((k) => k !== "typewriter")';
const OUT_MEDIA = src.includes('MEDIA_ANIM_OUT_KEYS') ? 'MEDIA_ANIM_OUT_KEYS' : '(Object.keys(ANIM_OUT_LABELS) as OverlayAnimOut[])';

const JOBS = [
  ['texto-entrada', /<select\s+value=\{selectedText\.animIn[\s\S]*?<\/select>/,
    `<AnimPicker value={selectedText.animIn || 'none'} options={${IN_TEXT}} labels={ANIM_IN_LABELS} direction="in" accent="fuchsia" onChange={(v) => updateTextOverlay(selectedText.id, { animIn: v as OverlayAnim })} />`],
  ['texto-salida', /<select\s+value=\{selectedText\.animOut[\s\S]*?<\/select>/,
    `<AnimPicker value={selectedText.animOut || 'none'} options={${OUT_TEXT}} labels={ANIM_OUT_LABELS} direction="out" accent="fuchsia" onChange={(v) => updateTextOverlay(selectedText.id, { animOut: v as OverlayAnimOut })} />`],
  ['imagen-entrada', /<select\s+value=\{selectedImage\.animIn[\s\S]*?<\/select>/,
    `<AnimPicker value={selectedImage.animIn || 'none'} options={${IN_MEDIA}} labels={ANIM_IN_LABELS} direction="in" accent="pink" onChange={(v) => updateImageOverlay(selectedImage.id, { animIn: v as OverlayAnim })} />`],
  ['imagen-salida', /<select\s+value=\{selectedImage\.animOut[\s\S]*?<\/select>/,
    `<AnimPicker value={selectedImage.animOut || 'none'} options={${OUT_MEDIA}} labels={ANIM_OUT_LABELS} direction="out" accent="pink" onChange={(v) => updateImageOverlay(selectedImage.id, { animOut: v as OverlayAnimOut })} />`],
  ['capa-entrada', /<select\s+value=\{selectedVo\.animIn[\s\S]*?<\/select>/,
    `<AnimPicker value={selectedVo.animIn || 'none'} options={${IN_MEDIA}} labels={ANIM_IN_LABELS} direction="in" accent="amber" onChange={(v) => updateVideoOverlay(selectedVo.id, { animIn: v as OverlayAnim })} />`],
  ['capa-salida', /<select\s+value=\{selectedVo\.animOut[\s\S]*?<\/select>/,
    `<AnimPicker value={selectedVo.animOut || 'none'} options={${OUT_MEDIA}} labels={ANIM_OUT_LABELS} direction="out" accent="amber" onChange={(v) => updateVideoOverlay(selectedVo.id, { animOut: v as OverlayAnimOut })} />`],
];

const fails = [];
for (const [name, re, repl] of JOBS) {
  const n = (src.match(new RegExp(re.source, 'g')) || []).length;
  if (n !== 1) { fails.push(name + ' (' + n + ')'); continue; }
  src = src.replace(re, repl);
  ops.push(name);
}
if (fails.length) {
  console.error('❌ NO se tocó el archivo. Anclas que fallaron: ' + fails.join(', '));
  process.exit(1);
}
fs.writeFileSync(PATH, src);
console.log('✅ AnimPicker instalado:', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-animpicker');