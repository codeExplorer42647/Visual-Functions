// Main App — routing between modules

const MODULES = [
  { id: 'surfaces', label: 'Surfaces', num: '01', Component: SurfacesModule },
  { id: 'gradient', label: 'Gradient', num: '02', Component: GradientModule },
  { id: 'field',    label: 'Champ vecteur', num: '03', Component: VectorFieldModule },
  { id: 'extrema',  label: 'Extrema', num: '04', Component: ExtremaModule },
  { id: 'lagrange', label: 'Lagrange', num: '05', Component: LagrangeModule },
  { id: 'integral', label: 'Int. double', num: '06', Component: DoubleIntegralModule },
  { id: 'curve',    label: 'Courbes', num: '07', Component: ParamCurveModule },
  { id: 'ode',      label: 'EDO', num: '08', Component: ODEModule },
];

function App() {
  const [current, setCurrent] = useState(() => {
    try { return localStorage.getItem('va_module') || 'surfaces'; } catch { return 'surfaces'; }
  });

  useEffect(() => {
    try { localStorage.setItem('va_module', current); } catch {}
  }, [current]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const idx = MODULES.findIndex(m => m.id === current);
        const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + MODULES.length) % MODULES.length;
        setCurrent(MODULES[next].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current]);

  const mod = MODULES.find(m => m.id === current) || MODULES[0];
  const C = mod.Component;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          analyse vectorielle <small>atelier visuel</small>
        </div>
        <div className="meta">
          <span>MATH-105 · multivariable</span>
          <span>clic sur le canvas pour interagir</span>
          <span><kbd>←</kbd><kbd>→</kbd> modules</span>
        </div>
      </header>
      <nav className="rail">
        <div className="group-label">modules</div>
        {MODULES.map(m => (
          <div key={m.id}
               className={`mod ${m.id === current ? 'active' : ''}`}
               onClick={() => setCurrent(m.id)}>
            <span className="num">{m.num}</span>
            <span>{m.label}</span>
          </div>
        ))}
        <div className="group-label" style={{marginTop: 30}}>aide</div>
        <div style={{padding: '6px 18px', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.6}}>
          fonctions<br/>
          <span style={{color: 'var(--ink-soft)'}}>sin, cos, tan, exp, ln, sqrt, abs, pow, atan2…</span>
        </div>
        <div style={{padding: '6px 18px', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.6}}>
          constantes<br/>
          <span style={{color: 'var(--ink-soft)'}}>pi, e, tau</span>
        </div>
        <div style={{padding: '6px 18px', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)', lineHeight: 1.6}}>
          opérateurs<br/>
          <span style={{color: 'var(--ink-soft)'}}>+ − * / ^</span>
        </div>
      </nav>
      <C key={current} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
document.getElementById('loading').style.display = 'none';
