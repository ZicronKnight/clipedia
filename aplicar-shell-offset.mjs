// aplicar-shell-offset.mjs — el shell móvil descuenta el header real de la página
import fs from 'node:fs';
const PATH = 'components/studio/Studio.tsx';
let src = fs.readFileSync(PATH, 'utf8');
fs.writeFileSync(PATH + '.bak-offset', src);
const ops = [];
function rep(name, search, replace) {
  const count = src.split(search).length - 1;
  if (count !== 1) { console.error('❌ [' + name + '] ancla encontrada ' + count + ' veces (esperaba 1). NO se tocó el archivo.'); process.exit(1); }
  src = src.replace(search, replace);
  ops.push(name);
}
// 1) State + ref del offset del shell
rep('offset-state',
'const [proxyVersion, setProxyVersion] = useState(0);',
'const [proxyVersion, setProxyVersion] = useState(0);\nconst [shellOffset, setShellOffset] = useState(0);\nconst shellRef = useRef<HTMLDivElement>(null);');
// 2) Efecto que mide el header (logo + banner) y lo descuenta del alto visible
rep('offset-effect',
'useEffect(() => { setProxiesOn(proxiesEnabled); }, []);',
'useEffect(() => { setProxiesOn(proxiesEnabled); }, []);\n// ===== SHELL MÓVIL: descontar el header real (logo + banner) del alto visible =====\nuseEffect(() => {\nconst el = shellRef.current;\nif (!el) return;\nconst compute = () => setShellOffset(Math.max(0, el.offsetTop));\ncompute();\nwindow.addEventListener(\'resize\', compute);\nwindow.addEventListener(\'orientationchange\', compute);\nreturn () => { window.removeEventListener(\'resize\', compute); window.removeEventListener(\'orientationchange\', compute); };\n}, []);');
// 3) La raíz usa la variable: 100dvh menos el header medido
rep('offset-root',
'<div className="flex h-[100vh] flex-col gap-2 overflow-hidden p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] supports-[height:100dvh]:h-[100dvh] lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:p-4 lg:pb-4" onDragEnter={onDragEnter}',
'<div ref={shellRef} style={{ \'--shelloff\': shellOffset + \'px\' } as React.CSSProperties} className="flex h-[calc(100vh-var(--shelloff,0px))] flex-col gap-2 overflow-hidden p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] supports-[height:100dvh]:h-[calc(100dvh-var(--shelloff,0px))] lg:h-[calc(100dvh-57px)] lg:min-h-[620px] lg:gap-4 lg:p-4 lg:pb-4" onDragEnter={onDragEnter}');
fs.writeFileSync(PATH, src);
console.log('✅ Shell offset aplicado (' + ops.length + '):', ops.join(', '));
console.log('📦 Backup en:', PATH + '.bak-offset');