// Module: Multiplicateurs de Lagrange — optimiser f(x,y) sous g(x,y) = 0

function LagrangeModule() {
  const [exprF, setExprF] = useState('x^2 + y^2');
  const [exprG, setExprG] = useState('x + y - 1');
  const [cF, setCF] = useState(() => safeCompile('x^2 + y^2'));
  const [cG, setCG] = useState(() => safeCompile('x + y - 1'));
  const [range, setRange] = useState(2.5);
  const [mode, setMode] = useState('min'); // min | max
  const [solutions, setSolutions] = useState([]);

  useEffect(() => { const r = safeCompile(exprF); if (r.ok) setCF(r); }, [exprF]);
  useEffect(() => { const r = safeCompile(exprG); if (r.ok) setCG(r); }, [exprG]);

  // find critical points on constraint g=0 by solving ∇f = λ∇g with Newton
  useEffect(() => {
    if (!cF.ok || !cG.ok) { setSolutions([]); return; }
    const f = cF.fn, g = cG.fn;
    const sols = [];
    const N = 25;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        let x = -range + (2*range)*(i/(N-1));
        let y = -range + (2*range)*(j/(N-1));
        let lam = 0;
        let ok = false;
        for (let k = 0; k < 40; k++) {
          const [fx, fy] = grad2(f, x, y);
          const [gx, gy] = grad2(g, x, y);
          const gv = g({x, y});
          const F1 = fx - lam*gx, F2 = fy - lam*gy, F3 = gv;
          const h = 1e-4;
          // Jacobian numerically
          const [fxx_m,fxy_m] = grad2((v)=>grad2(f, v.x, v.y)[0], x, y);
          const [fyx_m,fyy_m] = grad2((v)=>grad2(f, v.x, v.y)[1], x, y);
          const [gxx_m,gxy_m] = grad2((v)=>grad2(g, v.x, v.y)[0], x, y);
          const [gyx_m,gyy_m] = grad2((v)=>grad2(g, v.x, v.y)[1], x, y);
          const J = [
            [fxx_m - lam*gxx_m, fxy_m - lam*gxy_m, -gx],
            [fyx_m - lam*gyx_m, fyy_m - lam*gyy_m, -gy],
            [gx, gy, 0],
          ];
          // solve J * d = F by 3x3 inverse
          const d = solve3(J, [F1, F2, F3]);
          if (!d) break;
          x -= d[0]; y -= d[1]; lam -= d[2];
          if (Math.abs(x) > range+0.3 || Math.abs(y) > range+0.3) break;
          if (Math.hypot(d[0], d[1], d[2]) < 1e-7) { ok = true; break; }
        }
        if (ok && Math.abs(g({x, y})) < 1e-3 && Math.abs(x) <= range && Math.abs(y) <= range) {
          if (!sols.some(s => Math.hypot(s.x - x, s.y - y) < 0.08)) {
            sols.push({ x, y, lam, fv: f({x,y}) });
          }
        }
      }
    }
    sols.sort((a,b) => a.fv - b.fv);
    setSolutions(sols);
  }, [cF, cG, range]);

  // grid for contours of f
  const grid = useMemo(() => {
    if (!cF.ok) return null;
    const N = 50;
    const zs = new Float32Array(N*N);
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -range + (2*range)*(i/(N-1));
      const y = -range + (2*range)*(j/(N-1));
      let z = cF.fn({x,y});
      if (!isFinite(z)) z = 0;
      zs[i*N+j] = z;
      if (z < zmin) zmin = z;
      if (z > zmax) zmax = z;
    }
    if (zmin === zmax) zmax = zmin + 1;
    return { zs, N, zmin, zmax };
  }, [cF, range]);

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

    // f contours bg
    for (let i = 0; i < N-1; i++) for (let j = 0; j < N-1; j++) {
      const z = (zs[i*N+j]+zs[(i+1)*N+j]+zs[i*N+j+1]+zs[(i+1)*N+j+1])/4;
      const t = (z - zmin)/(zmax - zmin);
      ctx.fillStyle = `oklch(${0.3 + 0.45*t} 0.1 ${210 - 190*t})`;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x0 + i*tile, y0 + (N-2-j)*tile, tile+0.5, tile+0.5);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#2a2824';
    ctx.strokeRect(x0, y0, mapSize, mapSize);

    // level sets of f
    const nC = 16;
    for (let c = 0; c < nC; c++) {
      const t = (c+0.5)/nC;
      const k = zmin + t*(zmax - zmin);
      ctx.strokeStyle = contourColor(t);
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.55;
      drawContourLevel(ctx, zs, N, k, x0, y0, mapSize, tile);
    }
    ctx.globalAlpha = 1;

    // constraint g = 0 (thick)
    if (cG.ok) {
      const gs = new Float32Array(N*N);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = -range + (2*range)*(i/(N-1));
        const y = -range + (2*range)*(j/(N-1));
        gs[i*N+j] = cG.fn({x,y});
      }
      ctx.strokeStyle = 'oklch(0.74 0.12 200)';
      ctx.lineWidth = 2;
      drawContourLevel(ctx, gs, N, 0, x0, y0, mapSize, tile);

      // level of f passing through solution (highlight tangency)
      if (solutions.length > 0) {
        const sel = mode === 'min' ? solutions[0] : solutions[solutions.length-1];
        ctx.strokeStyle = 'oklch(0.78 0.14 80)';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        drawContourLevel(ctx, zs, N, sel.fv, x0, y0, mapSize, tile);
        ctx.setLineDash([]);
      }
    }

    // solutions
    solutions.forEach((s, i) => {
      const { px, py } = toPx(s.x, s.y);
      const isExt = (mode === 'min' && i === 0) || (mode === 'max' && i === solutions.length - 1);
      ctx.fillStyle = '#0e0e0c';
      ctx.beginPath(); ctx.arc(px, py, isExt ? 9 : 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = isExt ? 'oklch(0.78 0.14 80)' : 'oklch(0.72 0.14 300)';
      ctx.beginPath(); ctx.arc(px, py, isExt ? 5 : 3, 0, Math.PI*2); ctx.fill();
      if (isExt) {
        ctx.strokeStyle = 'oklch(0.78 0.14 80)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(px, py, 14, 0, Math.PI*2); ctx.stroke();
      }
    });

    // legend
    ctx.fillStyle = '#5a564c';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`min / max  f(x,y) = ${exprF}   sous  g(x,y) = ${exprG} = 0`, 16, h - 16);
    // legend swatches
    ctx.fillStyle = 'oklch(0.74 0.12 200)';
    ctx.fillRect(w - 220, h - 38, 14, 2);
    ctx.fillStyle = '#8a8576';
    ctx.fillText('g = 0', w - 200, h - 34);
    ctx.fillStyle = 'oklch(0.78 0.14 80)';
    ctx.fillRect(w - 150, h - 38, 14, 2);
    ctx.fillStyle = '#8a8576';
    ctx.fillText('f = f*', w - 130, h - 34);
  }, [cF, cG, grid, range, solutions, mode]);

  const extremum = solutions.length > 0 ? (mode === 'min' ? solutions[0] : solutions[solutions.length - 1]) : null;

  return (
    <>
      <div className="canvas-wrap">
        <canvas ref={ref} />
        <div className="hud tl">
          <span className="big">Multiplicateurs de Lagrange</span>
          Au point optimal, ∇f est parallèle à ∇g : <em>∇f = λ∇g</em>
        </div>
        {extremum && (
          <div className="hud tr">
            <span className="big" style={{ color: 'oklch(0.78 0.14 80)' }}>f* = {fmt(extremum.fv)}</span>
            <span>({fmt(extremum.x,3)}, {fmt(extremum.y,3)}) · λ = {fmt(extremum.lam)}</span>
          </div>
        )}
      </div>

      <aside className="inspector">
        <h3>Lagrange</h3>
        <div className="subtitle">Module 05 · extrema liés</div>

        <section>
          <SectionLabel>Fonction objectif</SectionLabel>
          <ExprInput label="f(x,y) =" value={exprF} onChange={setExprF} error={!cF.ok} />
        </section>

        <section>
          <SectionLabel>Contrainte g(x,y) = 0</SectionLabel>
          <ExprInput label="g(x,y) =" value={exprG} onChange={setExprG} error={!cG.ok} />
          <div className="examples" style={{ marginTop: 10 }}>
            {[
              ['x^2 + y^2', 'x + y - 1', 'cercle · droite'],
              ['x*y', 'x^2 + y^2 - 1', 'produit · cercle'],
              ['x + y', 'x^2 + y^2 - 2', 'somme · cercle'],
              ['x^2 - y^2', 'x^2 + y^2 - 1', 'selle · cercle'],
              ['x + 2*y', 'x^2 + y^2 - 5', 'linéaire · cercle'],
            ].map((ex, i) => (
              <span key={i} className="chip" onClick={() => { setExprF(ex[0]); setExprG(ex[1]); }}>{ex[2]}</span>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Extremum</SectionLabel>
          <ToggleGroup value={mode} onChange={setMode} options={[
            { value: 'min', label: 'min' }, { value: 'max', label: 'max' },
          ]}/>
        </section>

        <section>
          <SectionLabel aux={`${solutions.length} solutions`}>Solutions critiques</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto' }}>
            {solutions.map((s, i) => (
              <div key={i} style={{
                padding: '6px 10px', fontFamily: 'var(--font-mono)', fontSize: 12,
                background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 4,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>({fmt(s.x,2)}, {fmt(s.y,2)})</span>
                <span style={{ color: 'var(--hot)' }}>f = {fmt(s.fv)}</span>
              </div>
            ))}
            {solutions.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>aucune solution trouvée</div>}
          </div>
        </section>

        <section>
          <Slider label="étendue" min={1} max={5} step={0.5} value={range} onChange={setRange} fmtVal={(v) => `±${v}`} />
        </section>

        <section>
          <Intuition>
            À l'optimum contraint, la courbe de niveau de <em>f</em> est <em>tangente</em> à la contrainte <em>g = 0</em> — elles ne peuvent plus se croiser sans que f change. Donc leurs gradients sont parallèles.
          </Intuition>
        </section>

        <section>
          <DefBox label="système de Lagrange">
            <span className="math">∇f(x, y) = λ ∇g(x, y)</span><br/>
            <span className="math">g(x, y) = 0</span><br/><br/>
            <span style={{ color: 'var(--muted)' }}>3 inconnues (x, y, λ), 3 équations.</span>
          </DefBox>
        </section>
      </aside>
    </>
  );
}

function drawContourLevel(ctx, zs, N, k, x0, y0, mapSize, tile) {
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
    const z00 = zs[i*N+j], z10 = zs[(i+1)*N+j], z01 = zs[i*N+j+1], z11 = zs[(i+1)*N+j+1];
    const p00 = {x: x0 + i*tile, y: y0 + mapSize - j*tile};
    const p10 = {x: x0 + (i+1)*tile, y: y0 + mapSize - j*tile};
    const p01 = {x: x0 + i*tile, y: y0 + mapSize - (j+1)*tile};
    const p11 = {x: x0 + (i+1)*tile, y: y0 + mapSize - (j+1)*tile};
    const idx = (z00>k?1:0)|(z10>k?2:0)|(z11>k?4:0)|(z01>k?8:0);
    if (idx === 0 || idx === 15) continue;
    const lerp=(pa,pb,za,zb)=>{const t=(k-za)/(zb-za);return{x:pa.x+t*(pb.x-pa.x),y:pa.y+t*(pb.y-pa.y)};};
    const eB=()=>lerp(p00,p10,z00,z10),eR=()=>lerp(p10,p11,z10,z11),eT=()=>lerp(p01,p11,z01,z11),eL=()=>lerp(p00,p01,z00,z01);
    const sg=(a,b)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
    switch(idx){case 1:case 14:sg(eB(),eL());break;case 2:case 13:sg(eB(),eR());break;case 3:case 12:sg(eL(),eR());break;case 4:case 11:sg(eT(),eR());break;case 5:sg(eB(),eL());sg(eT(),eR());break;case 6:case 9:sg(eB(),eT());break;case 7:case 8:sg(eT(),eL());break;case 10:sg(eB(),eR());sg(eT(),eL());break;}
  }
}

// solve 3x3 linear system via Cramer
function solve3(A, b) {
  const det = A[0][0]*(A[1][1]*A[2][2] - A[1][2]*A[2][1])
            - A[0][1]*(A[1][0]*A[2][2] - A[1][2]*A[2][0])
            + A[0][2]*(A[1][0]*A[2][1] - A[1][1]*A[2][0]);
  if (Math.abs(det) < 1e-10) return null;
  const dx = b[0]*(A[1][1]*A[2][2] - A[1][2]*A[2][1])
           - A[0][1]*(b[1]*A[2][2] - A[1][2]*b[2])
           + A[0][2]*(b[1]*A[2][1] - A[1][1]*b[2]);
  const dy = A[0][0]*(b[1]*A[2][2] - A[1][2]*b[2])
           - b[0]*(A[1][0]*A[2][2] - A[1][2]*A[2][0])
           + A[0][2]*(A[1][0]*b[2] - b[1]*A[2][0]);
  const dz = A[0][0]*(A[1][1]*b[2] - b[1]*A[2][1])
           - A[0][1]*(A[1][0]*b[2] - b[1]*A[2][0])
           + b[0]*(A[1][0]*A[2][1] - A[1][1]*A[2][0]);
  return [dx/det, dy/det, dz/det];
}

Object.assign(window, { LagrangeModule });
