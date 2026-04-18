// Module: Champ de vecteurs 2D (F = (P, Q)) avec divergence, rotationnel, particules animées

function VectorFieldModule() {
  const [exprP, setExprP] = useState('-y');
  const [exprQ, setExprQ] = useState('x');
  const [cP, setCP] = useState(() => safeCompile('-y'));
  const [cQ, setCQ] = useState(() => safeCompile('x'));
  const [range, setRange] = useState(3);
  const [showDiv, setShowDiv] = useState(true);
  const [animate, setAnimate] = useState(true);
  const [probe, setProbe] = useState({ x: 1, y: 0.5 });

  useEffect(() => { const r = safeCompile(exprP); if (r.ok) setCP(r); }, [exprP]);
  useEffect(() => { const r = safeCompile(exprQ); if (r.ok) setCQ(r); }, [exprQ]);

  // divergence heatmap cache — recompute only when P, Q, or range changes
  const divCacheRef = useRef(null);
  useEffect(() => {
    if (!cP.ok || !cQ.ok) { divCacheRef.current = null; return; }
    const Pfn = cP.fn, Qfn = cQ.fn;
    const N = 32;
    const ds = new Float32Array(N * N);
    let dmax = 0;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = -range + (2*range)*((i + 0.5) / N);
        const y = -range + (2*range)*((j + 0.5) / N);
        const d = partial(Pfn, { x, y }, 'x') + partial(Qfn, { x, y }, 'y');
        ds[i*N + j] = d;
        if (Math.abs(d) > dmax) dmax = Math.abs(d);
      }
    }
    divCacheRef.current = { ds, dmax: dmax < 1e-6 ? 1 : dmax, N };
  }, [cP, cQ, range]);

  // particles
  const particlesRef = useRef(null);
  if (!particlesRef.current) {
    particlesRef.current = Array.from({ length: 220 }, () => ({
      x: (Math.random() * 2 - 1) * range,
      y: (Math.random() * 2 - 1) * range,
      age: Math.random() * 3,
    }));
  }

  const P = cP.ok ? cP.fn : () => 0;
  const Q = cQ.ok ? cQ.fn : () => 0;

  // div and rot at probe
  const div = cP.ok && cQ.ok
    ? partial(P, { x: probe.x, y: probe.y }, 'x') + partial(Q, { x: probe.x, y: probe.y }, 'y')
    : 0;
  const rot = cP.ok && cQ.ok
    ? partial(Q, { x: probe.x, y: probe.y }, 'x') - partial(P, { x: probe.x, y: probe.y }, 'y')
    : 0;

  const ref = useAnimatedCanvas((ctx, w, h, t, dt) => {
    const mapSize = Math.min(w - 60, h - 80);
    const mx = w / 2, my = h / 2;
    const x0 = mx - mapSize/2, y0 = my - mapSize/2;
    const toPx = (x, y) => ({
      px: x0 + ((x + range) / (2*range)) * mapSize,
      py: y0 + mapSize - ((y + range) / (2*range)) * mapSize,
    });

    // background: divergence heatmap (drawn from cache, updated by useEffect)
    if (showDiv && divCacheRef.current) {
      const { ds, dmax, N } = divCacheRef.current;
      const tile = mapSize / N;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const d = ds[i*N + j] / dmax;
          const hue = d > 0 ? 30 : 200;
          const L = 0.35 + 0.25 * Math.abs(d);
          ctx.fillStyle = `oklch(${L} 0.12 ${hue})`;
          ctx.globalAlpha = 0.16 * Math.min(1, Math.abs(d) + 0.1);
          ctx.fillRect(x0 + i*tile, y0 + mapSize - (j+1)*tile, tile + 0.5, tile + 0.5);
        }
      }
      ctx.globalAlpha = 1;
    }

    // frame
    ctx.strokeStyle = '#2a2824';
    ctx.strokeRect(x0, y0, mapSize, mapSize);

    // ticks
    ctx.fillStyle = '#5a564c';
    ctx.font = '9.5px "JetBrains Mono", monospace';
    for (let i = 0; i <= 4; i++) {
      const xv = -range + (2*range)*(i/4);
      const yv = -range + (2*range)*(i/4);
      ctx.fillText(xv.toFixed(1), x0 + (i/4)*mapSize - 8, y0 + mapSize + 12);
      ctx.fillText(yv.toFixed(1), x0 - 22, y0 + mapSize - (i/4)*mapSize + 3);
    }

    // vector arrows (sparse grid)
    if (cP.ok && cQ.ok) {
      const step = 14;
      for (let i = 0; i < step; i++) {
        for (let j = 0; j < step; j++) {
          const x = -range + (2*range)*((i+0.5)/step);
          const y = -range + (2*range)*((j+0.5)/step);
          const pv = P({ x, y }), qv = Q({ x, y });
          const mag = Math.hypot(pv, qv);
          if (mag < 1e-6) continue;
          const { px, py } = toPx(x, y);
          const L = Math.min(mapSize / (step * 1.8), (mapSize / (step * 1.8)) * Math.tanh(mag * 0.4));
          ctx.strokeStyle = 'rgba(207, 201, 183, 0.55)';
          ctx.fillStyle = 'rgba(207, 201, 183, 0.75)';
          ctx.lineWidth = 1;
          arrow(ctx, px, py, px + (pv/mag)*L, py - (qv/mag)*L, 3);
        }
      }
    }

    // particles
    if (animate && cP.ok && cQ.ok) {
      const parts = particlesRef.current;
      for (const p of parts) {
        p.age += dt;
        const pv = P({ x: p.x, y: p.y });
        const qv = Q({ x: p.x, y: p.y });
        const mag = Math.hypot(pv, qv) || 1;
        const speed = Math.min(1.2, 0.5 + mag * 0.1);
        p.x += (pv / mag) * speed * dt;
        p.y += (qv / mag) * speed * dt;
        if (Math.abs(p.x) > range || Math.abs(p.y) > range || p.age > 3 + Math.random()*3) {
          p.x = (Math.random() * 2 - 1) * range;
          p.y = (Math.random() * 2 - 1) * range;
          p.age = 0;
        }
        const { px, py } = toPx(p.x, p.y);
        if (px < x0 || px > x0 + mapSize || py < y0 || py > y0 + mapSize) continue;
        const alpha = Math.min(1, p.age * 2) * Math.min(1, (3 - p.age) * 2);
        ctx.fillStyle = `oklch(0.78 0.14 80 / ${alpha * 0.9})`;
        ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI*2); ctx.fill();
      }
    }

    // probe point
    const { px, py } = toPx(probe.x, probe.y);
    ctx.fillStyle = '#0e0e0c';
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'oklch(0.74 0.12 200)';
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI*2); ctx.fill();

    // F(probe) arrow
    if (cP.ok && cQ.ok) {
      const pv = P({ x: probe.x, y: probe.y });
      const qv = Q({ x: probe.x, y: probe.y });
      const mag = Math.hypot(pv, qv);
      if (mag > 1e-6) {
        const L = Math.min(mapSize * 0.15, mapSize * 0.15 * Math.tanh(mag * 0.4) + 30);
        ctx.strokeStyle = 'oklch(0.78 0.14 80)';
        ctx.fillStyle = 'oklch(0.78 0.14 80)';
        ctx.lineWidth = 2;
        arrow(ctx, px, py, px + (pv/mag)*L, py - (qv/mag)*L, 6);
      }
    }

    // legend
    ctx.fillStyle = '#5a564c';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`F(x,y) = (${exprP},  ${exprQ})`, 16, h - 16);
  }, [cP, cQ, range, showDiv, animate, probe]);

  const onCanvasClick = (e) => {
    const el = e.currentTarget.querySelector('canvas');
    const rect = el.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const mapSize = Math.min(w - 60, h - 80);
    const x0 = w/2 - mapSize/2, y0 = h/2 - mapSize/2;
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    if (cx < x0 || cx > x0 + mapSize || cy < y0 || cy > y0 + mapSize) return;
    setProbe({
      x: -range + 2*range * ((cx - x0) / mapSize),
      y: -range + 2*range * (1 - (cy - y0) / mapSize),
    });
  };

  return (
    <>
      <div className="canvas-wrap" onClick={onCanvasClick} style={{ cursor: 'crosshair' }}>
        <canvas ref={ref} />
        <div className="hud tl">
          <span className="big">Champ de vecteurs F = (P, Q)</span>
          div F et rot F au point sondé
        </div>
        <div className="hud tr">
          <span className="big" style={{ color: div > 0 ? 'oklch(0.72 0.14 25)' : 'oklch(0.74 0.12 200)' }}>div F = {fmt(div)}</span>
          <span style={{ color: 'oklch(0.78 0.14 80)' }}>rot F = {fmt(rot)}</span>
        </div>
      </div>

      <aside className="inspector">
        <h3>Champ de vecteurs</h3>
        <div className="subtitle">Module 03 · divergence & rotationnel</div>

        <section>
          <SectionLabel>Composantes</SectionLabel>
          <ExprInput label="P(x,y) =" value={exprP} onChange={setExprP} error={!cP.ok} />
          <div style={{ height: 6 }} />
          <ExprInput label="Q(x,y) =" value={exprQ} onChange={setExprQ} error={!cQ.ok} />
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>exemples :</div>
          <div className="examples">
            {[
              ['-y', 'x', 'rotation'],
              ['x', 'y', 'source'],
              ['-x', '-y', 'puits'],
              ['y', 'x', 'col'],
              ['sin(y)', 'cos(x)', 'sinueux'],
              ['x^2-y^2', '2*x*y', 'conforme'],
            ].map((ex, i) => (
              <span key={i} className="chip" onClick={() => { setExprP(ex[0]); setExprQ(ex[1]); }}>
                {ex[2]}
              </span>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Point sondé</SectionLabel>
          <Slider label="x" min={-range} max={range} step={0.05} value={probe.x} onChange={(v) => setProbe(p => ({...p, x: v}))} />
          <Slider label="y" min={-range} max={range} step={0.05} value={probe.y} onChange={(v) => setProbe(p => ({...p, y: v}))} />
          <KV rows={[
            { k: 'P', v: cP.ok ? fmt(P({x: probe.x, y: probe.y})) : '—' },
            { k: 'Q', v: cQ.ok ? fmt(Q({x: probe.x, y: probe.y})) : '—' },
            { k: 'div F', v: fmt(div), tone: div > 0 ? 'coral' : 'teal' },
            { k: 'rot F', v: fmt(rot), tone: 'hot' },
          ]}/>
        </section>

        <section>
          <SectionLabel>Affichage</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn ${animate ? 'primary' : ''}`} onClick={() => setAnimate(!animate)}>Particules</button>
            <button className={`btn ${showDiv ? 'primary' : ''}`} onClick={() => setShowDiv(!showDiv)}>Heatmap div</button>
          </div>
          <div style={{ marginTop: 10 }}>
            <Slider label="étendue" min={1} max={6} step={0.5} value={range} onChange={setRange} fmtVal={(v) => `±${v}`} />
          </div>
        </section>

        <section>
          <Intuition>
            La <em>divergence</em> mesure l'expansion du champ — positive là où il « sort » (source), négative où il « entre » (puits). Le <em>rotationnel</em> mesure la vorticité locale : combien une petite roue à aubes tournerait.
          </Intuition>
        </section>

        <section>
          <DefBox label="opérateurs différentiels">
            <span className="math">div F = ∂P/∂x + ∂Q/∂y</span><br/><br/>
            <span className="math">rot F = ∂Q/∂x − ∂P/∂y</span>
          </DefBox>
        </section>
      </aside>
    </>
  );
}

Object.assign(window, { VectorFieldModule });
