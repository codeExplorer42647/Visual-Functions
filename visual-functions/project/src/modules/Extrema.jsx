// Module: Extrema libres — points critiques, Hessienne, classification

function ExtremaModule() {
  const [expr, setExpr] = useState('x^3 - 3*x*y^2');
  const [compiled, setCompiled] = useState(() => safeCompile('x^3 - 3*x*y^2'));
  const [range, setRange] = useState(2.5);
  const [criticalPts, setCriticalPts] = useState([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const r = safeCompile(expr);
    if (r.ok) setCompiled(r);
  }, [expr]);

  // find critical points via grid search + Newton refinement
  useEffect(() => {
    if (!compiled.ok) { setCriticalPts([]); return; }
    const f = compiled.fn;
    const candidates = [];
    const N = 30;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x0 = -range + (2*range)*(i/(N-1));
        const y0 = -range + (2*range)*(j/(N-1));
        let x = x0, y = y0;
        let ok = false;
        for (let k = 0; k < 40; k++) {
          const [gx, gy] = grad2(f, x, y);
          const H = hess2(f, x, y);
          const det = H[0][0]*H[1][1] - H[0][1]*H[1][0];
          if (Math.abs(det) < 1e-8) break;
          const dx = (H[1][1]*gx - H[0][1]*gy) / det;
          const dy = (-H[1][0]*gx + H[0][0]*gy) / det;
          x -= dx; y -= dy;
          if (Math.abs(x) > range + 0.5 || Math.abs(y) > range + 0.5) break;
          if (Math.hypot(dx, dy) < 1e-7) { ok = true; break; }
        }
        if (ok && Math.abs(x) <= range && Math.abs(y) <= range) {
          // dedupe
          if (!candidates.some(p => Math.hypot(p.x - x, p.y - y) < 0.08)) {
            const H = hess2(f, x, y);
            const det = H[0][0]*H[1][1] - H[0][1]*H[1][0];
            const tr = H[0][0] + H[1][1];
            let type = 'col';
            if (det > 1e-4) type = H[0][0] > 0 ? 'min' : 'max';
            else if (det < -1e-4) type = 'col';
            else type = 'indét.';
            candidates.push({ x, y, H, det, tr, type, fv: f({x, y}) });
          }
        }
      }
    }
    setCriticalPts(candidates);
    setSelected(0);
  }, [compiled, range]);

  const grid = useMemo(() => {
    if (!compiled.ok) return null;
    const N = 50;
    const zs = new Float32Array(N * N);
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = -range + (2*range)*(i/(N-1));
        const y = -range + (2*range)*(j/(N-1));
        let z = compiled.fn({x, y});
        if (!isFinite(z)) z = 0;
        zs[i*N+j] = z;
        if (z < zmin) zmin = z;
        if (z > zmax) zmax = z;
      }
    }
    if (zmin === zmax) zmax = zmin + 1;
    return { zs, N, zmin, zmax };
  }, [compiled, range]);

  const ref = useCanvas((ctx, w, h) => {
    if (!grid) return;
    const { zs, N, zmin, zmax } = grid;
    const mapSize = Math.min(w - 60, h - 80);
    const x0 = w/2 - mapSize/2, y0 = h/2 - mapSize/2;
    const toPx = (x, y) => ({
      px: x0 + ((x + range) / (2*range)) * mapSize,
      py: y0 + mapSize - ((y + range) / (2*range)) * mapSize,
    });
    const tile = mapSize / (N - 1);

    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const z = (zs[i*N+j] + zs[(i+1)*N+j] + zs[i*N+j+1] + zs[(i+1)*N+j+1]) / 4;
        const t = (z - zmin) / (zmax - zmin);
        ctx.fillStyle = HEATMAP_LUT[Math.min(255, Math.max(0, Math.round(t * 255)))];
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x0 + i*tile, y0 + (N-2-j)*tile, tile + 0.5, tile + 0.5);
      }
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a2824';
    ctx.strokeRect(x0, y0, mapSize, mapSize);

    // contours — one path per level to minimise draw calls
    const nC = 16;
    for (let c = 0; c < nC; c++) {
      const t = (c + 0.5)/nC;
      const k = zmin + t*(zmax - zmin);
      ctx.strokeStyle = contourColor(t);
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let i = 0; i < N-1; i++) for (let j = 0; j < N-1; j++) {
        const z00 = zs[i*N+j], z10 = zs[(i+1)*N+j], z01 = zs[i*N+j+1], z11 = zs[(i+1)*N+j+1];
        const p00 = {x: x0 + i*tile, y: y0 + mapSize - j*tile};
        const p10 = {x: x0 + (i+1)*tile, y: y0 + mapSize - j*tile};
        const p01 = {x: x0 + i*tile, y: y0 + mapSize - (j+1)*tile};
        const p11 = {x: x0 + (i+1)*tile, y: y0 + mapSize - (j+1)*tile};
        const idx = (z00>k?1:0)|(z10>k?2:0)|(z11>k?4:0)|(z01>k?8:0);
        if (idx===0||idx===15) continue;
        const lerp=(pa,pb,za,zb)=>{const t=(k-za)/(zb-za);return{x:pa.x+t*(pb.x-pa.x),y:pa.y+t*(pb.y-pa.y)};};
        const eB=()=>lerp(p00,p10,z00,z10),eR=()=>lerp(p10,p11,z10,z11),eT=()=>lerp(p01,p11,z01,z11),eL=()=>lerp(p00,p01,z00,z01);
        const sg=(a,b)=>{ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);};
        switch(idx){case 1:case 14:sg(eB(),eL());break;case 2:case 13:sg(eB(),eR());break;case 3:case 12:sg(eL(),eR());break;case 4:case 11:sg(eT(),eR());break;case 5:sg(eB(),eL());sg(eT(),eR());break;case 6:case 9:sg(eB(),eT());break;case 7:case 8:sg(eT(),eL());break;case 10:sg(eB(),eR());sg(eT(),eL());break;}
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // critical points
    criticalPts.forEach((cp, i) => {
      const { px, py } = toPx(cp.x, cp.y);
      const isSel = i === selected;
      const color = cp.type === 'min' ? 'oklch(0.74 0.12 200)'
                  : cp.type === 'max' ? 'oklch(0.72 0.14 25)'
                  : 'oklch(0.78 0.14 80)';
      ctx.fillStyle = '#0e0e0c';
      ctx.beginPath(); ctx.arc(px, py, isSel ? 9 : 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px, py, isSel ? 5 : 3, 0, Math.PI*2); ctx.fill();
      if (isSel) {
        ctx.strokeStyle = color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = color;
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(cp.type, px + 10, py - 8);
    });

    ctx.fillStyle = '#5a564c';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`f = ${compiled.ok ? compiled.fn.src : expr}`, 16, h - 16);
    ctx.textAlign = 'right';
    ctx.fillText(`${criticalPts.length} point(s) critique(s) trouvé(s)`, w - 16, h - 16);
    ctx.textAlign = 'left';
  }, [compiled, grid, range, criticalPts, selected]);

  const sel = criticalPts[selected];

  return (
    <>
      <div className="canvas-wrap">
        <canvas ref={ref} />
        <div className="hud tl">
          <span className="big">Extrema libres</span>
          Newton trouve les zéros de ∇f ; la Hessienne classifie.
        </div>
      </div>

      <aside className="inspector">
        <h3>Extrema & Hessienne</h3>
        <div className="subtitle">Module 04 · ∇f = 0, classification par H</div>

        <section>
          <SectionLabel>Expression</SectionLabel>
          <ExprInput label="f(x,y) =" value={expr} onChange={setExpr} error={!compiled.ok} />
          <Chips items={['x^2 + y^2', 'x^2 - y^2', 'x^3 - 3*x*y^2', 'x^2*y - y^3 + y', '(x^2+y^2)*exp(-(x^2+y^2))', 'sin(x)*sin(y)']} onPick={setExpr} />
        </section>

        <section>
          <SectionLabel aux={`${criticalPts.length} trouvés`}>Points critiques</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
            {criticalPts.map((cp, i) => (
              <div key={i}
                onClick={() => setSelected(i)}
                style={{
                  padding: '6px 10px',
                  background: i === selected ? 'var(--panel-2)' : 'var(--panel)',
                  border: '1px solid ' + (i === selected ? 'var(--hot)' : 'var(--line)'),
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}>
                <span>({fmt(cp.x,2)}, {fmt(cp.y,2)})</span>
                <span style={{
                  color: cp.type==='min'?'oklch(0.74 0.12 200)':cp.type==='max'?'oklch(0.72 0.14 25)':'oklch(0.78 0.14 80)',
                  textTransform:'uppercase', fontSize: 10, letterSpacing: '0.1em'
                }}>{cp.type}</span>
              </div>
            ))}
            {criticalPts.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>aucun point critique dans la fenêtre</div>}
          </div>
        </section>

        {sel && (
          <section>
            <SectionLabel>Hessienne en ce point</SectionLabel>
            <div className="defbox" style={{ fontFamily: 'var(--font-mono)' }}>
              <span className="label">H(x₀,y₀)</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 6 }}>
                <span>f<sub>xx</sub> = {fmt(sel.H[0][0])}</span>
                <span>f<sub>xy</sub> = {fmt(sel.H[0][1])}</span>
                <span>f<sub>yx</sub> = {fmt(sel.H[1][0])}</span>
                <span>f<sub>yy</sub> = {fmt(sel.H[1][1])}</span>
              </div>
              <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <span>det H = <span style={{color: 'var(--hot)'}}>{fmt(sel.det)}</span></span><br/>
                <span>tr H = {fmt(sel.tr)}</span><br/>
                <span>f = {fmt(sel.fv)}</span>
              </div>
            </div>
          </section>
        )}

        <section>
          <SectionLabel>Étendue</SectionLabel>
          <Slider label="domaine" min={1} max={6} step={0.5} value={range} onChange={setRange} fmtVal={(v) => `±${v}`} />
        </section>

        <section>
          <Intuition>
            On trouve les points où <em>∇f = 0</em>, puis on lit la Hessienne : <em>det H &gt; 0, f<sub>xx</sub> &gt; 0</em> → minimum ; <em>det H &gt; 0, f<sub>xx</sub> &lt; 0</em> → maximum ; <em>det H &lt; 0</em> → col (selle).
          </Intuition>
        </section>

        <section>
          <DefBox label="test de la Hessienne">
            <span className="math">det H &gt; 0 ∧ f<sub>xx</sub> &gt; 0</span> → min local<br/>
            <span className="math">det H &gt; 0 ∧ f<sub>xx</sub> &lt; 0</span> → max local<br/>
            <span className="math">det H &lt; 0</span> → point-col<br/>
            <span className="math">det H = 0</span> → indéterminé
          </DefBox>
        </section>
      </aside>
    </>
  );
}

Object.assign(window, { ExtremaModule });
