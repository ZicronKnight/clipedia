// aplicar-iconos-svg2.mjs — 2ª pasada: animaciones (dropdown con íconos) + export + datos
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-icons2', src);
const done = [], skipped = [];

function re(name, rx, fn, expectMin = 1) {
  const hits = (src.match(new RegExp(rx.source, 'g')) || []).length;
  if (hits < expectMin) { skipped.push(name + '(' + hits + ')'); return; }
  src = src.replace(rx, fn); done.push(name + '(' + hits + ')');
}

// 0) Import ampliado
{
  const old = "import { UiIcon, DialogGlyph, cleanLabel } from './uiIcons';";
  if (src.includes(old)) {
    src = src.replace(old, "import { UiIcon, DialogGlyph, cleanLabel, IconSelect, ANIM_ICON, TRANSITION_ICON, ASR_ICON, SUBSTYLE_ICON } from './uiIcons';");
    done.push('import');
  } else { skipped.push('import'); }
}

// 1) Los 6 <select> de animación → IconSelect con ícono por opción
re('anim-selects',
/<select value=\{(selected\w+)\.(animIn|animOut)\s*\|\|\s*'none'\}[\s\S]*?className="[^"]*"\s*>\s*\{([\s\S]*?)\.map\(\(a\)[\s\S]*?<\/select>/g,
(m, v, field, arr) => {
  const isIn = field === 'animIn';
  const upd = v === 'selectedText' ? 'updateTextOverlay' : v === 'selectedImage' ? 'updateImageOverlay' : 'updateVideoOverlay';
  const accent = v === 'selectedText' ? 'fuchsia' : v === 'selectedImage' ? 'pink' : 'amber';
  const map = isIn ? 'ANIM_IN_LABELS' : 'ANIM_OUT_LABELS';
  const type = isIn ? 'OverlayAnim' : 'OverlayAnimOut';
  return '<IconSelect value={' + v + '.' + field + " || 'none'} accent=\"" + accent + '" ariaLabel="Animación de ' + (isIn ? 'entrada' : 'salida') + '" options={(' + arr + ').map((a) => ({ id: a, label: ' + map + '[a], icon: ANIM_ICON[a] || \'dot\' }))} onChange={(nv) => ' + upd + '(' + v + '.id, { ' + field + ': nv as ' + type + ' })} />';
}, 6);

// 2) Export: botones de Calidad (ícono dentro de ternario)
re('export-calidad', /<span>\{q === 'fast'[\s\S]*?\}<\/span>/g,
() => '<UiIcon name={q === \'fast\' ? \'bolt\' : q === \'balanced\' ? \'balance\' : \'diamond\'} className="h-3.5 w-3.5 shrink-0" />');

// 3) Export: timecode de la miniatura (📸 dentro de template)
re('export-thumb-tc', /<span className="font-mono text-\[8px\][^"]*">\{[^}]*formatTime\(projectDuration \/ 2\)[^}]*\}<\/span>/g,
() => '<span className="flex items-center gap-1 font-mono text-[8px] font-black tracking-wide text-cyan-200"><UiIcon name="camera" className="h-2.5 w-2.5 shrink-0" />{formatTime(projectDuration / 2)}</span>');

// 4) Export viejo: fases de progreso con emoji en string
re('export-fases', /\{exportProgress\.phase === 'preparing'[\s\S]*?'¡Listo!'\}/g,
() => "{exportProgress.phase === 'preparing' ? 'Preparando…' : exportProgress.phase === 'rendering' ? 'Renderizando… ' + exportProgress.percent + '%' : exportProgress.phase === 'packaging' ? 'Empaquetando…' : '¡Listo!'}");

// 5) Karaoke: botones {st.label}
re('karaoke-btns', />\s*\{st\.label\}\s*</g,
() => '><UiIcon name={SUBSTYLE_ICON[st.id] || \'textLines\'} className="mr-1 inline h-3.5 w-3.5 shrink-0 align-[-0.18em]" />{st.label}<');

// 6) Picker de transiciones: {t.icon}
re('transition-icon', /\{t\.icon\}/g,
() => '{<UiIcon name={TRANSITION_ICON[t.id] || \'sparkles\'} className="h-7 w-7 text-slate-400" />}');

// 7) Modelos Whisper: {m.icon} (viven en asr.ts, no los tocó la 1ª pasada)
re('asr-icon', /\{m\.icon\}/g,
() => '{<UiIcon name={ASR_ICON[m.id] || \'mic\'} className="mr-1 inline h-3.5 w-3.5 shrink-0 align-[-0.18em]" />}');

fs.writeFileSync(PATH, src);
console.log('✅ 2ª pasada aplicada:', done.join(' · ') || '(nada)');
if (skipped.length) console.log('ℹ️ No encontrados (opcionales según tu versión):', skipped.join(' · '));
console.log('📦 Backup en:', PATH + '.bak-icons2');