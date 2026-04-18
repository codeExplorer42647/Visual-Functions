// Module: EDO y' = f(x, y) — champ de pentes, trajectoires (Euler + RK4)

function ODEModule() {
  const [expr, setExpr] = useState('y - x^2 + 1');
  const [compiled, setCompiled] = useState(() => safeCompile('y - x^2 + 1'));
  const [range, setRange] = useState(4);
  const [yrange, setYrange] = useState(3);
  const [ic, setIc] = useState({ x: -1, y: 0.5 });
  const [method, setMethod] = useState('rk4');
  const [step, setStep] = useState(0.1);
  const [clicks, setClicks] = useState([{ x: -1, y: 0.5 }]);

  useEffect(() => { const r = safeCompile(expr); if (r.ok) setCompiled(r); }, [expr]);

  const trajectories = useMemo(() => {
    if (!compiled.ok) return [];
    const f = compiled.fn;
    return clicks.map((start) => {
      const fwd = [], bwd = [];
      let x = start.x, y = start.y;
      for (let i = 0; i < 400; i++) {
        fwd.push({ x, y });
        if (x > range) break;
        if (method === 'euler') {
          const k = f({ x, y });
          y = y + step * k; x = x + step;
        } else {
          const k1 = f({ x, y });
          const k2 = f({ x: x + step/2, y: y + step/2 * k1 });
          const k3 = f({ x: x + step/2, y: y + step/2 * k2 });
          const k4 = f({ x: x + step,   y: y + step * k3 });
          y = y + (step/6) * (k1 + 2*k2 + 2*k3 + k4);
          x = x + step;
        }
        if (Math.abs(y) > yrange * 5) break;
      }
      x = start.x; y = start.y;
      for (let i = 0; i < 400; i++) {
        bwd.push({ x, y });
        if (x < -range) break;
        if (method === 'euler') {
          const k = f({ x, y });
          y = y - step * k; x = x - step;
        } else {
          const k1 = f({ x, y });
          const k2 = f({ x: x - step/2, y: y - step/2 * k1 });
          const k3 = f({ x: x - step/2, y: y - step/2 * k2 });
          const k4 = f({ x: x - step,   y: y - step * k3 });
          y = y - (step/6) * (k1 + 2*k2 + 2*k3 + k4);
          x = x - step;
        }
        if (Math.abs(y) > yrange * 5) break;
      }
      return [...bwd.reverse(), ...fwd];
    });
  }, [compiled, clicks, method, step, range, yrange]);

  const ref = useCanvas((ctx, w, h) => {
    const mapW = w - 120, mapH = h - 100;
    const x0 = 60, y0 = 50;
    const toPx = (x, y) => [x0 + ((x + range)/(2*range)) * mapW, y0 + mapH - ((y + yrange)/(2*yrange)) * mapH];

    // grid
    ctx.strokeStyle = '#1c1b17'; ctx.lineWidth = 0.5;
    for (let i = 0; i <= 16; i++) {
      ctx.beginPath();
      ctx.moveTo(x0 + i/16 * mapW, y0);
      ctx.lineTo(x0 + i/16 * mapW, y0 + mapH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0, y0 + i/16 * mapH);
      ctx.lineTo(x0 + mapW, y0 + i/16 * mapH);
      ctx.stroke();
    }
    ctx.strokeStyle = '#2a2824'; ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, mapW, mapH);

    // axes
    ctx.strokeStyle = '#3a372f';
    if (-yrange <= 0 && yrange >= 0) {
      const [, py] = toPx(0, 0); ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x0 + mapW, py); ctx.stroke();
    }
    if (-range <= 0 && range >= 0) {
      const [px] = toPx(0, 0); ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 + mapH); ctx.stroke();
    }
    ctx.fillStyle = '#5a564c';
    ctx.font = '9.5px "JetBrains Mono", monospace';
    for (let i = 0; i <= 4; i++) {
      ctx.fillText((-range + 2*range*i/4).toFixed(1), x0 + i/4 * mapW - 8, y0 + mapH + 14);
      ctx.fillText((yrange - 2*yrange*i/4).toFixed(1), 20, y0 + i/4 * mapH + 4);
    }

    // slope field
    if (compiled.ok) {
      const nx = 26, ny = 18;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const x = -range + (2*range)*((i+0.5)/nx);
        const y = -yrange + (2*yrange)*((j+0.5)/ny);
        const s = compiled.fn({ x, y });
        if (!isFinite(s)) continue;
        const [px, py] = toPx(x, y);
        const L = Math.min(mapW/nx, mapH/ny) * 0.42;
        const angle = Math.atan(s);
        const dx = Math.cos(angle) * L, dy = Math.sin(angle) * L;
        const mag = Math.min(1, Math.abs(s) / 5);
        ctx.strokeStyle = `oklch(${0.6 + 0.15*mag} 0.1 ${200 - 120*mag})`;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px - dx, py + dy); ctx.lineTo(px + dx, py - dy); ctx.stroke();
      }
    }

    // trajectories
    trajectories.forEach((traj, k) => {
      ctx.strokeStyle = 'oklch(0.78 0.14 80)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < traj.length; i++) {
        const [px, py] = toPx(traj[i].x, traj[i].y);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // IC dot
      const start = clicks[k];
      const [sx, sy] = toPx(start.x, start.y);
      ctx.fillStyle = '#0e0e0c';
      ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'oklch(0.78 0.14 80)';
      ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI*2); ctx.fill();
    });

    ctx.fillStyle = '#5a564c';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`y' = ${expr}`, 16, h - 16);
    ctx.textAlign = 'right';
    ctx.fillText('cliquer pour ajouter une condition initiale · shift+clic pour réinitialiser', w - 16, h - 16);
    ctx.textAlign = 'left';
  }, [compiled, range, yrange, trajectories, clicks]);

  const onCanvasClick = (e) => {
    const el = e.currentTarget.querySelector('canvas');
    const rect = el.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const mapW = w - 120, mapH = h - 100;
    const x0 = 60, y0 = 50;
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    if (cx < x0 || cx > x0 + mapW || cy < y0 || cy > y0 + mapH) return;
    const xn = (cx - x0) / mapW, yn = 1 - (cy - y0) / mapH;
    const newIC = { x: -range + 2*range*xn, y: -yrange + 2*yrange*yn };
    if (e.shiftKey) setClicks([newIC]);
    else setClicks(c => [...c, newIC]);
    setIc(newIC);
  };

  return (
    <>
      <div className="canvas-wrap" onClick={onCanvasClick} style={{ cursor: 'crosshair' }}>
        <canvas ref={ref} />
        <div className="hud tl">
          <span className="big">EDO y' = f(x, y)</span>
          champ de pentes · trajectoires intégrées depuis chaque clic
        </div>
        <div className="hud tr">
          <span>méthode : <span style={{color:'oklch(0.78 0.14 80)'}}>{method === 'rk4' ? 'Runge–Kutta 4' : 'Euler explicite'}</span></span><br/>
          <span>h = {step.toFixed(2)} · {clicks.length} trajectoire(s)</span>
        </div>
      </div>

      <aside className="inspector">
        <h3>EDO du 1er ordre</h3>
        <div className="subtitle">Module 08 · y' = f(x, y)</div>

        <section>
          <SectionLabel>Expression</SectionLabel>
          <ExprInput label="y' =" value={expr} onChange={setExpr} error={!compiled.ok} />
          <Chips items={['y - x^2 + 1', '-y + sin(x)', 'x*y', 'y*(1-y)', 'x - y', 'sin(x)*y', 'y^2 - x', '-x/y']} onPick={setExpr} />
        </section>

        <section>
          <SectionLabel>Méthode</SectionLabel>
          <ToggleGroup value={method} onChange={setMethod} options={[
            { value: 'euler', label: 'Euler' },
            { value: 'rk4', label: 'RK4' },
          ]}/>
          <div style={{ marginTop: 10 }}>
            <Slider label="pas h" min={0.01} max={0.5} step={0.01} value={step} onChange={setStep} />
          </div>
        </section>

        <section>
          <SectionLabel aux={clicks.length + ' CI'}>Conditions initiales</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
            {clicks.map((c, i) => (
              <div key={i} style={{
                padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
                background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 3,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>y({fmt(c.x,2)}) = {fmt(c.y,2)}</span>
                <span style={{ color: 'var(--muted)', cursor: 'pointer' }}
                  onClick={() => setClicks(list => list.filter((_, j) => j !== i))}>×</span>
              </div>
            ))}
          </div>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => setClicks([])}>tout effacer</button>
        </section>

        <section>
          <SectionLabel>Fenêtre</SectionLabel>
          <Slider label="x ±" min={2} max={10} step={0.5} value={range} onChange={setRange} fmtVal={(v) => `±${v}`}/>
          <Slider label="y ±" min={1} max={10} step={0.5} value={yrange} onChange={setYrange} fmtVal={(v) => `±${v}`}/>
        </section>

        <section>
          <Intuition>
            Le <em>champ de pentes</em> trace en chaque point (x, y) un petit segment de pente y' = f(x, y). Les solutions sont les courbes qui suivent ces pentes — une par condition initiale. RK4 reste précis avec un pas bien plus grand qu'Euler.
          </Intuition>
        </section>

        <section>
          <DefBox label="schémas numériques">
            <span style={{ color: 'var(--muted)' }}>Euler :</span><br/>
            <span className="math">y<sub>n+1</sub> = y<sub>n</sub> + h · f(x<sub>n</sub>, y<sub>n</sub>)</span><br/><br/>
            <span style={{ color: 'var(--muted)' }}>RK4 :</span><br/>
            <span className="math">y<sub>n+1</sub> = y<sub>n</sub> + h/6 · (k₁ + 2k₂ + 2k₃ + k₄)</span>
          </DefBox>
        </section>
      </aside>
    </>
  );
}

Object.assign(window, { ODEModule });
