const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const rootDir = __dirname;
const distDir = path.join(rootDir, "dist");
const distPublicDir = path.join(distDir, "public");

// Purana dist folder clean karein
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distPublicDir, { recursive: true });

// 1. Backend server.js ko dist/server.js mein build karein
esbuild.buildSync({
  entryPoints: [path.join(rootDir, "server.js")],
  bundle: true,
  platform: "node",
  target: "node20",
  outfile: path.join(distDir, "server.js"),
  external: [
    "express",
    "multer",
    "jszip",
    "@imgly/background-removal-node",
    "onnxruntime-node",
    "sharp",
  ],
});

// 2. public/index.html ka inline JS/CSS minify karke dist/public/index.html mein likhein
let html = fs.readFileSync(path.join(rootDir, "public", "index.html"), "utf8");

html = html.replace(/<style>([\s\S]*?)<\/style>/i, (_, css) => {
  const minCss = esbuild.transformSync(css, { loader: "css", minify: true }).code.trim();
  return `<style>${minCss}</style>`;
});

html = html.replace(/<script>([\s\S]*?)<\/script>/i, (_, js) => {
  const minJs = esbuild.transformSync(js, { loader: "js", minify: true }).code.trim();
  return `<script>${minJs}</script>`;
});

fs.writeFileSync(path.join(distPublicDir, "index.html"), html, "utf8");

// 3. Logo aur baaki static assets (index.html ke alawa) dist/public mein copy karein
for (const file of fs.readdirSync(path.join(rootDir, "public"))) {
  if (file === "index.html") continue;
  fs.copyFileSync(
    path.join(rootDir, "public", file),
    path.join(distPublicDir, file)
  );
}

// 4. dist/package.json generate karein taaki dist ko alag jagah deploy kar sakein
const rootPkg = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const distPkg = {
  name: rootPkg.name || "sanskar-bg-remover",
  version: rootPkg.version || "1.0.0",
  private: true,
  main: "server.js",
  scripts: {
    start: "node server.js",
  },
  dependencies: rootPkg.dependencies || {},
};

fs.writeFileSync(path.join(distDir, "package.json"), JSON.stringify(distPkg, null, 2), "utf8");

console.log("Build complete! Output folder: ./dist");