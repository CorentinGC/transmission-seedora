/**
 * Generate all app icons from the source 1024x1024 PNG.
 *
 * Usage: node scripts/generate-icons.mjs
 *
 * Requires: sharp (devDependency)
 * On macOS, uses native `iconutil` to produce .icns
 */

import sharp from 'sharp';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'resources', 'seedora_logo_1024.png');

// Output directories
const RESOURCES = path.join(ROOT, 'resources');
const WEB_PUBLIC = path.join(ROOT, 'apps', 'web', 'public');
const WEB_ICONS = path.join(WEB_PUBLIC, 'icons');

fs.mkdirSync(WEB_ICONS, { recursive: true });

const src = sharp(SOURCE);

// ── Helpers ──────────────────────────────────────────────────────────

async function resizePng(size, outputPath) {
  await src.clone().resize(size, size).png().toFile(outputPath);
  console.log(`  PNG  ${size}x${size} -> ${path.relative(ROOT, outputPath)}`);
}

/**
 * Build a .ico file containing multiple PNG images.
 * ICO format: header (6 bytes) + directory entries (16 bytes each) + PNG data
 */
async function buildIco(sizes, outputPath) {
  const images = await Promise.all(
    sizes.map(async (size) => {
      const buf = await src.clone().resize(size, size).png().toBuffer();
      return { size, buf };
    })
  );

  const headerSize = 6;
  const dirEntrySize = 16;
  let dataOffset = headerSize + dirEntrySize * images.length;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const dirEntries = [];
  const dataBuffers = [];

  for (const { size, buf } of images) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(dataOffset, 12);

    dirEntries.push(entry);
    dataBuffers.push(buf);
    dataOffset += buf.length;
  }

  fs.writeFileSync(outputPath, Buffer.concat([header, ...dirEntries, ...dataBuffers]));
  console.log(`  ICO  ${sizes.join(',')} -> ${path.relative(ROOT, outputPath)}`);
}

/**
 * Build macOS .icns using native iconutil (macOS only).
 */
async function buildIcns(outputPath) {
  if (process.platform !== 'darwin') {
    console.log('  ICNS skipped (not macOS)');
    return;
  }

  const iconsetDir = outputPath.replace('.icns', '.iconset');
  fs.mkdirSync(iconsetDir, { recursive: true });

  const variants = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ];

  await Promise.all(
    variants.map(({ name, size }) =>
      src.clone().resize(size, size).png().toFile(path.join(iconsetDir, name))
    )
  );

  execSync(`iconutil -c icns "${iconsetDir}" -o "${outputPath}"`);
  fs.rmSync(iconsetDir, { recursive: true });
  console.log(`  ICNS -> ${path.relative(ROOT, outputPath)}`);
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log(`Source: ${path.relative(ROOT, SOURCE)}\n`);

  // ── 1. Electron app icon (packagerConfig.icon) ──
  // Electron Forge picks up resources/icon.{icns,ico,png} automatically
  console.log('[Electron - app icon]');
  await buildIcns(path.join(RESOURCES, 'icon.icns'));
  await buildIco([16, 24, 32, 48, 64, 128, 256], path.join(RESOURCES, 'icon.ico'));
  await resizePng(1024, path.join(RESOURCES, 'icon.png'));

  // ── 2. Electron tray icons (used by src/main/tray.ts) ──
  console.log('\n[Electron - tray icons]');
  // macOS: Template image (must end with "Template" for dark/light auto-switch)
  await resizePng(32, path.join(RESOURCES, 'tray-iconTemplate.png'));
  await resizePng(64, path.join(RESOURCES, 'tray-iconTemplate@2x.png'));
  // Other platforms
  await resizePng(32, path.join(RESOURCES, 'tray-icon.png'));

  // ── 3. Web app - favicon & PWA (apps/web/public/) ──
  console.log('\n[Web app - public/]');
  await buildIco([16, 32, 48], path.join(WEB_PUBLIC, 'favicon.ico'));
  await resizePng(180, path.join(WEB_PUBLIC, 'apple-touch-icon.png'));
  await resizePng(192, path.join(WEB_ICONS, 'icon-192.png'));
  await resizePng(512, path.join(WEB_ICONS, 'icon-512.png'));

  // ── 4. Resources extras (used by resources/ for legacy/PWA) ──
  console.log('\n[Resources extras]');
  await buildIco([16, 32, 48], path.join(RESOURCES, 'favicon.ico'));
  await resizePng(96, path.join(RESOURCES, 'favicon-96x96.png'));
  await resizePng(180, path.join(RESOURCES, 'apple-touch-icon.png'));
  await resizePng(192, path.join(RESOURCES, 'web-app-manifest-192x192.png'));
  await resizePng(512, path.join(RESOURCES, 'web-app-manifest-512x512.png'));

  console.log('\nDone!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
