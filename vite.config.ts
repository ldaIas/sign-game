/// <reference types="vitest/config" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { defineConfig, minifySync, transformWithOxc, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// src/about.ts must run before first paint, so it can't be a module script
// (those are deferred). Serve it as a classic <script> in <head>: the dev server
// transpiles it on request; the build compiles it to a hashed asset.
function headScript(): Plugin {
  const entry = "src/about.ts";
  let src = `/${entry}`;
  return {
    name: "zodle:head-script",
    async buildStart() {
      if (this.environment.mode !== "build") return;
      const { code } = await transformWithOxc(readFileSync(entry, "utf8"), entry);
      const source = minifySync(entry.replace(/\.ts$/, ".js"), code).code;
      const hash = createHash("sha256").update(source).digest("base64url").slice(0, 8);
      const fileName = `assets/about-${hash}.js`;
      this.emitFile({ type: "asset", fileName, source });
      src = `/${fileName}`;
    },
    transformIndexHtml: {
      order: "post",
      handler: () => [{ tag: "script", attrs: { src }, injectTo: "head" }],
    },
  };
}

export default defineConfig({
  plugins: [
    headScript(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // public/manifest.webmanifest is linked from index.html as is.
      manifest: false,
      // Registered from src/install.ts; the CSP allows no inline scripts.
      injectRegister: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html}", "favicon.svg", "manifest.webmanifest", "icon-192.png"],
        // The worker doesn't cache itself.
        globIgnores: ["sw.js"],
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
