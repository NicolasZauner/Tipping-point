import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained HTML file: the claude.ai artifact and the offline copy are the same bytes.
// The artifact frame has no network access, so every asset (fonts, map outlines, the web worker)
// is inlined. Workers are imported with `?worker&inline` and start from a blob: URL.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  worker: { format: "es" },
  build: {
    target: "es2022",
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
