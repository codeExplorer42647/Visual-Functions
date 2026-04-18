// Module: Gradient & dérivée directionnelle
// Visualise ∇f sur une carte 2D + dérivée directionnelle en un point mobile

function GradientModule() {
  const [expr, setExpr] = useState('x^2 + y^2 - x*y');
  const [compiled, setCompiled] = useState(() => safeCompile('x^2 + y^2 - x*y'));
  const [range, setRange] = useState(3);
  const [point, setPoint] = useState({ x: 1.2, y: 0.6 });
  const [dirAngle, setDirAngle] = useState(0.4); // radians
  const [showField, setShowField] = useState(true);
  const [showContours, setShowContours] = useState(true);

  useEffect(() => {
    const r = safeCompile(expr);
    if (r.ok) setCompiled(r);
  }, [expr]);

  // sample grid for contours
  const grid = useMemo(() => {
    if (!compiled.ok) return null;
    const N = 50;
    const zs = new Float32Array(N * N);
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < N; i++) {
      const x = -range + (2*range) * (i / (N - 1));
      for (let j = 0; j < N; j++) {
        const y = -range + (2*range) * (j / (N - 1));
        let z = compiled.fn({ x, y });
        if (!isFinite(z)) z = 0;
        zs[i*N + j] = z;
        if (z < zmin) zmin = z;
        if (z > zmax) zmax = z;
      }
    }
    if (zmin === zmax) zmax = zmin + 1;
    return { zs, N, zmin, zmax };
  }, [compiled, range]);

  const [gx, gy] = compiled.ok
    ? grad2(compiled.fn, point.x, point.y)
    : [0, 0];
  const gnorm = Math.hypot(gx, gy);
  const fVal = compiled.ok ? compiled.fn({ x: point.x, y: point.y }) : NaN;

  // directional derivative
  const ux = Math.cos(dirAngle), uy = Math.sin(dirAngle);
  const dirDeriv = gx * ux + gy * uy;

  // canvas: a 2D map. left 2/3 = contour map. right 1/3 = diagnostic.
  const ref = useCanvas((ctx, w, h) => {
    if (!grid) return;
    const { zs, N, zmin, zmax } = grid;
    const mapSize = Math.min(w - 60, h - 80);
    const mx = w / 2;
    const my = h / 2 + 8;
    const half = mapSize / 2;
    const x0 = mx - half, y0 = my - half;

    const toPx = (x, y) => ({
      px: x0 + ((x + range) / (2*range)) * mapSize,
      py: y0 + mapSize - ((y + range) / (2*range)) * mapSize,
    });

    // bg heatmap
    const tile = mapSize / (N - 1);
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const z = (zs[i*N+j] + zs[(i+1)*N+j] + zs[i*N+j+1] + zs[(i+1)*N+j+1]) / 4;
        const t = (z - zmin) / (zmax - zmin);
        ctx.fillStyle = HEATMAP_LUT[Math.min(255, Math.max(0, Math.round(t * 255)))];
        ctx.globalAlpha = 0.22;
        ctx.fillRect(x0 + i*tile, y0 + (N-2-j)*tile, tile + 0.5, tile + 0.5);
      }
    }
    ctx.globalAlpha = 1;

    // frame
    ctx.strokeStyle = '#2a2824';
    ctx.strokeRect(x0, y0, mapSize, mapSize);

    // ticks
    ctx.fillStyle = '#5a564c';
    ctx.font = '9.5px "JetBrains Mono", monospace';
    for (let i = 0; i <= 4; i++) {
      const xv = -range + (2 * range) * (i / 4);
      const yv = -range + (2 * range) * (i / 4);
      const px = x0 + (i / 4) * mapSize;
      const py = y0 + mapSize - (i / 4) * mapSize;
      ctx.fillText(xv.toFixed(1), px - 8, y0 + mapSize + 12);
      ctx.fillText(yv.toFixed(1), x0 - 22, py + 3);
    }

    // contours — one path per level to minimise draw calls
    if (showContours) {
      const nContours = 14;
      for (let c = 0; c < nContours; c++) {
        const t = (c + 0.5) / nContours;
        const k = zmin + t * (zmax - zmin);
        ctx.strokeStyle = contourColor(t);
        ctx.lineWidth = 0.7;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        for (let i = 0; i < N - 1; i++) {
          for (let j = 0; j < N - 1; j++) {
            const z00 = zs[i*N + j], z10 = zs[(i+1)*N + j];
            const z01 = zs[i*N + j+1], z11 = zs[(i+1)*N + j+1];
            const p00 = { x: x0 + i*tile,     y: y0 + mapSize - j*tile };
            const p10 = { x: x0 + (i+1)*tile, y: y0 + mapSize - j*tile };
            const p01 = { x: x0 + i*tile,     y: y0 + mapSize - (j+1)*tile };
            const p11 = { x: x0 + (i+1)*tile, y: y0 + mapSize - (j+1)*tile };
            drawCellContourG(ctx, k, z00, z10, z01, z11, p00, p10, p01, p11);
          }
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // gradient vector field
    if (showField && compiled.ok) {
      const step = 10;
      for (let i = 1; i < step; i++) {
        for (let j = 1; j < step; j++) {
          const x = -range + (2*range) * (i / step);
          const y = -range + (2*range) * (j / step);
          const [gx2, gy2] = grad2(compiled.fn, x, y);
          const mag = Math.hypot(gx2, gy2);
          if (mag < 1e-6) continue;
          const { px, py } = toPx(x, y);
          const scl = Math.min(mapSize / (step * 2.2), mapSize / (step * 2.2) / (1 + mag * 0.15));
          const ex = px + (gx2 / mag) * scl * (0.25 + 0.75 * Math.tanh(mag * 0.4));
          const ey = py - (gy2 / mag) * scl * (0.25 + 0.75 * Math.tanh(mag * 0.4));
          ctx.strokeStyle = 'rgba(207, 201, 183, 0.38)';
          ctx.fillStyle = 'rgba(207, 201, 183, 0.6)';
          ctx.lineWidth = 1;
          arrow(ctx, px, py, ex, ey, 3);
        }
      }
    }

    // point + gradient vector
    const { px, py } = toPx(point.x, point.y);

    // direction vector (unit)
    const dirLen = mapSize * 0.12;
    ctx.strokeStyle = 'var(--teal)';
    ctx.strokeStyle = 'oklch(0.74 0.12 200)';
    ctx.fillStyle = 'oklch(0.74 0.12 200)';
    ctx.lineWidth = 1.5;
    arrow(ctx, px, py, px + ux * dirLen, py - uy * dirLen, 5);

    // gradient vector
    if (gnorm > 1e-6) {
      const glen = Math.min(mapSize * 0.22, mapSize * 0.22 * Math.tanh(gnorm * 0.2));
      ctx.strokeStyle = 'oklch(0.78 0.14 80)';
      ctx.fillStyle = 'oklch(0.78 0.14 80)';
      ctx.lineWidth = 2;
      arrow(ctx, px, py, px + (gx / gnorm) * glen, py - (gy / gnorm) * glen, 6);
    }

    // point
    ctx.fillStyle = '#0e0e0c';
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'oklch(0.78 0.14 80)';
    ctx.beginPath(); ctx.arc(px, py, 3.2, 0, Math.PI*2); ctx.fill();

    // labels
    ctx.fillStyle = 'oklch(0.78 0.14 80)';
    ctx.font = 'italic 14px "Newsreader", serif';
    ctx.fillText('∇f', px + (gx / (gnorm || 1)) * (mapSize * 0.22 + 8) - 6, py - (gy / (gnorm || 1)) * (mapSize * 0.22 + 8));

    ctx.fillStyle = 'oklch(0.74 0.12 200)';
    ctx.fillText('u', px + ux * (dirLen + 10) - 3, py - uy * (dirLen + 10));

    // corner title
    ctx.fillStyle = '#5a564c';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`f = ${compiled.ok ? compiled.fn.src : expr}`, 16, h - 16);
    ctx.textAlign = 'right';
    ctx.fillText('cliquez pour déplacer le point', w - 16, h - 16);
    ctx.textAlign = 'left';
  }, [compiled, grid, range, point, dirAngle, showField, showContours]);

  const onCanvasClick = (e) => {
    const el = e.currentTarget.querySelector('canvas');
    const rect = el.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    const mapSize = Math.min(w - 60, h - 80);
    const mx = w / 2;
    const my = h / 2 + 8;
    const x0 = mx - mapSize/2, y0 = my - mapSize/2;
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    if (cx < x0 || cx > x0 + mapSize || cy < y0 || cy > y0 + mapSize) return;
    const xn = (cx - x0) / mapSize;
    const yn = 1 - (cy - y0) / mapSize;
    setPoint({ x: -range + 2*range*xn, y: -range + 2*range*yn });
  };

  return (
    <>
      <div className="canvas-wrap" onClick={onCanvasClick} style={{ cursor: 'crosshair' }}>
        <canvas ref={ref} />
        <div className="hud tl">
          <span className="big">Gradient & dérivée directionnelle</span>
          cliquer pour choisir le point · faire tourner <span style={{color: 'oklch(0.74 0.12 200)'}}>u</span> dans le panneau
        </div>
        <div className="hud tr">
          <span className="big">f({fmt(point.x, 2)}, {fmt(point.y, 2)}) = {fmt(fVal)}</span>
          <span style={{color: 'oklch(0.78 0.14 80)'}}>‖∇f‖ = {fmt(gnorm)}</span>
        </div>
      </div>

      <aside className="inspector">
        <h3>Gradient</h3>
        <div className="subtitle">Module 02 · ∇f & ∂<sub>u</sub>f</div>

        <section>
          <SectionLabel>Expression</SectionLabel>
          <ExprInput label="f(x,y) =" value={expr} onChange={setExpr} error={!compiled.ok} />
          <Chips
            items={['x^2 + y^2 - x*y', 'x^2 - y^2', 'sin(x)*cos(y)', 'exp(-(x^2+y^2))', 'ln(1+x^2+y^2)']}
            onPick={setExpr}
          />
        </section>

        <section>
          <SectionLabel>Point (x₀, y₀)</SectionLabel>
          <Slider label="x₀" min={-range} max={range} step={0.05} value={point.x} onChange={(v) => setPoint(p => ({...p, x: v}))} />
          <Slider label="y₀" min={-range} max={range} step={0.05} value={point.y} onChange={(v) => setPoint(p => ({...p, y: v}))} />
        </section>

        <section>
          <SectionLabel>Direction u</SectionLabel>
          <Slider label="θ" min={0} max={Math.PI*2} step={0.01} value={dirAngle} onChange={setDirAngle} fmtVal={(v) => (v * 180 / Math.PI).toFixed(0) + '°'} />
        </section>

        <section>
          <SectionLabel>Valeurs au point</SectionLabel>
          <KV rows={[
            { k: '∂f/∂x', v: fmt(gx), tone: 'hot' },
            { k: '∂f/∂y', v: fmt(gy), tone: 'hot' },
            { k: '‖∇f‖', v: fmt(gnorm), tone: 'hot' },
            { k: '∂ᵤf', v: fmt(dirDeriv), tone: 'teal' },
            { k: '∠(∇f, u)', v: gnorm > 1e-6 ? (Math.acos(dirDeriv / gnorm) * 180 / Math.PI).toFixed(1) + '°' : '—' },
          ]}/>
        </section>

        <section>
          <SectionLabel>Affichage</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn ${showField ? 'primary' : ''}`} onClick={() => setShowField(!showField)}>Champ ∇f</button>
            <button className={`btn ${showContours ? 'primary' : ''}`} onClick={() => setShowContours(!showContours)}>Niveaux</button>
          </div>
          <div style={{ marginTop: 10 }}>
            <Slider label="étendue" min={1} max={8} step={0.5} value={range} onChange={setRange} fmtVal={(v) => `±${v}`} />
          </div>
        </section>

        <section>
          <Intuition>
            Le gradient <em>pointe</em> vers la plus grande croissance ; il est <em>perpendiculaire</em> aux lignes de niveau. La dérivée directionnelle ∂<sub>u</sub>f mesure la pente dans la direction u — maximale quand u est aligné avec ∇f.
          </Intuition>
        </section>

        <section>
          <DefBox label="formules">
            <span className="math">∇f(x₀) = (∂f/∂x, ∂f/∂y)</span><br/><br/>
            <span className="math">∂ᵤf(x₀) = ∇f(x₀) · u</span><br/><br/>
            <span className="math">max<sub>‖u‖=1</sub> ∂ᵤf = ‖∇f‖</span>
          </DefBox>
        </section>
      </aside>
    </>
  );
}

function drawCellContourG(ctx, k, z00, z10, z01, z11, p00, p10, p01, p11) {
  const idx = (z00 > k ? 1 : 0) | (z10 > k ? 2 : 0) | (z11 > k ? 4 : 0) | (z01 > k ? 8 : 0);
  if (idx === 0 || idx === 15) return;
  const lerp = (pa, pb, za, zb) => {
    const t = (k - za) / (zb - za);
    return { x: pa.x + t*(pb.x - pa.x), y: pa.y + t*(pb.y - pa.y) };
  };
  const eBot = () => lerp(p00, p10, z00, z10);
  const eRig = () => lerp(p10, p11, z10, z11);
  const eTop = () => lerp(p01, p11, z01, z11);
  const eLef = () => lerp(p00, p01, z00, z01);
  const seg = (a, b) => { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); };
  switch (idx) {
    case 1: case 14: seg(eBot(), eLef()); break;
    case 2: case 13: seg(eBot(), eRig()); break;
    case 3: case 12: seg(eLef(), eRig()); break;
    case 4: case 11: seg(eTop(), eRig()); break;
    case 5: seg(eBot(), eLef()); seg(eTop(), eRig()); break;
    case 6: case 9: seg(eBot(), eTop()); break;
    case 7: case 8: seg(eTop(), eLef()); break;
    case 10: seg(eBot(), eRig()); seg(eTop(), eLef()); break;
  }
}

Object.assign(window, { GradientModule });
