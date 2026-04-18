// Shared UI primitives and drawing helpers

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } = React;

// ---------- canvas hook with DPR + auto-resize ----------
function useCanvas(draw, deps = []) {
  const ref = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      sizeRef.current = { w, h, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const canvas = ref.current;
    if (!canvas) return;
    const render = () => {
      const { w, h, dpr } = sizeRef.current;
      if (w === 0 || h === 0) { raf = requestAnimationFrame(render); return; }
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      draw(ctx, w, h);
      ctx.restore();
    };
    render();
    // repaint on size change
    const ro = new ResizeObserver(() => render());
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  // eslint-disable-next-line
  }, deps);

  return ref;
}

// ---------- Animation loop hook ----------
function useAnimatedCanvas(draw, deps = []) {
  const ref = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const tRef = useRef(0);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth, h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      sizeRef.current = { w, h, dpr };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tRef.current += dt;
      const { w, h, dpr } = sizeRef.current;
      if (w > 0) {
        ctx.save();
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(ctx, w, h, tRef.current, dt);
        ctx.restore();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line
  }, deps);

  return ref;
}

// ---------- 3D projection (simple rotation + orthographic) ----------
// yaw (around Y), pitch (around X). Returns {project(x,y,z) -> [px,py,depth]}
function makeProjector({ yaw, pitch, scale, cx, cy }) {
  const cy1 = Math.cos(pitch), sy1 = Math.sin(pitch);
  const cy2 = Math.cos(yaw), sy2 = Math.sin(yaw);
  return {
    project(x, y, z) {
      // rotate around Y (yaw)
      const x1 = cy2 * x + sy2 * z;
      const z1 = -sy2 * x + cy2 * z;
      // rotate around X (pitch)
      const y2 = cy1 * y - sy1 * z1;
      const z2 = sy1 * y + cy1 * z1;
      return [cx + x1 * scale, cy - y2 * scale, z2];
    }
  };
}

// ---------- Inputs ----------
function ExprInput({ label = 'f(x,y) =', value, onChange, error, mono }) {
  return (
    <div className={`input-row ${error ? 'error' : ''}`}>
      <span className="eq">{label}</span>
      <input
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        style={mono ? { fontFamily: 'var(--font-mono)' } : {}}
      />
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange, fmtVal }) {
  return (
    <div className="slider-row">
      <span className="slabel">{label}</span>
      <span className="svalue">{fmtVal ? fmtVal(value) : value.toFixed(2)}</span>
      <input
        className="track"
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="toggle-group">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chips({ items, onPick }) {
  return (
    <div className="examples">
      {items.map((it, i) => (
        <span key={i} className="chip" onClick={() => onPick(it)}>{it}</span>
      ))}
    </div>
  );
}

function SectionLabel({ children, aux }) {
  return <div className="section-label"><span>{children}</span>{aux && <span>{aux}</span>}</div>;
}

function Intuition({ children }) {
  return <div className="intuition">{children}</div>;
}

function DefBox({ label, children }) {
  return (
    <div className="defbox">
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

// KV table
function KV({ rows }) {
  return (
    <div className="kv">
      {rows.map((r, i) => (
        <React.Fragment key={i}>
          <span className="k">{r.k}</span>
          <span className={'v ' + (r.tone || '')}>{r.v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

// HSL-esque warm palette step for contours
function contourColor(t) {
  // t in [0,1]
  // yellow -> coral -> violet
  const hue = 80 - 60 * t + (t > 0.7 ? -60 * (t - 0.7) : 0);
  const L = 0.78 - 0.08 * Math.abs(t - 0.5);
  return `oklch(${L} 0.14 ${hue})`;
}

// Draw thin axes + grid for 2D cartesian plots
function drawAxes2D(ctx, { w, h, xmin, xmax, ymin, ymax, steps = 10, color = '#2a2824', sub = '#1c1b17', labels = true }) {
  const toX = (x) => ((x - xmin) / (xmax - xmin)) * w;
  const toY = (y) => h - ((y - ymin) / (ymax - ymin)) * h;
  ctx.save();
  ctx.lineWidth = 1;
  // grid
  ctx.strokeStyle = sub;
  for (let i = 0; i <= steps; i++) {
    const x = xmin + (i / steps) * (xmax - xmin);
    const y = ymin + (i / steps) * (ymax - ymin);
    ctx.beginPath(); ctx.moveTo(toX(x), 0); ctx.lineTo(toX(x), h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, toY(y)); ctx.lineTo(w, toY(y)); ctx.stroke();
  }
  // axes
  ctx.strokeStyle = color;
  if (xmin <= 0 && xmax >= 0) {
    ctx.beginPath(); ctx.moveTo(toX(0), 0); ctx.lineTo(toX(0), h); ctx.stroke();
  }
  if (ymin <= 0 && ymax >= 0) {
    ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(w, toY(0)); ctx.stroke();
  }
  if (labels) {
    ctx.fillStyle = '#5a564c';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('x', w - 10, toY(0) - 4);
    ctx.fillText('y', toX(0) + 4, 10);
  }
  ctx.restore();
  return { toX, toY };
}

// arrowhead on (x1,y1)->(x2,y2)
function arrow(ctx, x1, y1, x2, y2, size = 5) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(a - 0.4), y2 - size * Math.sin(a - 0.4));
  ctx.lineTo(x2 - size * Math.cos(a + 0.4), y2 - size * Math.sin(a + 0.4));
  ctx.closePath();
  ctx.fill();
}

Object.assign(window, {
  useCanvas, useAnimatedCanvas, makeProjector,
  ExprInput, Slider, ToggleGroup, Chips, SectionLabel, Intuition, DefBox, KV,
  contourColor, drawAxes2D, arrow,
});
