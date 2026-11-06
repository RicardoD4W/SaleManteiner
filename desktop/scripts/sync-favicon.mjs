import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_PUBLIC = path.join(DESKTOP, "..", "web", "public");
const SOURCE = path.join(DESKTOP, "icons", "64x64.png");
const TARGET = path.join(WEB_PUBLIC, "favicon.png");

mkdirSync(WEB_PUBLIC, { recursive: true });
copyFileSync(SOURCE, TARGET);
console.log("[icons] favicon actualizado desde icons/64x64.png");
