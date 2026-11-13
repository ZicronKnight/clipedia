// aplicar-vision-fix.mjs — poda de contradicciones del VISION.md (por líneas, inmune a CRLF)
import fs from 'node:fs';

const CANDIDATES = ['VISION.md', 'Vision.md', 'vision.md', 'Vision 13-11-2026.md', 'docs/VISION.md'];
let PATH = CANDIDATES.find((p) => fs.existsSync(p));
if (!PATH) {
  const found = fs.readdirSync('.').filter((f) => /\.md$/i.test(f) && /vision/i.test(f));
  if (found.length) PATH = found[0];
}
if (!PATH) { console.error('❌ No encontré el VISION.md. Decime el nombre exacto del archivo.'); process.exit(1); }

const raw = fs.readFileSync(PATH, 'utf8');
const EOL = raw.includes('\r\n') ? '\r\n' : '\n';
let lines = raw.split(/\r?\n/);
const fails = [];
const done = [];

const idxOf = (frag) => lines.findIndex((l) => l.includes(frag));
function swapBlock(name, startFrag, endFrag, newLines) {
  const s = idxOf(startFrag);
  if (s < 0) { fails.push(name + ' (no encontré: "' + startFrag + '")'); return; }
  const e = lines.findIndex((l, i) => i >= s && l.includes(endFrag));
  if (e < 0) { fails.push(name + ' (no encontré el cierre: "' + endFrag + '")'); return; }
  lines.splice(s, e - s + 1, ...newLines);
  done.push(name);
}
function dropLine(name, frag) {
  const i = idxOf(frag);
  if (i < 0) { fails.push(name + ' (no encontré: "' + frag + '")'); return; }
  lines.splice(i, 1);
  done.push(name);
}

// 1) Fecha del encabezado al día
{
  const i = idxOf('28 de octubre de 2026');
  if (i < 0) fails.push('fecha');
  else { lines[i] = lines[i].replace('28 de octubre de 2026', '13 de noviembre de 2026'); done.push('fecha'); }
}

// 2) Limitación resuelta: sombra/contorno de texto en export
dropLine('limitacion-sombra', 'sin sombra');

// 3) Limitación resuelta: deriva por transiciones (geometría canónica 29/10)
swapBlock('limitacion-deriva', 'Con transiciones activas', 'canónica también', []);

// 4) Roadmap: lo que ya está hecho no puede seguir diciendo PENDIENTE
swapBlock('roadmap-pendiente', 'PENDIENTE de Fase', 'emojis de Propiedades', [
  'CERRADO desde Fase 6: sombra/contorno de texto en export (borderw + 6 capas gaussianas),',
  'geometría canónica de timeline con transiciones (29/10) y snap magnético con',
  'anti-colisión (resolveMagneticSlot / getSiblingsIntervals).',
  'Studio Fases 6.2 → 6.16: COMPLETAS → byte-ranges, export chunked con ventanas protegidas,',
  'audio continuo, z-order por timeline, animaciones con paridad, color grading manual,',
  'chroma key 1:1, subtítulos karaoke, silencios con VAD híbrido, Estudio de Comentarios,',
  'portapapeles + menú contextual, cabina de propiedades con pestañas y shell responsive.',
  'PENDIENTE real: zoom de texto v2 (refactor ASS), pulido estético de waveform,',
  'edición a dos paneles en paisaje, emojis de Propiedades → SVG.',
]);

// 5) Tareas inmediatas: la geometría ya está unificada
swapBlock('tarea-geometria', 'unificar geometría de timeline', 'deriva preview', []);

// 6) Pulidos opcionales: solo lo que sigue pendiente de verdad
swapBlock('pulidos', 'Pulidos opcionales de Studio', 'atajos de teclado', [
  'Pulidos opcionales de Studio: emojis del panel Propiedades → SVG, indicador de',
  'autoguardado + nombre de proyecto editable, limpieza de proxies huérfanos,',
  'persistencia de filmstrips, atajos de teclado (panel `?`), zoom de texto v2 (ASS),',
  'pulido estético de waveform y edición a dos paneles en paisaje.',
]);

// 7) Studio.tsx: tamaño y alcance reales de hoy
swapBlock('studio-desc', 'el editor completo (', 'barra de progreso honesta', [
  ' `components/studio/Studio.tsx`  → el editor completo (~5000 líneas, componente único):',
  'timeline multipista por familias (SUB/T/I/V/A) con z-order estilo Vegas, imán',
  'anti-colisión y arrastre con elevación física; preview con canvas de referencia,',
  'capa de transiciones y chroma key en canvas 2D; panel de propiedades con pestañas',
  '(Inspector · Estilo · Animación · Subtítulos · Herramientas); transporte con play',
  'insignia Corel; modal de export PRO con claqueta y captura real del punto medio;',
  'undo/redo, autosave, portapapeles interno y menú contextual; transiciones con proxy',
  'render, zoom y pinch de timeline, proxies 480p persistidos, filmstrips, subtítulos',
  'Whisper con karaoke, recorte de silencios, color grading manual, animaciones de',
  'entrada/salida, sombra esfumada, export clásico y chunked por byte-ranges,',
  'shell responsive con fullscreen y modo visión en paisaje, barra de progreso honesta.',
]);

// 8) Módulos que faltaban en el inventario
{
  const i = idxOf('Nada sale del navegador');
  if (i < 0) fails.push('modulos-nuevos');
  else {
    lines.splice(i + 1, 0,
      ' `components/studio/commentStudio.tsx`  → Estudio de Comentarios: motor HTML → SVG',
      'foreignObject → canvas → PNG (sin librerías), 7 variantes calibradas de TikTok /',
      'Instagram / YouTube / X, identidad al azar, avatar por dataURL, liked/rounded/verified,',
      'descarga PNG, copia al portapapeles e inserción directa a la pista de imágenes.',
      ' `components/studio/asr.ts`  → Whisper local: catálogo de modelos (peso/estrellas/',
      'estimación por dispositivo), idiomas, caché de descargados, decodeSegment16k,',
      'transcribeSegment y groupWordsIntoCaptions. Ningún audio sale del navegador.',
      ' `components/studio/segmentExtractor.ts`  → extractor por byte-ranges: parsea el moov',
      'por sondas, pide solo los samples de la ventana vía Blob.slice() y remuxa a Annex-B',
      'H.264 (extractSegment) o a MP4 con ASC real (extractAudioSegment). RAM = la ventana.',
      ' `components/studio/chunkedExport.ts`  → computeChunkBoundaries: parte la timeline en',
      'chunks con bordes en grilla de frame y ventanas protegidas (nunca corta un xfade).',
      ' `public/claqueta-export.svg`  → claqueta oficial de CorelDRAW del modal de export.',
      'Asset estático llamado por <img>: el SVG de Corel (CDATA, class=, xlink:href) es',
      'válido como archivo pero inválido como JSX; así funciona intacto y no engorda Studio.'
    );
    done.push('modulos-nuevos');
  }
}

// 9) Límites honestos de hoy (los que sí siguen vigentes)
{
  const i = idxOf('Primer export descarga el core de FFmpeg');
  if (i < 0) fails.push('limites-nuevos');
  else {
    lines.splice(i + 1, 0,
      'Zoom de texto: drawtext no anima fontsize por frame → el zoom de subtítulos/texto',
      'queda para el refactor ASS ("texto como capa transparente").',
      'Export chunked: las capas de video (VO) se escriben residentes en MEMFS (una capa',
      'de varios GB no entraría) y la ventana de audio por byte-ranges tope 10 min por clip.',
      'Edición en paisaje de celular = modo visión (mirar y scrubear); editar con panel',
      'completo es en vertical o en fullscreen.'
    );
    done.push('limites-nuevos');
  }
}

if (fails.length) {
  console.error('❌ NO se tocó el archivo. Anclas que fallaron:');
  fails.forEach((f) => console.error('   · ' + f));
  console.error('Pasame esa lista y recalibro los anclas.');
  process.exit(1);
}

fs.writeFileSync(PATH + '.bak-visionfix', raw);
fs.writeFileSync(PATH, lines.join(EOL));
console.log('✅ VISION podado (' + done.length + ' ops):', done.join(', '));
console.log('📄 Archivo:', PATH);
console.log('📦 Backup en:', PATH + '.bak-visionfix');