/** Tailwind config for the extension panel bundle only. */
module.exports = {
  content: [
    "./src/panel/**/*.jsx",
    "./src/extension-panel/**/*.jsx",
    "../extension/panel/index.html",
  ],
  theme: { extend: {} },
  plugins: [],
};
