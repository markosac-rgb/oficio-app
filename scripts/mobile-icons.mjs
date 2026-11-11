import { mkdir, copyFile } from "node:fs/promises";
import sharp from "sharp";

const icon = "public/brand/icono.svg";
await mkdir("assets", { recursive: true });
await sharp(icon).resize(1024, 1024).png().toFile("assets/icon.png");
await sharp(icon).resize(1024, 1024).png().toFile("assets/icon-foreground.png");
await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: "#062F35" },
})
  .composite([{ input: await sharp(icon).resize(1200, 1200).png().toBuffer(), gravity: "centre" }])
  .png()
  .toFile("assets/splash.png");
await copyFile(icon, "mobile/www/icono.svg");
console.log("Icono y splash listos en assets/.");
