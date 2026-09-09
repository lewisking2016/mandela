/**
 * trace-logo.mjs — trace frontend/mandela.png to a single SVG path (posterized
 * to 2 levels: dark ink vs paper) and emit a compact SVG path string.
 *
 * The mark is monochrome ink on white, so luminance thresholding is enough.
 * The result is stored in school_settings.logo_svg_path — the logo is DATA,
 * rendered by bootstrap consumers, never a bundled asset.
 */
import fs from "node:fs";
import zlib from "node:zlib";

function decodePng(path) {
  const buf = fs.readFileSync(path);
  let off = 8, ihdr = null; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ct: data[9], il: data[12] };
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (ihdr.depth !== 8 || ihdr.ct !== 2 || ihdr.il !== 0) throw new Error("unsupported " + JSON.stringify(ihdr));
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * 3;
  const px = Buffer.alloc(ihdr.w * ihdr.h * 3);
  const prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const f = raw[pos++];
    const line = raw.subarray(pos, pos + stride); pos += stride;
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= 3 ? cur[i - 3] : 0, b = prev[i], c = i >= 3 ? prev[i - 3] : 0;
      let v = line[i];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[i] = v;
    }
    cur.copy(px, y * stride); cur.copy(prev);
  }
  return { w: ihdr.w, h: ihdr.h, px };
}

// --- threshold to a binary grid (downsampled to ~96px wide for a compact path)
const { w, h, px } = decodePng(process.argv[2] ?? "frontend/mandela.png");
const TARGET = 96;
const scale = TARGET / w;
const gw = TARGET, gh = Math.max(1, Math.round(h * scale));
const grid = [];

for (let gy = 0; gy < gh; gy++) {
  let row = "";
  for (let gx = 0; gx < gw; gx++) {
    // average luminance over the source block; ink if clearly dark
    let sum = 0, n = 0;
    const x0 = Math.floor(gx / scale), x1 = Math.max(x0 + 1, Math.floor((gx + 1) / scale));
    const y0 = Math.floor(gy / scale), y1 = Math.max(y0 + 1, Math.floor((gy + 1) / scale));
    for (let y = y0; y < Math.min(y1, h); y++) {
      for (let x = x0; x < Math.min(x1, w); x++) {
        const i = (y * w + x) * 3;
        sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
        n++;
      }
    }
    const lum = n ? sum / n : 255;
    row += lum < 128 ? "1" : "0"; // 1 = ink
  }
  grid.push(row);
}

// --- run-length squares path (crisp pixel-art style, very compact)
// Emit horizontal runs of ink per row as M x y h len v 1 h -len z rectangles.
let d = "";
const rects = [];
for (let y = 0; y < gh; y++) {
  let x = 0;
  while (x < gw) {
    if (grid[y][x] === "1") {
      let len = 1;
      while (x + len < gw && grid[y][x + len] === "1") len++;
      // merge vertically with the rect above when widths & x align? keep simple: emit row runs
      rects.push([x, y, len]);
      x += len;
    } else x++;
  }
}
// merge same-x same-width runs across consecutive rows (greedy vertical merge)
const used = new Array(rects.length).fill(false);
const merged = [];
const byRow = new Map();
rects.forEach((r, i) => {
  const key = r[1];
  if (!byRow.has(key)) byRow.set(key, []);
  byRow.get(key).push(i);
});
for (let i = 0; i < rects.length; i++) {
  if (used[i]) continue;
  let [x, y, len] = rects[i];
  used[i] = true;
  let height = 1;
  let cur = i;
  while (true) {
    const nextRow = byRow.get(y + height) ?? [];
    const found = nextRow.findIndex((j) => !used[j] && rects[j][0] === x && rects[j][2] === len);
    if (found === -1) break;
    used[nextRow[found]] = true;
    height++;
    y = y; // unchanged
    void cur; cur = nextRow[found];
  }
  merged.push([x, rects[i][1], len, height]);
}
for (const [x, y, w2, h2] of merged) {
  d += `M${x} ${y}h${w2}v${h2}h-${w2}z`;
}
const aspect = (h / w).toFixed(4);
const out = { d, aspect: Number(aspect), w: gw, h: gh, inkCells: merged.reduce((s, m) => s + m[2] * m[3], 0) };
fs.writeFileSync(process.argv[3] ?? "scripts/logo-traced.json", JSON.stringify(out));
console.log(`traced ${w}x${h} -> ${gw}x${gh} grid, ${merged.length} rects, path ${d.length} chars`);
