// Math expression parser + evaluator
// Supports: +, -, *, /, ^, unary -, parentheses, functions, constants
// Returns a compiled function (vars) => number

const FUNCS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  exp: Math.exp, log: Math.log, ln: Math.log, log10: Math.log10, log2: Math.log2,
  sqrt: Math.sqrt, cbrt: Math.cbrt,
  abs: Math.abs, sign: Math.sign,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max,
  pow: Math.pow,
};
const CONSTS = { pi: Math.PI, PI: Math.PI, e: Math.E, E: Math.E, tau: Math.PI * 2 };

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const s = src;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      // scientific e
      if (j < s.length && (s[j] === 'e' || s[j] === 'E') && /[0-9+-]/.test(s[j+1] || '')) {
        j++;
        if (s[j] === '+' || s[j] === '-') j++;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      tokens.push({ type: 'num', val: parseFloat(s.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z0-9_]/.test(s[j])) j++;
      tokens.push({ type: 'id', val: s.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/^(),'.includes(c)) {
      tokens.push({ type: 'op', val: c });
      i++;
      continue;
    }
    throw new Error(`caractère inattendu: "${c}"`);
  }
  return tokens;
}

// Recursive-descent parser -> AST
function parse(src) {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (t, v) => {
    const tk = tokens[pos];
    if (!tk) throw new Error('fin d\'expression inattendue');
    if (tk.type !== t || (v !== undefined && tk.val !== v)) throw new Error(`attendu "${v ?? t}", trouvé "${tk.val}"`);
    pos++;
    return tk;
  };

  function parseExpr() {
    let left = parseTerm();
    while (peek() && peek().type === 'op' && (peek().val === '+' || peek().val === '-')) {
      const op = eat('op').val;
      const right = parseTerm();
      left = { type: 'bin', op, a: left, b: right };
    }
    return left;
  }
  function parseTerm() {
    let left = parseUnary();
    while (peek() && peek().type === 'op' && (peek().val === '*' || peek().val === '/')) {
      const op = eat('op').val;
      const right = parseUnary();
      left = { type: 'bin', op, a: left, b: right };
    }
    return left;
  }
  function parseUnary() {
    if (peek() && peek().type === 'op' && (peek().val === '-' || peek().val === '+')) {
      const op = eat('op').val;
      const v = parseUnary();
      return op === '-' ? { type: 'neg', a: v } : v;
    }
    return parsePow();
  }
  function parsePow() {
    const base = parseAtom();
    if (peek() && peek().type === 'op' && peek().val === '^') {
      eat('op', '^');
      const exp = parseUnary(); // right-assoc
      return { type: 'bin', op: '^', a: base, b: exp };
    }
    return base;
  }
  function parseAtom() {
    const tk = peek();
    if (!tk) throw new Error('expression vide');
    if (tk.type === 'num') { pos++; return { type: 'num', val: tk.val }; }
    if (tk.type === 'id') {
      pos++;
      // function call?
      if (peek() && peek().type === 'op' && peek().val === '(') {
        eat('op', '(');
        const args = [];
        if (!(peek() && peek().type === 'op' && peek().val === ')')) {
          args.push(parseExpr());
          while (peek() && peek().type === 'op' && peek().val === ',') {
            eat('op', ','); args.push(parseExpr());
          }
        }
        eat('op', ')');
        return { type: 'call', name: tk.val, args };
      }
      return { type: 'var', name: tk.val };
    }
    if (tk.type === 'op' && tk.val === '(') {
      eat('op', '(');
      const e = parseExpr();
      eat('op', ')');
      return e;
    }
    throw new Error(`jeton inattendu: ${tk.val}`);
  }

  const ast = parseExpr();
  if (pos !== tokens.length) throw new Error('entrée non consommée entièrement');
  return ast;
}

function evalAST(node, vars) {
  switch (node.type) {
    case 'num': return node.val;
    case 'neg': return -evalAST(node.a, vars);
    case 'var':
      if (node.name in vars) return vars[node.name];
      if (node.name in CONSTS) return CONSTS[node.name];
      return NaN;
    case 'call': {
      const fn = FUNCS[node.name];
      if (!fn) throw new Error(`fonction inconnue: ${node.name}`);
      const args = node.args.map(a => evalAST(a, vars));
      return fn(...args);
    }
    case 'bin': {
      const a = evalAST(node.a, vars), b = evalAST(node.b, vars);
      switch (node.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '^': return Math.pow(a, b);
      }
    }
  }
}

function compile(expr) {
  const ast = parse(expr);
  const fn = (vars) => evalAST(ast, vars);
  fn.ast = ast;
  fn.src = expr;
  return fn;
}

// Tries to compile, returns {ok, fn, err}
function safeCompile(expr) {
  try {
    const fn = compile(expr);
    // test-evaluate with sample values to detect eval-time issues quickly
    const t = fn({ x: 0.5, y: 0.3, z: 0.1, t: 0.5, r: 0.7, theta: 0.4, u: 0.2, v: 0.6 });
    return { ok: true, fn, err: null };
  } catch (e) {
    return { ok: false, fn: null, err: e.message };
  }
}

// Reusable mutable objects — avoids heap allocation in hot paths.
// evalAST only reads vars, never stores references, so in-place mutation + restore is safe.
// grad2 uses two buffers (_g2a / _g2b) to handle Lagrange's nested grad2(v => grad2(...)) calls.
const _g2a = { x: 0, y: 0 };
const _g2b = { x: 0, y: 0 };
let _g2depth = 0;
const _hv = { x: 0, y: 0 };

// Numeric partial derivative via central difference
// NOTE: vars is temporarily mutated and restored; do not share vars across concurrent calls.
function partial(f, vars, key, h = 1e-4) {
  const orig = vars[key];
  vars[key] = orig + h; const fp = f(vars);
  vars[key] = orig - h; const fm = f(vars);
  vars[key] = orig;
  return (fp - fm) / (2 * h);
}

// Gradient for f(x, y)
function grad2(f, x, y, h = 1e-4) {
  const v = _g2depth === 0 ? _g2a : _g2b;
  _g2depth++;
  v.x = x + h; v.y = y;     const fx_p = f(v);
  v.x = x - h;              const fx_m = f(v);
  v.x = x;     v.y = y + h; const fy_p = f(v);
               v.y = y - h; const fy_m = f(v);
  v.x = x;     v.y = y;
  _g2depth--;
  return [(fx_p - fx_m) / (2 * h), (fy_p - fy_m) / (2 * h)];
}

// Hessian for f(x, y)
function hess2(f, x, y, h = 1e-3) {
  _hv.x = x;     _hv.y = y;     const f00 = f(_hv);
  _hv.x = x + h;                const fph = f(_hv);
  _hv.x = x - h;                const fmh = f(_hv);
  _hv.x = x;     _hv.y = y + h; const f0p = f(_hv);
                 _hv.y = y - h; const f0m = f(_hv);
  const fxx = (fph - 2*f00 + fmh) / (h*h);
  const fyy = (f0p - 2*f00 + f0m) / (h*h);
  _hv.x = x + h; _hv.y = y + h; const fpp = f(_hv);
  _hv.x = x + h; _hv.y = y - h; const fpm = f(_hv);
  _hv.x = x - h; _hv.y = y + h; const fmp = f(_hv);
  _hv.x = x - h; _hv.y = y - h; const fmm = f(_hv);
  _hv.x = x;     _hv.y = y;
  const fxy = (fpp - fpm - fmp + fmm) / (4*h*h);
  return [[fxx, fxy], [fxy, fyy]];
}

// format number for display
function fmt(n, d = 3) {
  if (!isFinite(n)) return '—';
  if (Math.abs(n) < 1e-10) return '0';
  if (Math.abs(n) < 1e-3 || Math.abs(n) >= 1e4) return n.toExponential(2);
  return n.toFixed(d);
}

Object.assign(window, { compile, safeCompile, partial, grad2, hess2, fmt, FUNCS, CONSTS });
