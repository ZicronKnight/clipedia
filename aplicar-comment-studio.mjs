// aplicar-comment-studio.mjs — cosecha el Generador de Comentarios en Studio.tsx
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-comment', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
rep('import',
"import { computeChunkBoundaries } from './chunkedExport';",
"import { computeChunkBoundaries } from './chunkedExport';\nimport { CommentStudioModal } from './commentStudio';");
rep('state',
"const [propsTab, setPropsTab] = useState('inspector');",
"const [propsTab, setPropsTab] = useState('inspector');\nconst [commentStudioOpen, setCommentStudioOpen] = useState(false);");
rep('handler',
"async function generateSubtitles(",
"async function addCommentResult(blob: Blob) {\nconst assetId = uid();\ntry { await putAsset(assetId, blob); } catch (e) { console.error('[CommentStudio] No se pudo guardar el asset:', e); }\nconst url = URL.createObjectURL(blob);\nconst ov: ImageOverlay = { id: uid(), assetId, name: 'Comentario', url, start: playheadRef.current, end: playheadRef.current + 5, x: REF_WIDTH * 0.5, y: REF_HEIGHT * 0.5, size: 46, rotate: 0, fadeIn: 0.3, fadeOut: 0.3, laneId: activeLaneIds.image };\nsetImageOverlays((prev) => [...prev, ov]);\nsetSelectedImageId(ov.id);\nsetCommentStudioOpen(false);\nshowToast('💬 Comentario agregado a la pista de imágenes (5s, con fades)', 'info');\n}\nasync function generateSubtitles(");
rep('boton-herramientas',
"{propsTab === 'herramientas' && selectedClip && (<>",
"{propsTab === 'herramientas' && (\n<div className=\"space-y-2 rounded-lg border border-slate-700/60 bg-slate-900/40 p-2\">\n<p className=\"text-[10px] font-black uppercase tracking-wider text-slate-400\">🧰 Herramientas globales</p>\n<button onClick={() => setCommentStudioOpen(true)} className=\"w-full rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 py-2 text-sm font-semibold text-fuchsia-200 transition-colors hover:bg-fuchsia-500/20\" title=\"Creá comentarios estilo TikTok/Instagram/YouTube/Twitter y agregalos como imagen\">💬 Generador de comentarios</button>\n</div>\n)}\n{propsTab === 'herramientas' && selectedClip && (<>");
rep('portal-const',
"const transitionPickerUI = transitionPicker !== null && clips[transitionPicker] ? createPortal(",
"const commentStudioUI = commentStudioOpen && typeof document !== 'undefined' ? createPortal(\n<CommentStudioModal\nonCancel={() => setCommentStudioOpen(false)}\nonDownload={(blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 4000); showToast('⬇️ Comentario descargado como PNG', 'info'); }}\nonInsert={(blob) => addCommentResult(blob)}\n/>,\ndocument.body\n) : null;\nconst transitionPickerUI = transitionPicker !== null && clips[transitionPicker] ? createPortal(");
rep('portal-render',
"{transitionPickerUI}",
"{commentStudioUI}\n{transitionPickerUI}");
fs.writeFileSync(PATH, src);
console.log('✅ Comment Studio cosechado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-comment');