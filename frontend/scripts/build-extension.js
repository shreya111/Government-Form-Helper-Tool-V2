// Builds the shared React panel into the extension, mirrors the extension into public/, and re-zips it.
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const esbuild = require("esbuild");

const frontendDir = path.resolve(__dirname, "..");
const appDir = path.resolve(frontendDir, "..");
const extensionDir = path.join(appDir, "extension");
const publicMirror = path.join(frontendDir, "public", "extension");

async function build() {
  await esbuild.build({
    entryPoints: [path.join(frontendDir, "src/extension-panel/index.jsx")],
    bundle: true,
    minify: true,
    outfile: path.join(extensionDir, "panel/panel.js"),
    define: { "process.env.NODE_ENV": '"production"', "__REACT_DEVTOOLS_GLOBAL_HOOK__": "undefined" },
    jsx: "automatic",
    loader: { ".js": "jsx", ".css": "empty" },
    target: ["chrome110"],
    logLevel: "info",
  });

  execSync(
    `npx tailwindcss -c tailwind.extension.config.js -i src/extension-panel/panel.css -o ${path.join(extensionDir, "panel/panel.css")} --minify`,
    { cwd: frontendDir, stdio: "inherit" }
  );

  fs.rmSync(publicMirror, { recursive: true, force: true });
  fs.mkdirSync(publicMirror, { recursive: true });
  // Mirror only what the browser mock page needs; keep worker/config out of the web root (and out of lint).
  for (const item of ["content.js", "styles.css", "panel", "icons"]) {
    const src = path.join(extensionDir, item);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(publicMirror, item), { recursive: true });
  }

  const zipPath = path.join(appDir, "formwise-extension.zip");
  fs.rmSync(zipPath, { force: true });
  execSync(`zip -rq formwise-extension.zip extension -x "*.DS_Store"`, { cwd: appDir, stdio: "inherit" });
  console.log(`Extension built -> ${zipPath}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
