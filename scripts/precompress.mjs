/**
 * Writes .br and .gz next to every text asset in dist/ at maximum compression.
 * Apache serves them directly (see public/.htaccess) – no CPU work per request.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const EXT = /\.(html|css|js|mjs|json|xml|svg|txt|webmanifest)$/;
let count = 0, before = 0, after = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.test(e.name)) compress(p);
  }
}
function compress(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 512) return;
  const br = zlib.brotliCompressSync(buf, {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length },
  });
  const gz = zlib.gzipSync(buf, { level: 9 });
  fs.writeFileSync(`${file}.br`, br);
  fs.writeFileSync(`${file}.gz`, gz);
  count++;
  before += buf.length;
  after += br.length;
}

walk('dist');
console.log(`[precompress] ${count} files, ${(before / 1024).toFixed(0)} KiB → ${(after / 1024).toFixed(0)} KiB (brotli)`);
