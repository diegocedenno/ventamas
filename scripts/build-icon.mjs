// Genera los iconos de la aplicación a partir de build/icon.svg.
// Uso: npm run icon
//   build/icon.png  512×512, para el instalador y la documentación
//   build/icon.ico  16–256 px, para Windows
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const build = join(dirname(fileURLToPath(import.meta.url)), "..", "build");
const svg = readFileSync(join(build, "icon.svg"));

const render = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

writeFileSync(join(build, "icon.png"), await render(512));

// Un .ico es una cabecera, una entrada por tamaño y las imágenes; desde Windows Vista
// cada imagen puede ir directamente como PNG.
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map(render));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);

let offset = header.length + 16 * sizes.length;
const entries = images.map((image, i) => {
  const entry = Buffer.alloc(16);
  const size = sizes[i];
  entry.writeUInt8(size === 256 ? 0 : size, 0);
  entry.writeUInt8(size === 256 ? 0 : size, 1);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(image.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += image.length;
  return entry;
});

writeFileSync(join(build, "icon.ico"), Buffer.concat([header, ...entries, ...images]));
console.log("build/icon.png, build/icon.ico");
