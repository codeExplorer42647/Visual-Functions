// Module: Courbes paramétrées γ(t) = (x(t), y(t)) — vitesse, accélération, longueur d'arc

function ParamCurveModule() {
  const [exprX, setExprX] = useState('cos(t) + 0.5*cos(3*t)');
  const [exprY, setExprY] = useState('sin(t) - 0.5*sin(3*t)');
  const [cX, setCX] = useState(() => safeCompile('cos(t) + 0.5*cos(3*t)'));
  const [cY, setCY] = useState(() => safeCompile('sin(t) - 0.5*sin(3*t)'));
  const [tmin, setTmin] = useState(0);
  const [tmax, setTmax] = useState(2 * Math.PI);
  const [tCur, setTCur] = useState(1.2);
  const [animate, setAnimate] = useState(true);

  useEffect(() => { const r = safeCompile(exprX); if (r.ok) setCX(r); }, [exprX]);
  useEffect(() => { const r = safeCompile(exprY); if (r.ok) setCY(r); }, [exprY]);

  // animate tCur
  useEffect(() => {
    if (!animate) return;
    let raf, last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000; last = now;
      setTCur(t => {
        let n = t + dt * 0.8;
        if (n > tmax) n = tmin;
        return n;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animate, tmin, tmax]);

  // sample curve
  const pts = useMemo(() => {
    if (!cX.ok || !cY.ok) return [];
    const N = 400;
    const arr = [];
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (let i = 0; i <= N; i++) {
      const t = tmin + (tmax - tmin) * (i / N);
      const x = cX.fn({ t }), y = cY.fn({ t });
      if (isFinite(x) && isFinite(y)) {
        arr.push({ t, x, y });
        if (x < xmin) xmin = x; if (x > xmax) xmax = x;
        if (y < ymin) ymin = y; if (y > ymax) ymax = y;
      }
    }
    return { pts: arr, xmin, xmax, ymin, ymax };
  }, [cX, cY, tmin, tmax]);

  const vx = cX.ok ? partial(cX.fn, { t: tCur }, 't') : 0;
  const vy = cY.ok ? partial(cY.fn, { t: tCur }, 't') : 0;
  const speed = Math.hypot(vx, vy);
  const ax = cX.ok ? (cX.fn({t: tCur + 1e-3}) - 2*cX.fn({t: tCur}) + cX.fn({t: tCur - 1e-3})) / 1e-6 : 0;
  const ay = cY.ok ? (cY.fn({t: tCur + 1e-3}) - 2*cY.fn({t: tCur}) + cY.fn({t: tCur - 1e-3})) / 1e-6 : 0;

  // arc length via trapezoidal
  const arcLen = useMemo(() => {
    if (!pts.pts) return 0;
    let L = 0;
    for (let i = 1; i < pts.pts.length; i++) {
      L += Math.hypot(pts.pts[i].x - pts.pts[i-1].x, pts.pts[i].y - pts.pts[i-1].y);
    }
    return L;
  }, [pts]);

  const ref = useCanvas((ctx, w, h) => {
    if (!pts.pts) return;
    const { xmin, xmax, ymin, ymax } = pts;
    const pad = 0.2;
    const dx = (xmax - xmin) || 1, dy = (ymax - ymin) || 1;
    const sx = xmin - pad*dx, ex = xmax + pad*dx;
    const sy = ymin - pad*dy, ey = ymax + pad*dy;
    const size = Math.min(w - 80, h - 80);
    const cx = w/2 - size/2, cy = h/2 - size/2;
    const scale = Math.min(size/(ex - sx), size/(ey - sy));
    const ox = cx + size/2 - ((sx+ex)/2) * scale;
    const oy = cy + size/2 + ((sy+ey)/2) * scale;
    const toPx = (x, y) => [ox + x*scale, oy - y*scale];

    // frame + axes
    ctx.strokeStyle = '#2a2824'; ctx.lineWidth = 1;
    ctx.strokeRect(cx, cy, size, size);
    // origin axes if visible
    ctx.strokeStyle = '#3a372f';
    if (sx <= 0 && ex >= 0) {
      const [px] = toPx(0, 0); ctx.beginPath(); ctx.moveTo(px, cy); ctx.lineTo(px, cy + size); ctx.stroke();
    }
    if (sy <= 0 && ey >= 0) {
      const [, py] = toPx(0, 0); ctx.beginPath(); ctx.moveTo(cx, py); ctx.lineTo(cx + size, py); ctx.stroke();
    }

    // curve with gradient along t
    for (let i = 1; i < pts.pts.length; i++) {
      const [ax1, ay1] = toPx(pts.pts[i-1].x, pts.pts[i-1].y);
      const [bx1, by1] = toPx(pts.pts[i].x, pts.pts[i].y);
      const tN = (pts.pts[i].t - tmin) / (tmax - tmin);
      ctx.strokeStyle = `oklch(${0.68 + 0.12*tN} 0.14 ${80 - 60*tN})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(bx1, by1); ctx.stroke();
    }

    // current point
    const xc = cX.fn({t: tCur}), yc = cY.fn({t: tCur});
    const [pxc, pyc] = toPx(xc, yc);

    // velocity vector
    if (speed > 1e-6) {
      const vlen = Math.min(size * 0.18, size * 0.18 * Math.tanh(speed * 0.3) + 20);
      ctx.strokeStyle = 'oklch(0.74 0.12 200)'; ctx.fillStyle = 'oklch(0.74 0.12 200)'; ctx.lineWidth = 2;
      arrow(ctx, pxc, pyc, pxc + (vx/speed)*vlen, pyc - (vy/speed)*vlen, 6);
      ctx.fillStyle = 'oklch(0.74 0.12 200)';
      ctx.font = 'italic 14px "Newsreader", serif';
      ctx.fillText("γ'", pxc + (vx/speed)*vlen + 5, pyc - (vy/speed)*vlen);
    }

    // acceleration vector
    const amag = Math.hypot(ax, ay);
    if (amag > 1e-6) {
      const alen = Math.min(size * 0.12, size * 0.12 * Math.tanh(amag * 0.08) + 15);
      ctx.strokeStyle = 'oklch(0.72 0.14 25)'; ctx.fillStyle = 'oklch(0.72 0.14 25)'; ctx.lineWidth = 1.5;
      arrow(ctx, pxc, pyc, pxc + (ax/amag)*alen, pyc - (ay/amag)*alen, 5);
      ctx.fillStyle = 'oklch(0.72 0.14 25)';
      ctx.font = 'italic 14px "Newsreader", serif';
      ctx.fillText("γ''", pxc + (ax/amag)*alen + 5, pyc - (ay/amag)*alen);
    }

    // point
    ctx.fillStyle = '#0e0e0c';
    ctx.beginPath(); ctx.arc(pxc, pyc, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'oklch(0.78 0.14 80)';
    ctx.beginPath(); ctx.arc(pxc, pyc, 3.5, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#5a564c';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`γ(t) = (${exprX}, ${exprY})`, 16, h - 16);
  }, [cX, cY, pts, tCur, tmin, tmax]);

  return (
    <>
      <div className="canvas-wrap">
        <canvas ref={ref} />
        <div className="hud tl">
          <span className="big">Courbe paramétrée γ(t)</span>
          vecteur vitesse <span style={{color:'oklch(0.74 0.12 200)'}}>γ'</span> tangent · accélération <span style={{color:'oklch(0.72 0.14 25)'}}>γ''</span>
        </div>
        <div className="hud tr">
          <span className="big" style={{ color: 'oklch(0.78 0.14 80)' }}>t = {fmt(tCur, 3)}</span>
          <span>‖γ'‖ = {fmt(speed)} · L = {fmt(arcLen, 3)}</span>
        </div>
      </div>

      <aside className="inspector">
        <h3>Courbes paramétrées</h3>
        <div className="subtitle">Module 07 · γ(t) = (x(t), y(t))</div>

        <section>
          <SectionLabel>Composantes</SectionLabel>
          <ExprInput label="x(t) =" value={exprX} onChange={setExprX} error={!cX.ok} />
          <div style={{ height: 6 }}/>
          <ExprInput label="y(t) =" value={exprY} onChange={setExprY} error={!cY.ok} />
          <div className="examples" style={{ marginTop: 10 }}>
            {[
              ['cos(t)', 'sin(t)', 'cercle'],
              ['cos(t) + 0.5*cos(3*t)', 'sin(t) - 0.5*sin(3*t)', 'hypocycloïde'],
              ['t*cos(t)', 't*sin(t)', 'spirale'],
              ['sin(2*t)', 'sin(3*t)', 'Lissajous'],
              ['t - sin(t)', '1 - cos(t)', 'cycloïde'],
              ['cos(t)^3', 'sin(t)^3', 'astroïde'],
            ].map((ex, i) => (
              <span key={i} className="chip" onClick={() => { setExprX(ex[0]); setExprY(ex[1]); }}>{ex[2]}</span>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Paramètre t</SectionLabel>
          <Slider label="t" min={tmin} max={tmax} step={0.01} value={tCur} onChange={(v) => { setTCur(v); setAnimate(false); }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            <Slider label="t min" min={-10} max={10} step={0.1} value={tmin} onChange={setTmin} />
            <Slider label="t max" min={-10} max={20} step={0.1} value={tmax} onChange={setTmax} />
          </div>
          <button className={`btn ${animate ? 'primary' : ''}`} style={{ marginTop: 8 }} onClick={() => setAnimate(!animate)}>
            {animate ? '⏸ pause' : '▶ animer'}
          </button>
        </section>

        <section>
          <SectionLabel>Valeurs courantes</SectionLabel>
          <KV rows={[
            { k: 'γ(t)', v: `(${fmt(cX.ok?cX.fn({t:tCur}):0,3)}, ${fmt(cY.ok?cY.fn({t:tCur}):0,3)})` },
            { k: "γ'(t)", v: `(${fmt(vx,3)}, ${fmt(vy,3)})`, tone: 'teal' },
            { k: "‖γ'(t)‖", v: fmt(speed), tone: 'teal' },
            { k: "γ''(t)", v: `(${fmt(ax,2)}, ${fmt(ay,2)})`, tone: 'coral' },
            { k: 'L (longueur)', v: fmt(arcLen, 4), tone: 'hot' },
          ]}/>
        </section>

        <section>
          <Intuition>
            À chaque instant, <em>γ'</em> donne la direction et la vitesse du mouvement : il est toujours <em>tangent</em> à la courbe. L'accélération <em>γ''</em> pointe vers le centre de courbure.
          </Intuition>
        </section>

        <section>
          <DefBox label="longueur d'arc">
            <span className="math">L = ∫<sub>a</sub><sup>b</sup> ‖γ'(t)‖ dt</span>
          </DefBox>
        </section>
      </aside>
    </>
  );
}

Object.assign(window, { ParamCurveModule });
