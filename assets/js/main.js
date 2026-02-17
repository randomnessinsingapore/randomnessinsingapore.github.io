/* =========================
   Main JavaScript file
   ========================= */

/* Run when page loads */
document.addEventListener("DOMContentLoaded", () => {
    console.log("Website loaded successfully");
});

/* Example function (you can reuse later) */
function toggleVisibility(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (el.style.display === "none") {
        el.style.display = "block";
    } else {
        el.style.display = "none";
    }
}


const toggle = document.getElementById("navToggle");
const links = document.getElementById("navLinks");

if (toggle){
  toggle.addEventListener("click", () => {
    links.classList.toggle("open");
  });
}





(function () {
  const canvas = document.getElementById("bgCanvas");
  if (!canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const ctx = canvas.getContext("2d", { alpha: true });

  // ---- Tune these knobs ----
  const GRID_W = 240;          // resolution of the scalar field (lower = faster)
  const GRID_H = 170;
  const LEVELS = 5;            // number of contour levels
  const SPEED = 0.01;         // drift speed
  const FPS = 24;              // cap fps for performance
  const LINE_ALPHA = 1;     // opacity of contour lines
  const LINE_WIDTH = 4;

  // Value-noise parameters
  const NOISE_SCALE = 0.025;   // spatial frequency (smaller = smoother, bigger = busier)

  // --- Resize canvas to device pixels ---
  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    canvas.width = w;
    canvas.height = h;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // --- Deterministic hash -> pseudo random [0,1) ---
  function hash2(i, j) {
    // integer hash (fast, stable)
    let x = i * 374761393 + j * 668265263;
    x = (x ^ (x >> 13)) * 1274126177;
    x ^= x >> 16;
    return (x >>> 0) / 4294967296;
  }

  // --- Small epsilon for matching endpoints ---
const EPS = 1;
console.log(EPS);

// Check if two points are the same
function samePoint(a, b) {
  return Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
}

// Stitch unordered line segments into polylines
function buildPolylines(segments) {
  const lines = [];

  while (segments.length > 0) {
    const seg = segments.pop();
    const line = [
      { x: seg.x1, y: seg.y1 },
      { x: seg.x2, y: seg.y2 }
    ];

    let extended = true;

    while (extended) {
      extended = false;

      for (let i = segments.length - 1; i >= 0; i--) {
        const s = segments[i];

        const start = line[0];
        const end = line[line.length - 1];

        if (samePoint({x:s.x1,y:s.y1}, end)) {
          line.push({x:s.x2,y:s.y2});
        } else if (samePoint({x:s.x2,y:s.y2}, end)) {
          line.push({x:s.x1,y:s.y1});
        } else if (samePoint({x:s.x1,y:s.y1}, start)) {
          line.unshift({x:s.x2,y:s.y2});
        } else if (samePoint({x:s.x2,y:s.y2}, start)) {
          line.unshift({x:s.x1,y:s.y1});
        } else {
          continue;
        }

        segments.splice(i, 1);
        extended = true;
      }
    }

    lines.push(line);
  }

  return lines;
}

// Draw Catmull–Rom spline using cubic Bézier segments
function drawSpline(points) {
  if (points.length < 2) return;

  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;

    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
}


  // Smoothstep interpolation
  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 2D value noise: sample random lattice + bilinear smooth interpolation
  function valueNoise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = x0 + 1, y1 = y0 + 1;
    const sx = smooth(x - x0);
    const sy = smooth(y - y0);

    const n00 = hash2(x0, y0);
    const n10 = hash2(x1, y0);
    const n01 = hash2(x0, y1);
    const n11 = hash2(x1, y1);

    const ix0 = lerp(n00, n10, sx);
    const ix1 = lerp(n01, n11, sx);
    return lerp(ix0, ix1, sy);
  }

  // Optional: add a second octave for nicer “terrain”
  function fbm(x, y) {
    let v = 0;
    let amp = 1;
    let freq = 1;
    let sumAmp = 0;

    for (let o = 0; o < 2; o++) {
      v += amp * valueNoise(x * freq, y * freq);
      sumAmp += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return v / sumAmp;
  }

  // Marching Squares lookup for edge intersections in a cell
  // Edges: 0=top,1=right,2=bottom,3=left
  const CASES = {
    0:  [],
    1:  [[3, 2]],
    2:  [[2, 1]],
    3:  [[3, 1]],
    4:  [[0, 1]],
    5:  [[0, 3], [1, 2]],
    6:  [[0, 2]],
    7:  [[0, 3]],
    8:  [[0, 3]],
    9:  [[0, 2]],
    10: [[0, 1], [2, 3]],
    11: [[0, 1]],
    12: [[3, 1]],
    13: [[2, 1]],
    14: [[3, 2]],
    15: []
  };

  function interp(p1, p2, v1, v2, iso) {
    const t = (iso - v1) / (v2 - v1 + 1e-12);
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  }

  // Compute edge point within cell
  function edgePoint(edge, x, y, vTL, vTR, vBR, vBL, iso) {
    // cell corners in grid coords:
    // TL(x,y), TR(x+1,y), BR(x+1,y+1), BL(x,y+1)
    if (edge === 0) return interp([x, y], [x + 1, y], vTL, vTR, iso);       // top
    if (edge === 1) return interp([x + 1, y], [x + 1, y + 1], vTR, vBR, iso); // right
    if (edge === 2) return interp([x + 1, y + 1], [x, y + 1], vBR, vBL, iso); // bottom
    return interp([x, y + 1], [x, y], vBL, vTL, iso);                         // left
  }

  // Main draw loop
  let t = 0;
  let last = 0;

  function frame(ts) {
    if (ts - last < 1000 / FPS) {
      requestAnimationFrame(frame);
      return;
    }
    last = ts;

    const W = canvas.width;
    const H = canvas.height;

    // We draw in canvas pixels; map grid to screen
    ctx.clearRect(0, 0, W, H);

    // Background fade (optional, keep subtle)
    // ctx.fillStyle = "rgba(255, 0, 0, 0.03)";
    // ctx.fillRect(0, 0, W, H);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = `rgba(2,6,32,${LINE_ALPHA})`;
    ctx.lineWidth = LINE_WIDTH;

    // Precompute scalar field on a coarse grid
    // Scale so grid spans the view with some margin
    const gxToX = W / (GRID_W - 1);
    const gyToY = H / (GRID_H - 1);

    const field = new Float32Array(GRID_W * GRID_H);
    

    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const nx = (gx * NOISE_SCALE);
        const ny = (gy * NOISE_SCALE);

        // fbm gives a more “terrain” feel than pure valueNoise
        field[gy * GRID_W + gx] = fbm(nx, ny);
      }
    }

    // Draw contours for multiple iso-levels
    for (let li = 1; li <= LEVELS; li++) {

      const base = li / (LEVELS + 1);

      // altitude modulation: small sinusoidal shift
      const amp = 0.07;            // how much the contours move (0.03–0.12 is nice)
      const omega = 0.22;          // speed (smaller = slower)
      const phase = li * 0.65;  // per-level phase offset
      const iso = base + amp * Math.sin(omega * t + phase);

      const segments = [];

      for (let y = 0; y < GRID_H - 1; y++) {
        for (let x = 0; x < GRID_W - 1; x++) {
          const vTL = field[y * GRID_W + x];
          const vTR = field[y * GRID_W + (x + 1)];
          const vBL = field[(y + 1) * GRID_W + x];
          const vBR = field[(y + 1) * GRID_W + (x + 1)];

          const c =
            (vTL > iso ? 8 : 0) |
            (vTR > iso ? 4 : 0) |
            (vBR > iso ? 2 : 0) |
            (vBL > iso ? 1 : 0);

          const segs = CASES[c];
          if (!segs || segs.length === 0) continue;

          for (const [e1, e2] of segs) {
            const p1 = edgePoint(e1, x, y, vTL, vTR, vBR, vBL, iso);
            const p2 = edgePoint(e2, x, y, vTL, vTR, vBR, vBL, iso);

            segments.push({
              x1: p1[0] * gxToX,
              y1: p1[1] * gyToY,
              x2: p2[0] * gxToX,
              y2: p2[1] * gyToY
            });
          }
        }
      }

      const polylines = buildPolylines(segments);

      ctx.beginPath();
      for (const line of polylines) {
        drawSpline(line);
      }

      ctx.globalAlpha = 0.75 + 0.25 * (li / LEVELS);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;

    t += SPEED;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
