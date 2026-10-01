import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'assets', 'vedoy-icons');
const sources = ['11.png', '12.png', '13.png'].map((name) => path.join('C:/Users/leand/Downloads', name));
const names = [
  ['checklist', 'ruler', 'woven-pattern', 'lightbulb', 'open-book', 'people-exchange', 'analytics-search', 'document-edit', 't-shirt', 'rolled-paper', 'chat-bubbles', 'search', 'handshake', 'price-tag', 'settings', 'home', 'team', 'information', 'megaphone', 'undo', 'close'],
  ['gift', 'smartphone', 'laptop', 'desktop-computer', 'storefront', 'add', 'remove', 'shopping-cart', 'closed-sign', 'shield', 'warning', 'medical-cross', 'alert', 'settings-bold', 'location-pin', 'dollar', 'checkmark', 'lightning', 'refresh', 'sync', 'user'],
  ['group', 'delivery-truck', 'target', 'notification-bell', 'globe', 'payment-card', 'phone-call', 'clock', 'download-tray', 'calendar', 'package', 'email', 'shopping-bag', 'download', 'location-pin-2', 'dollar-2', 'checkmark-2', 'lightning-2', 'refresh-2', 'sync-2', 'verified-shield'],
];
const categories = [
  ['Productivity', 'Tools', 'Patterns', 'Ideas', 'Learning', 'People', 'Analytics', 'Documents', 'Apparel', 'Materials', 'Communication', 'Search', 'Business', 'Commerce', 'System', 'Places', 'People', 'Information', 'Marketing', 'Navigation', 'Actions'],
  ['Commerce', 'Devices', 'Devices', 'Devices', 'Commerce', 'Actions', 'Actions', 'Commerce', 'Commerce', 'Security', 'Alerts', 'Health', 'Alerts', 'System', 'Places', 'Commerce', 'Status', 'System', 'Actions', 'Actions', 'People'],
  ['People', 'Delivery', 'Goals', 'Communication', 'Places', 'Commerce', 'Communication', 'Time', 'Actions', 'Time', 'Delivery', 'Communication', 'Commerce', 'Actions', 'Places', 'Commerce', 'Status', 'System', 'Actions', 'Actions', 'Security'],
];
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i += 1) {
  let c = i;
  for (let j = 0; j < 8; j += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[i] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, payload) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(payload.length, 0);
  head.write(type, 4, 4, 'ascii');
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), payload])), 0);
  return Buffer.concat([head, payload, tail]);
}
function encodePng(size, rgba) {
  const scan = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) rgba.copy(scan, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(scan, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}
function decodePng(file) {
  const data = fs.readFileSync(file);
  let pos = 8; let width; let height; let colorType; const chunks = [];
  while (pos < data.length) {
    const length = data.readUInt32BE(pos); const type = data.toString('ascii', pos + 4, pos + 8); const chunk = data.subarray(pos + 8, pos + 8 + length); pos += 12 + length;
    if (type === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); if (chunk[8] !== 8 || chunk[12] !== 0) throw new Error(`Unsupported PNG: ${file}`); colorType = chunk[9]; }
    if (type === 'IDAT') chunks.push(chunk);
    if (type === 'IEND') break;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`Unsupported PNG color type in ${file}`);
  const raw = zlib.inflateSync(Buffer.concat(chunks)); const stride = width * channels; const rgba = Buffer.alloc(width * height * 4); let input = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[input++]; const row = Buffer.from(raw.subarray(input, input + stride)); input += stride;
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? row[i - channels] : 0; const up = previous[i]; const upperLeft = i >= channels ? previous[i - channels] : 0;
      if (filter === 1) row[i] = (row[i] + left) & 255;
      else if (filter === 2) row[i] = (row[i] + up) & 255;
      else if (filter === 3) row[i] = (row[i] + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) { const p = left + up - upperLeft; const pa = Math.abs(p - left); const pb = Math.abs(p - up); const pc = Math.abs(p - upperLeft); row[i] = (row[i] + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft)) & 255; }
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}`);
    }
    for (let x = 0; x < width; x += 1) {
      const si = x * channels; const di = (y * width + x) * 4;
      rgba[di] = row[si]; rgba[di + 1] = row[si + 1]; rgba[di + 2] = row[si + 2]; rgba[di + 3] = channels === 4 ? row[si + 3] : 255;
    }
    previous = row;
  }
  return { width, height, rgba };
}
function iconPixels(sheet, cx, cy, diameter, size) {
  const out = Buffer.alloc(size * size * 4); const radius = diameter / 2;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const sx = cx + (x + 0.5) * diameter / size - radius; const sy = cy + (y + 0.5) * diameter / size - radius;
    const distance = Math.hypot(sx - cx, sy - cy);
    if (distance > radius + 1 || sx < 0 || sy < 0 || sx >= sheet.width || sy >= sheet.height) continue;
    const di = (y * size + x) * 4;
    const sampleX = Math.max(0, Math.min(sheet.width - 1.001, sx)); const sampleY = Math.max(0, Math.min(sheet.height - 1.001, sy));
    const x0 = Math.floor(sampleX); const y0 = Math.floor(sampleY); const x1 = x0 + 1; const y1 = y0 + 1;
    const tx = sampleX - x0; const ty = sampleY - y0;
    const sample = (px, py, channel) => sheet.rgba[(py * sheet.width + px) * 4 + channel];
    const bilinear = (channel) => (sample(x0, y0, channel) * (1 - tx) + sample(x1, y0, channel) * tx) * (1 - ty)
      + (sample(x0, y1, channel) * (1 - tx) + sample(x1, y1, channel) * tx) * ty;
    const si = (Math.floor(sy) * sheet.width + Math.floor(sx)) * 4;
    const blackArtifact = sheet.rgba[si] < 18 && sheet.rgba[si + 1] < 18 && sheet.rgba[si + 2] < 18 && sy >= sheet.height * 0.48 && sy <= sheet.height * 0.51;
    if (blackArtifact && sy >= 3 && sy + 3 < sheet.height) {
      const above = (Math.floor(sy - 3) * sheet.width + Math.floor(sx)) * 4;
      const below = (Math.ceil(sy + 3) * sheet.width + Math.floor(sx)) * 4;
      for (let channel = 0; channel < 3; channel += 1) out[di + channel] = Math.round((sheet.rgba[above + channel] + sheet.rgba[below + channel]) / 2);
    } else {
      out[di] = Math.round(bilinear(0)); out[di + 1] = Math.round(bilinear(1)); out[di + 2] = Math.round(bilinear(2));
    }
    out[di + 3] = Math.round(Math.max(0, Math.min(255, (radius + 0.65 - distance) * 255))) * Math.round(bilinear(3)) / 255;
  }
  return out;
}
function resizeNearest(source, sourceSize, size) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const sx = Math.min(sourceSize - 1, Math.floor(x * sourceSize / size)); const sy = Math.min(sourceSize - 1, Math.floor(y * sourceSize / size));
    source.copy(out, (y * size + x) * 4, (sy * sourceSize + sx) * 4, (sy * sourceSize + sx) * 4 + 4);
  }
  return out;
}
function symbolPixels(source, color, size = 256) {
  const alpha = new Uint8Array(source.length / 4); let left = size; let top = size; let right = -1; let bottom = -1;
  for (let i = 0; i < alpha.length; i += 1) {
    const p = i * 4; const luminance = source[p] * 0.2126 + source[p + 1] * 0.7152 + source[p + 2] * 0.0722;
    const foreground = Math.max(0, Math.min(1, (luminance - 48) / 207));
    alpha[i] = Math.round(source[p + 3] * foreground);
    const x = i % size; const y = Math.floor(i / size);
    if (alpha[i] > 24) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (right < left || bottom < top) throw new Error('Could not isolate symbol from source icon.');
  const width = right - left + 1; const height = bottom - top + 1; const padding = Math.round(size * 0.065);
  const scale = (size - padding * 2) / Math.max(width, height); const scaledWidth = width * scale; const scaledHeight = height * scale;
  const startX = (size - scaledWidth) / 2; const startY = (size - scaledHeight) / 2; const out = Buffer.alloc(size * size * 4);
  const ink = color === 'black' ? 0 : 255;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const sx = left + (x + 0.5 - startX) / scale; const sy = top + (y + 0.5 - startY) / scale;
    if (sx < left || sy < top || sx >= right + 1 || sy >= bottom + 1) continue;
    const x0 = Math.min(right, Math.max(left, Math.floor(sx))); const y0 = Math.min(bottom, Math.max(top, Math.floor(sy)));
    const x1 = Math.min(right, x0 + 1); const y1 = Math.min(bottom, y0 + 1); const tx = sx - Math.floor(sx); const ty = sy - Math.floor(sy);
    const a00 = alpha[y0 * size + x0]; const a10 = alpha[y0 * size + x1]; const a01 = alpha[y1 * size + x0]; const a11 = alpha[y1 * size + x1];
    const a = Math.round((a00 * (1 - tx) + a10 * tx) * (1 - ty) + (a01 * (1 - tx) + a11 * tx) * ty);
    const p = (y * size + x) * 4; out[p] = ink; out[p + 1] = ink; out[p + 2] = ink; out[p + 3] = a;
  }
  return out;
}
function resizeBilinear(source, sourceSize, size) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const sx = (x + 0.5) * sourceSize / size - 0.5; const sy = (y + 0.5) * sourceSize / size - 0.5;
    const x0 = Math.max(0, Math.floor(sx)); const y0 = Math.max(0, Math.floor(sy)); const x1 = Math.min(sourceSize - 1, x0 + 1); const y1 = Math.min(sourceSize - 1, y0 + 1);
    const tx = Math.max(0, sx - x0); const ty = Math.max(0, sy - y0); const p = (y * size + x) * 4;
    for (let channel = 0; channel < 4; channel += 1) {
      const a = source[(y0 * sourceSize + x0) * 4 + channel] * (1 - tx) + source[(y0 * sourceSize + x1) * 4 + channel] * tx;
      const b = source[(y1 * sourceSize + x0) * 4 + channel] * (1 - tx) + source[(y1 * sourceSize + x1) * 4 + channel] * tx;
      out[p + channel] = Math.round(a * (1 - ty) + b * ty);
    }
  }
  return out;
}
function makeIco(pixels, size = 256) {
  const edges = [16, 24, 32, 48, 64, 128, 256]; const frames = edges.map((edge) => encodePng(edge, resizeBilinear(pixels, size, edge)));
  const header = Buffer.alloc(6 + 16 * edges.length); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(edges.length, 4);
  let offset = header.length;
  for (let i = 0; i < edges.length; i += 1) {
    const p = 6 + 16 * i; header[p] = edges[i] % 256; header[p + 1] = edges[i] % 256; header.writeUInt16LE(1, p + 4); header.writeUInt16LE(32, p + 6); header.writeUInt32LE(frames[i].length, p + 8); header.writeUInt32LE(offset, p + 12); offset += frames[i].length;
  }
  return Buffer.concat([header, ...frames]);
}
function drawLine(mask, x1, y1, x2, y2, stroke = 9) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - stroke)); const maxX = Math.min(255, Math.ceil(Math.max(x1, x2) + stroke));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - stroke)); const maxY = Math.min(255, Math.ceil(Math.max(y1, y2) + stroke));
  const vx = x2 - x1; const vy = y2 - y1; const length2 = vx * vx + vy * vy;
  for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
    const t = length2 ? Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / length2)) : 0;
    const distance = Math.hypot(x - (x1 + t * vx), y - (y1 + t * vy));
    const coverage = Math.max(0, Math.min(1, stroke / 2 + 0.65 - distance));
    if (!coverage) continue;
    const index = (y * 256 + x) * 4; mask[index] = 255; mask[index + 1] = 255; mask[index + 2] = 255;
    mask[index + 3] = Math.max(mask[index + 3], Math.round(coverage * 255));
  }
}
function drawPolyline(mask, points, stroke = 9, closed = false) {
  for (let i = 0; i < points.length - 1; i += 1) drawLine(mask, ...points[i], ...points[i + 1], stroke);
  if (closed && points.length > 2) drawLine(mask, ...points[points.length - 1], ...points[0], stroke);
}
function makeEssentialSymbols() {
  const eye = Buffer.alloc(256 * 256 * 4);
  const eyeCurve = [];
  for (let i = 0; i <= 48; i += 1) {
    const angle = (Math.PI * 2 * i) / 48;
    eyeCurve.push([128 + 82 * Math.cos(angle), 128 + 54 * Math.sin(angle)]);
  }
  drawPolyline(eye, eyeCurve, 8);
  const circle = (buffer, cx, cy, radius, fill) => {
    for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y += 1) for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x += 1) {
      const distance = Math.hypot(x - cx, y - cy); const alpha = fill ? Math.max(0, Math.min(1, radius + 0.65 - distance)) : Math.max(0, Math.min(1, 4.5 + 0.65 - Math.abs(distance - radius)));
      if (!alpha) continue;
      const index = (y * 256 + x) * 4; buffer[index] = 255; buffer[index + 1] = 255; buffer[index + 2] = 255;
      buffer[index + 3] = Math.max(buffer[index + 3], Math.round(alpha * 255));
    }
  };
  circle(eye, 128, 128, 26, false); circle(eye, 128, 128, 9, true);

  const trash = Buffer.alloc(256 * 256 * 4);
  drawPolyline(trash, [[84, 85], [94, 202], [162, 202], [172, 85]], 8);
  drawPolyline(trash, [[72, 76], [184, 76]], 8);
  drawPolyline(trash, [[105, 67], [105, 55], [151, 55], [151, 67]], 8);
  drawPolyline(trash, [[111, 105], [111, 174]], 7);
  drawPolyline(trash, [[145, 105], [145, 174]], 7);
  return [{ name: 'Eye', slug: 'essentials-eye', category: 'Essentials', shape: eye }, { name: 'Trash', slug: 'essentials-trash', category: 'Essentials', shape: trash }];
}
function zipStore(entries) {
  const local = []; const central = []; let offset = 0;
  for (const [name, data] of entries) {
    const fileName = Buffer.from(name); const compressed = zlib.deflateRawSync(data); const crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(compressed.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(fileName.length, 26);
    local.push(lh, fileName, compressed);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(compressed.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(fileName.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, fileName); offset += lh.length + fileName.length + compressed.length;
  }
  const centralData = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralData.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralData, end]);
}

fs.mkdirSync(output, { recursive: true });
for (const file of fs.readdirSync(output)) {
  const target = path.join(output, file);
  if (fs.statSync(target).isDirectory()) fs.rmSync(target, { recursive: true, force: true });
  else fs.unlinkSync(target);
}
const blackOutput = path.join(output, 'symbols-black'); const whiteOutput = path.join(output, 'symbols-white');
fs.mkdirSync(blackOutput, { recursive: true }); fs.mkdirSync(whiteOutput, { recursive: true });
const sheets = sources.map(decodePng); const manifest = []; const archive = []; const blackArchive = []; const whiteArchive = []; const simpleArchive = [];
const blackBySheet = sources.map(() => []); const whiteBySheet = sources.map(() => []);
for (let s = 0; s < sheets.length; s += 1) {
  const sheet = sheets[s]; const centersX = Array.from({ length: 7 }, (_, i) => Math.round(sheet.width * (0.091 + i * 0.1354)));
  const centersY = Array.from({ length: 3 }, (_, i) => Math.round(sheet.height * (0.201 + i * 0.297)));
  const diameter = Math.round(Math.min(sheet.width * 0.1135, sheet.height * 0.202));
  for (let i = 0; i < names[s].length; i += 1) {
    const row = Math.floor(i / 7); const col = i % 7; const slug = `sheet-${String(s + 1).padStart(2, '0')}-${names[s][i]}`; const pixels = iconPixels(sheet, centersX[col], centersY[row], diameter, 256);
    const png = encodePng(256, pixels); const ico = makeIco(pixels);
    fs.writeFileSync(path.join(output, `${slug}.png`), png); fs.writeFileSync(path.join(output, `${slug}.ico`), ico); archive.push([`${slug}.ico`, ico]);
    const black = symbolPixels(pixels, 'black'); const white = symbolPixels(pixels, 'white');
    const blackIco = makeIco(black); const whiteIco = makeIco(white);
    fs.writeFileSync(path.join(blackOutput, `${slug}.png`), encodePng(256, black)); fs.writeFileSync(path.join(blackOutput, `${slug}.ico`), blackIco);
    fs.writeFileSync(path.join(whiteOutput, `${slug}.png`), encodePng(256, white)); fs.writeFileSync(path.join(whiteOutput, `${slug}.ico`), whiteIco);
    blackArchive.push([`${slug}.ico`, blackIco]); whiteArchive.push([`${slug}.ico`, whiteIco]);
    blackBySheet[s].push([`${slug}.ico`, blackIco]); whiteBySheet[s].push([`${slug}.ico`, whiteIco]);
    simpleArchive.push([`black/${slug}.ico`, blackIco], [`white/${slug}.ico`, whiteIco]);
    manifest.push({ name: names[s][i].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), slug, category: categories[s][i], sheet: s + 1 });
  }
}
const essentialBlack = []; const essentialWhite = [];
for (const item of makeEssentialSymbols()) {
  const black = symbolPixels(item.shape, 'black'); const white = symbolPixels(item.shape, 'white');
  const blackIco = makeIco(black); const whiteIco = makeIco(white);
  fs.writeFileSync(path.join(blackOutput, `${item.slug}.png`), encodePng(256, black)); fs.writeFileSync(path.join(blackOutput, `${item.slug}.ico`), blackIco);
  fs.writeFileSync(path.join(whiteOutput, `${item.slug}.png`), encodePng(256, white)); fs.writeFileSync(path.join(whiteOutput, `${item.slug}.ico`), whiteIco);
  blackArchive.push([`${item.slug}.ico`, blackIco]); whiteArchive.push([`${item.slug}.ico`, whiteIco]);
  essentialBlack.push([`${item.slug}.ico`, blackIco]); essentialWhite.push([`${item.slug}.ico`, whiteIco]);
  simpleArchive.push([`black/${item.slug}.ico`, blackIco], [`white/${item.slug}.ico`, whiteIco]);
  manifest.push({ name: item.name, slug: item.slug, category: item.category, sheet: 'Essentials' });
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(output, 'vedoy-icons-pack.zip'), zipStore(archive));
fs.writeFileSync(path.join(output, 'vedoy-icons-symbols-black.zip'), zipStore(blackArchive));
fs.writeFileSync(path.join(output, 'vedoy-icons-symbols-white.zip'), zipStore(whiteArchive));
fs.writeFileSync(path.join(output, 'vedoy-icons-symbols-black-and-white.zip'), zipStore(simpleArchive));
fs.writeFileSync(path.join(output, 'vedoy-icons-essential-black.zip'), zipStore(essentialBlack));
fs.writeFileSync(path.join(output, 'vedoy-icons-essential-white.zip'), zipStore(essentialWhite));
for (let i = 0; i < sources.length; i += 1) {
  const sheetNumber = String(i + 1).padStart(2, '0');
  fs.writeFileSync(path.join(output, `vedoy-icons-sheet-${sheetNumber}-black.zip`), zipStore(blackBySheet[i]));
  fs.writeFileSync(path.join(output, `vedoy-icons-sheet-${sheetNumber}-white.zip`), zipStore(whiteBySheet[i]));
}
console.log(`Created ${manifest.length} black and white symbols, source-sheet packs, and essential packs.`);
