// node pack.mjs：画扩展图标（像素风的 </>），再把扩展打成 zip，放到网站的 site/public/hot100-sync.zip 供下载。
// 只用 Node 自带的模块：PNG 和 zip 都是手写的最小实现（zip 用不压缩的 store 方式）。
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

// ---- 图标：16×16 的像素图，# 是白色，/ 是蓝色，背景是带圆角的黑色 ----
const ART = [
  "................",
  "................",
  "................",
  "..........//....",
  "...##.....//.##.",
  "..##.....//...##",
  ".##......//....#",
  "##......//.....#",
  "##......//.....#",
  ".##....//......#",
  "..##...//.....##",
  "...##.//.....##.",
  "......//........",
  "................",
  "................",
  "................",
];
// 只用每行的前 10 格（< 和 /），右边的 > 用左边镜像画出来，保证左右对称
const GLYPH = ART.map((r) => { const left = r.slice(0, 6), mid = r.slice(6, 10); const right = [...left].reverse().join(""); return left + mid + right; });
const WHITE = [255, 255, 255, 255], BLUE = [10, 132, 255, 255], BG = [17, 17, 17, 255], CLEAR = [0, 0, 0, 0];
function pixel(x, y, n) {
  // n×n 的画布，每个像素格 n/16 大；四角留出圆角
  const c = n / 16, gx = Math.floor(x / c), gy = Math.floor(y / c), r = 3 * c;
  const dx = Math.max(r - x - 0.5, x + 0.5 - (n - r), 0), dy = Math.max(r - y - 0.5, y + 0.5 - (n - r), 0);
  if (dx * dx + dy * dy > r * r) return CLEAR;
  const ch = GLYPH[gy][gx];
  return ch === "#" ? WHITE : ch === "/" ? BLUE : BG;
}
function png(n) {
  const raw = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) Buffer.from(pixel(x, y, n)).copy(raw, y * (n * 4 + 1) + 1 + x * 4);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
fs.mkdirSync(path.join(dir, "icons"), { recursive: true });
for (const n of [16, 32, 48, 128]) fs.writeFileSync(path.join(dir, "icons", `${n}.png`), png(n));

// ---- zip ----
const FILES = ["manifest.json", "background.js", "app.html", "app.css", "app.js", "core.js", "github.js", "leetcode.js", "sync.js", "icons/16.png", "icons/32.png", "icons/48.png", "icons/128.png"];
const ROOT = "hot100-sync/";
const locals = [], centrals = [];
let offset = 0;
for (const f of FILES) {
  const data = fs.readFileSync(path.join(dir, f)), name = Buffer.from(ROOT + f, "utf8"), crc = crc32(data);
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
  h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22);
  h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
  locals.push(h, name, data);
  const c = Buffer.alloc(46);
  c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
  c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
  c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
  centrals.push(c, name);
  offset += 30 + name.length + data.length;
}
const cd = Buffer.concat(centrals), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(FILES.length, 8); end.writeUInt16LE(FILES.length, 10);
end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
const out = path.join(dir, "..", "site", "public", "hot100-sync.zip");
fs.writeFileSync(out, Buffer.concat([...locals, cd, end]));
const version = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")).version;
console.log(`icons + ${path.relative(path.join(dir, ".."), out)} (v${version}, ${FILES.length} files, ${Buffer.concat([...locals, cd, end]).length} bytes)`);
