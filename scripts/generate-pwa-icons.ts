// Codex, 2026-11-28. Rebuild checked-in PNGs from the existing mark; requires system rsvg-convert.
import { readFile, mkdir, writeFile, unlink } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const source = await readFile(new URL("../app/icon.svg", import.meta.url), "utf8");
const mark = source.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const background = /<rect[^>]*fill="(#[a-f\d]+)"/i.exec(mark)?.[1];
if (!background) throw new Error("Expected the existing medBot logo background.");
await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
for (const [filename, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable.png", 512, true],
  ["apple-touch-icon.png", 180, false],
] as const) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${background}"/><g${maskable ? ' transform="translate(4.8 4.8) scale(.7)"' : ""}>${mark}</g></svg>`;
  const input = new URL(`../public/icons/.${filename}.svg`, import.meta.url);
  await writeFile(input, svg);
  try {
    execFileSync("rsvg-convert", ["--width", String(size), "--height", String(size), "--output", new URL(`../public/icons/${filename}`, import.meta.url).pathname, input.pathname], { stdio: "ignore", timeout: 10_000 });
  } finally { await unlink(input); }
}
