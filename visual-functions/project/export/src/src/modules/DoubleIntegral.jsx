// Module: Intégrale double ∬_D f dA avec domaine défini par une inégalité

function DoubleIntegralModule() {
  const [exprF, setExprF] = useState('x^2 + y^2');
  const [exprD, setExprD] = useState('x^2 + y^2 - 1'); // domaine : D(x,y) <= 0
  const [cF, setCF] = useState(() => safeCompile('x^2 + y^2'));
  const [cD, setCD] = useState(() => safeCompile('x^2 + y^2 - 1'));
  const [range, setRange] = useState(2);
  const [resolution, setResolution] = useState(100);

  useEffect(() => { const r = safeCompile(exprF); if (r.ok) setCF(r); }, [exprF]);
  useEffect(() => { const r = safeCompile(exprD); if (r.ok) setCD(r); }, [exprD]);

  // Riemann sum
  const { sum, area } = useMemo(() => {
    if (!cF.ok || !cD.ok) return { sum: 0, area: 0 };
    const N = resolution;
    const dx = (2*range) / N;
    const dA = dx * dx;
    let s = 0, a = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -range + dx*(i + 0.5);
      const y = -range + dx*(j + 0.5);
      if (cD.fn({x,y}) <= 0) {
        s += cF.fn({x,y}) * dA;
        a += dA;
      }
    }
    return { sum: s, area: a };
  }, [cF, cD, range, resolution]);

  const ref = useCanvas((ctx, w, h) => {
    if (!cF.ok || !cD.ok) return;
    const mapSize = Math.min(w - 60, h - 80);
    const x0 = w/2 - mapSize/2, y0 = h/2 - mapSize/2;
    const N = Math.min(60, resolution);
    const tile = mapSize / N;
    const dx = (2*range) / N;
    // find f range within D
    let zmin = Infinity, zmax = -Infinity;
    const zs = new Float32Array(N*N);
    const ins = new Uint8Array(N*N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -range + dx*(i+0.5);
      const y = -range + dx*(j+0.5);
      const inD = cD.fn({x,y}) <= 0;
      ins[i*N+j] = inD ? 1 : 0;
      const z = cF.fn({x,y});
      zs[i*N+j] = z;
      if (inD && isFinite(z)) { if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
    }
    if (!isFinite(zmin)) { zmin = 0; zmax = 1; }
    if (zmin === zmax) zmax = zmin + 1;

    // draw all tiles - outside D dimmed
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const inD = ins[i*N+j];
      if (!inD) {
        ctx.fillStyle = '#17161300';
      } else {
        const t = (zs[i*N+j] - zmin) / (zmax - zmin);
        ctx.fillStyle = `oklch(${0.35 + 0.45*t} 0.13 ${210 - 190*t})`;
      }
      ctx.globalAlpha = inD ? 0.85 : 0.06;
      ctx.fillRect(x0 + i*tile, y0 + mapSize - (j+1)*tile, tile + 0.5, tile + 0.5);
    }
    ctx.globalAlpha = 1;

    // grid overlay (hairline)
    ctx.strokeStyle = 'rgba(14,14,12,0.4)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= N; i++) {
      ctx.beginPath(); ctx.moveTo(x0 + i*tile, y0); ctx.lineTo(x0 + i*tile, y0 + mapSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0 + i*tile); ctx.lineTo(x0 + mapSize, y0 + i*tile); ctx.stroke();
    }

    // boundary curve g=0 via contour
    const gs = new Float32Array(N*N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = -range + dx*(i+0.5);
      const y = -range + dx*(j+0.5);
      gs[i*N+j] = cD.fn({x,y});
    }
    ctx.strokeStyle = 'oklch(0.78 0.14 80)';
    ctx.lineWidth = 2;
    drawContourLevelD(ctx, gs, N, 0, x0, y0, mapSize, tile);

    // frame
    ctx.strokeStyle = '#2a2824';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0, y0, mapSize, mapSize);

    // axes ticks
    ctx.fillStyle = '#5a564c';
    ctx.font = '9.5px "JetBrains Mono", monospace';
    for (let i = 0; i <= 4; i++) {
      const xv = -range + (2*range)*(i/4);
      ctx.fillText(xv.toFixed(1), x0 + (i/4)*mapSize - 8, y0 + mapSize + 12);
      ctx.fillText(xv.toFixed(1), x0 - 22, y0 + mapSize - (i/4)*mapSize + 3);
    }

    // caption
    ctx.fillStyle = '#5a564c';
    ctx.font = '10.5px "JetBrains Mono", monospace';
    ctx.fillText(`D = { (x,y) : ${exprD} ≤ 0 }`, 16, h - 30);
    ctx.fillText(`intégrande : ${exprF}`, 16, h - 14);
  }, [cF, cD, range, resolution]);

  return (
    <>
      <div className="canvas-wrap">
        <canvas ref={ref} />
        <div className="hud tl">
          <span className="big">Intégrale double ∬_D f dA</span>
          somme de Riemann sur un domaine défini par inégalité
        </div>
        <div className="hud tr">
          <span className="big" style={{ color: 'oklch(0.78 0.14 80)' }}>∬ f dA ≈ {fmt(sum, 4)}</span>
          <span>aire(D) ≈ {fmt(area, 4)}</span>
        </div>
      </div>

      <aside className="inspector">
        <h3>Intégrale double</h3>
        <div className="subtitle">Module 06 · ∬_D f(x,y) dA</div>

        <section>
          <SectionLabel>Intégrande f</SectionLabel>
          <ExprInput label="f(x,y) =" value={exprF} onChange={setExprF} error={!cF.ok} />
        </section>

        <section>
          <SectionLabel>Domaine D : g(x,y) ≤ 0</SectionLabel>
          <ExprInput label="g(x,y) =" value={exprD} onChange={setExprD} error={!cD.ok} />
          <div className="examples" style={{ marginTop: 10 }}>
            {[
              ['x^2 + y^2', 'x^2 + y^2 - 1', 'x²+y² sur disque'],
              ['1', 'x^2 + y^2 - 1', 'aire du disque'],
              ['x*y', 'x^2 + 4*y^2 - 1', 'ellipse'],
              ['exp(-(x^2+y^2))', 'x^2 + y^2 - 4', 'gaussienne'],
              ['x + y', 'abs(x) + abs(y) - 1', 'losange'],
              ['sin(x)*cos(y)', 'max(abs(x),abs(y)) - 1', 'carré'],
            ].map((ex, i) => (
              <span key={i} className="chip" onClick={() => { setExprF(ex[0]); setExprD(ex[1]); }}>{ex[2]}</span>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Résultat</SectionLabel>
          <KV rows={[
            { k: '∬ f dA', v: fmt(sum, 5), tone: 'hot' },
            { k: 'aire(D)', v: fmt(area, 5), tone: 'teal' },
            { k: 'f̄ (moy.)', v: area > 0 ? fmt(sum / area, 4) : '—' },
          ]}/>
        </section>

        <section>
          <SectionLabel>Paramètres</SectionLabel>
          <Slider label="étendue" min={1} max={5} step={0.5} value={range} onChange={setRange} fmtVal={(v) => `±${v}`} />
          <Slider label="résolution" min={40} max={240} step={10} value={resolution} onChange={setResolution} fmtVal={(v) => `${v}²`} />
        </section>

        <section>
          <Intuition>
            L'intégrale double est la limite d'une <em>somme de Riemann</em> : on pave D de petits carrés, on échantillonne f au centre, on multiplie par l'aire. Augmenter la résolution améliore la précision.
          </Intuition>
        </section>

        <section>
          <DefBox label="définition">
            <span className="math">∬<sub>D</sub> f dA = lim<sub>n→∞</sub> Σ<sub>i,j</sub> f(x<sub>ij</sub>, y<sub>ij</sub>) · ΔA</span><br/><br/>
            <span style={{ color: 'var(--muted)' }}>ici D = {'{'} (x,y) : g(x,y) ≤ 0 {'}'}</span>
          </DefBox>
        </section>
      </aside>
    </>
  );
}

function drawContourLevelD(ctx, zs, N, k, x0, y0, mapSize, tile) {
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
    const z00 = zs[i*N+j], z10 = zs[(i+1)*N+j], z01 = zs[i*N+j+1], z11 = zs[(i+1)*N+j+1];
    const p00 = {x: x0 + (i+0.5)*tile, y: y0 + mapSize - (j+0.5)*tile};
    const p10 = {x: x0 + (i+1.5)*tile, y: y0 + mapSize - (j+0.5)*tile};
    const p01 = {x: x0 + (i+0.5)*tile, y: y0 + mapSize - (j+1.5)*tile};
    const p11 = {x: x0 + (i+1.5)*tile, y: y0 + mapSize - (j+1.5)*tile};
    const idx = (z00>k?1:0)|(z10>k?2:0)|(z11>k?4:0)|(z01>k?8:0);
    if (idx === 0 || idx === 15) continue;
    const lerp=(pa,pb,za,zb)=>{const t=(k-za)/(zb-za);return{x:pa.x+t*(pb.x-pa.x),y:pa.y+t*(pb.y-pa.y)};};
    const eB=()=>lerp(p00,p10,z00,z10),eR=()=>lerp(p10,p11,z10,z11),eT=()=>lerp(p01,p11,z01,z11),eL=()=>lerp(p00,p01,z00,z01);
    const sg=(a,b)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
    switch(idx){case 1:case 14:sg(eB(),eL());break;case 2:case 13:sg(eB(),eR());break;case 3:case 12:sg(eL(),eR());break;case 4:case 11:sg(eT(),eR());break;case 5:sg(eB(),eL());sg(eT(),eR());break;case 6:case 9:sg(eB(),eT());break;case 7:case 8:sg(eT(),eL());break;case 10:sg(eB(),eR());sg(eT(),eL());break;}
  }
}

Object.assign(window, { DoubleIntegralModule });
