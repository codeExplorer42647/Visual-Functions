// Module: Surfaces 3D + lignes de niveau
// Fonction f(x,y) => surface z = f(x,y) avec carte de contours

function SurfacesModule() {
  const [expr, setExpr] = useState('sin(x)*cos(y) + 0.3*x*y');
  const [compiled, setCompiled] = useState(() => safeCompile('sin(x)*cos(y) + 0.3*x*y'));
  const [range, setRange] = useState(3);
  const [yaw, setYaw] = useState(-0.6);
  const [pitch, setPitch] = useState(0.55);
  const [view, setView] = useState('both'); // surface | contours | both
  const [nContours, setNContours] = useState(12);
  const [resolution, setResolution] = useState(40);

  // Dragging for rotation
  const dragRef = useRef(null);

  useEffect(() => {
    const r = safeCompile(expr);
    if (r.ok) setCompiled(r);
  }, [expr]);

  // Sample grid
  const grid = useMemo(() => {
    if (!compiled.ok) return null;
    const N = resolution;
    const zs = new Float32Array(N * N);
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < N; i++) {
      const x = -range + (2 * range) * (i / (N - 1));
      for (let j = 0; j < N; j++) {
        const y = -range + (2 * range) * (j / (N - 1));
        let z = compiled.fn({ x, y });
        if (!isFinite(z)) z = 0;
        zs[i * N + j] = z;
        if (z < zmin) zmin = z;
        if (z > zmax) zmax = z;
      }
    }
    if (zmin === zmax) { zmax = zmin + 1; }
    return { zs, N, zmin, zmax };
  }, [compiled, range, resolution]);

  const ref = useCanvas((ctx, w, h) => {
    if (!grid) return;
    const { zs, N, zmin, zmax } = grid;
    const zScale = Math.min(1.0, 2.0 / (zmax - zmin));

    // --- 2D bottom contour map ---
    if (view === 'contours' || view === 'both') {
      const mapSize = view === 'contours' ? Math.min(w, h) * 0.85 : Math.min(w, h) * 0.38;
      const mx = view === 'contours' ? w / 2 : w * 0.22;
      const my = view === 'contours' ? h / 2 : h * 0.72;
      drawContourMap(ctx, zs, N, { cx: mx, cy: my, size: mapSize, zmin, zmax, nContours, range });
    }

    // --- 3D surface ---
    if (view === 'surface' || view === 'both') {
      const cx = view === 'surface' ? w / 2 : w * 0.62;
      const cy = view === 'surface' ? h / 2 : h * 0.45;
      const scale = view === 'surface' ? Math.min(w, h) * 0.14 : Math.min(w, h) * 0.10;
      drawSurface3D(ctx, zs, N, { cx, cy, scale, yaw, pitch, zmin, zmax, zScale, range });
    }

    // Title watermark
    ctx.fillStyle = '#5a564c';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`z = ${compiled.ok ? compiled.fn.src : expr}`, 16, h - 16);
    ctx.fillText(`domaine : [−${range}, ${range}]²`, 16, h - 32);
    ctx.textAlign = 'right';
    ctx.fillText(`min ${fmt(zmin)} · max ${fmt(zmax)}`, w - 16, h - 16);
    ctx.textAlign = 'left';
  }, [compiled, grid, range, yaw, pitch, view, nContours]);

  const onPointer = (e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    dragRef.current = { x: e.clientX, y: e.clientY, yaw, pitch };
    const move = (ev) => {
      const d = dragRef.current;
      const dx = (ev.clientX - d.x) / rect.width;
      const dy = (ev.clientY - d.y) / rect.height;
      setYaw(d.yaw + dx * 3);
      setPitch(Math.max(-1.2, Math.min(1.2, d.pitch + dy * 2)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <>
      <div className="canvas-wrap" onPointerDown={onPointer} style={{ cursor: 'grab' }}>
        <canvas ref={ref} />
        <div className="hud tl">
          <span className="big">Surfaces & lignes de niveau</span>
          z = f(x, y) · glisser pour tourner
        </div>
        <div className="hud br">
          yaw {yaw.toFixed(2)}&nbsp;·&nbsp;pitch {pitch.toFixed(2)}
        </div>
      </div>

      <aside className="inspector">
        <h3>Surfaces & contours</h3>
        <div className="subtitle">Module 01 · z = f(x, y)</div>

        <section>
          <SectionLabel>Expression</SectionLabel>
          <ExprInput label="f(x,y) =" value={expr} onChange={setExpr} error={!compiled.ok} />
          {!compiled.ok && <div style={{ color: 'var(--coral)', fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 6 }}>⚠ {compiled.err}</div>}
          <Chips
            items={['sin(x)*cos(y) + 0.3*x*y', 'x^2 - y^2', 'exp(-(x^2+y^2))', 'sin(sqrt(x^2+y^2))', 'x*y/(x^2+y^2+1)', 'cos(x+y) - 0.2*(x^2+y^2)']}
            onPick={setExpr}
          />
        </section>

        <section>
          <SectionLabel>Affichage</SectionLabel>
          <ToggleGroup
            value={view}
            onChange={setView}
            options={[
              { value: 'surface', label: 'Surface' },
              { value: 'contours', label: 'Niveaux' },
              { value: 'both', label: 'Les deux' },
            ]}
          />
        </section>

        <section>
          <SectionLabel>Paramètres</SectionLabel>
          <Slider label="étendue" min={1} max={8} step={0.5} value={range} onChange={setRange} fmtVal={(v) => `±${v}`} />
          <Slider label="niveaux" min={4} max={30} step={1} value={nContours} onChange={setNContours} fmtVal={(v) => `${v}`} />
          <Slider label="résolution" min={20} max={80} step={5} value={resolution} onChange={setResolution} fmtVal={(v) => `${v}²`} />
        </section>

        <section>
          <SectionLabel>Intuition</SectionLabel>
          <Intuition>
            Les <em>lignes de niveau</em> sont les « courbes d'altitude » : l'ensemble des (x, y) où f prend une valeur constante k. Elles se resserrent là où la pente est forte, comme sur une carte topographique.
          </Intuition>
        </section>

        <section>
          <DefBox label="définition">
            Ligne de niveau de hauteur k :<br />
            <span className="math">N<sub>k</sub>(f) = &#123; (x, y) ∈ ℝ² : f(x, y) = k &#125;</span>
          </DefBox>
        </section>
      </aside>
    </>
  );
}

// --- drawing helpers specific to this module ---

function colorForZ(t) {
  // t in [0,1] : cool -> warm
  const hue = 210 - 190 * t; // teal -> yellow
  const L = 0.36 + 0.42 * t;
  return `oklch(${L} 0.12 ${hue})`;
}

function drawContourMap(ctx, zs, N, { cx, cy, size, zmin, zmax, nContours, range }) {
  const half = size / 2;
  const x0 = cx - half, y0 = cy - half;

  // fill background tiles (coarse heatmap)
  const tile = size / (N - 1);
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const z = (zs[i * N + j] + zs[(i+1)*N + j] + zs[i*N + j+1] + zs[(i+1)*N + j+1]) / 4;
      const t = (z - zmin) / (zmax - zmin);
      ctx.fillStyle = colorForZ(t);
      ctx.globalAlpha = 0.32;
      ctx.fillRect(x0 + i * tile, y0 + (N - 2 - j) * tile, tile + 0.5, tile + 0.5);
    }
  }
  ctx.globalAlpha = 1;

  // frame
  ctx.strokeStyle = '#2a2824';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);

  // axes ticks
  ctx.fillStyle = '#5a564c';
  ctx.font = '9.5px "JetBrains Mono", monospace';
  for (let i = 0; i <= 4; i++) {
    const xv = -range + (2 * range) * (i / 4);
    const yv = -range + (2 * range) * (i / 4);
    const px = x0 + (i / 4) * size;
    const py = y0 + size - (i / 4) * size;
    ctx.fillText(xv.toFixed(1), px - 8, y0 + size + 12);
    ctx.fillText(yv.toFixed(1), x0 - 22, py + 3);
  }

  // marching squares contours
  for (let c = 0; c < nContours; c++) {
    const t = (c + 0.5) / nContours;
    const k = zmin + t * (zmax - zmin);
    ctx.strokeStyle = contourColor(t);
    ctx.lineWidth = t === 0.5 ? 1.3 : 0.8;
    ctx.globalAlpha = 0.9;
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const z00 = zs[i*N + j],     z10 = zs[(i+1)*N + j];
        const z01 = zs[i*N + j+1],   z11 = zs[(i+1)*N + j+1];
        const p00 = { x: x0 + i*tile,     y: y0 + size - j*tile };
        const p10 = { x: x0 + (i+1)*tile, y: y0 + size - j*tile };
        const p01 = { x: x0 + i*tile,     y: y0 + size - (j+1)*tile };
        const p11 = { x: x0 + (i+1)*tile, y: y0 + size - (j+1)*tile };
        drawCellContour(ctx, k, z00, z10, z01, z11, p00, p10, p01, p11);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawCellContour(ctx, k, z00, z10, z01, z11, p00, p10, p01, p11) {
  const idx = (z00 > k ? 1 : 0) | (z10 > k ? 2 : 0) | (z11 > k ? 4 : 0) | (z01 > k ? 8 : 0);
  if (idx === 0 || idx === 15) return;
  const lerp = (pa, pb, za, zb) => {
    const t = (k - za) / (zb - za);
    return { x: pa.x + t * (pb.x - pa.x), y: pa.y + t * (pb.y - pa.y) };
  };
  const eBot = () => lerp(p00, p10, z00, z10);
  const eRig = () => lerp(p10, p11, z10, z11);
  const eTop = () => lerp(p01, p11, z01, z11);
  const eLef = () => lerp(p00, p01, z00, z01);
  const seg = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

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

function drawSurface3D(ctx, zs, N, { cx, cy, scale, yaw, pitch, zmin, zmax, zScale, range }) {
  const proj = makeProjector({ yaw, pitch, scale, cx, cy });

  // Pre-project all points
  const pts = new Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = -range + (2 * range) * (i / (N - 1));
      const y = -range + (2 * range) * (j / (N - 1));
      const z = zs[i * N + j];
      // normalized 3D coords
      const X = x * (1 / range);
      const Y = z * zScale;
      const Z = y * (1 / range);
      pts[i * N + j] = proj.project(X, Y, Z);
    }
  }

  // Build quads with depth, sort back-to-front
  const quads = [];
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const a = pts[i*N + j], b = pts[(i+1)*N + j], c = pts[(i+1)*N + j+1], d = pts[i*N + j+1];
      const depth = (a[2] + b[2] + c[2] + d[2]) / 4;
      const zavg = (zs[i*N+j] + zs[(i+1)*N+j] + zs[(i+1)*N+j+1] + zs[i*N+j+1]) / 4;
      const t = (zavg - zmin) / (zmax - zmin);
      quads.push({ a, b, c, d, depth, t });
    }
  }
  quads.sort((u, v) => u.depth - v.depth);

  // Floor/box wireframe (behind)
  drawAxes3D(ctx, proj, range);

  for (const q of quads) {
    ctx.beginPath();
    ctx.moveTo(q.a[0], q.a[1]);
    ctx.lineTo(q.b[0], q.b[1]);
    ctx.lineTo(q.c[0], q.c[1]);
    ctx.lineTo(q.d[0], q.d[1]);
    ctx.closePath();
    ctx.fillStyle = colorForZ(q.t);
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#0e0e0c';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawAxes3D(ctx, proj, range) {
  ctx.strokeStyle = '#3a372f';
  ctx.lineWidth = 1;
  const corners = [
    [-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]
  ].map(([x, y, z]) => proj.project(x, y, z));
  ctx.beginPath();
  ctx.moveTo(corners[0][0], corners[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
  ctx.closePath();
  ctx.stroke();

  // axis labels
  ctx.fillStyle = '#8a8576';
  ctx.font = 'italic 14px "Newsreader", serif';
  const xEnd = proj.project(1.15, 0, -1);
  const yEnd = proj.project(-1, 1.15, -1);
  const zEnd = proj.project(-1, 0, 1.15);
  ctx.fillText('x', xEnd[0], xEnd[1]);
  ctx.fillText('z', yEnd[0], yEnd[1]);
  ctx.fillText('y', zEnd[0], zEnd[1]);
}

Object.assign(window, { SurfacesModule });
