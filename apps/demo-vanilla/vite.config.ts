import { defineConfig, type Plugin } from "vite";
import path from "node:path";
import { execSync } from "node:child_process";

const repoRoot = path.resolve(__dirname, "../..");
const uiPkgDir = path.resolve(repoRoot, "packages/sanjaya-ui");

// ---------------------------------------------------------------------------
// Inline plugin: rebuild template.html → template.ts when HTML changes
//
// The sanjaya-ui package uses @pojagi/build-templates to compile
// template.html files into template.ts string exports. This plugin
// watches for those HTML changes and re-runs the template build so
// Vite's HMR picks up the updated TS immediately.
// ---------------------------------------------------------------------------
function rebuildTemplatesPlugin(): Plugin {
  return {
    name: "sanjaya-rebuild-templates",
    handleHotUpdate({ file }) {
      if (
        file.startsWith(uiPkgDir) &&
        (file.endsWith("template.html") || file.endsWith(".template.html"))
      ) {
        console.log("\n  ⚡ template changed — rebuilding templates…");
        try {
          execSync("pnpm run build:templates", {
            cwd: uiPkgDir,
            stdio: "inherit",
          });
        } catch {
          console.error("  ✗ template rebuild failed");
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [rebuildTemplatesPlugin()],

  // ---------------------------------------------------------------------------
  // Resolve workspace packages to their *source* entry points so that
  // Vite processes them as regular application code (HMR, no pre-bundle).
  // ---------------------------------------------------------------------------
  resolve: {
    alias: [
      // Exact bare import → raw TS source (HMR, no pre-bundle).
      // Must NOT match sub-path imports like @pojagi/sanjaya-ui/themes/…
      {
        find: /^@pojagi\/sanjaya-ui$/,
        replacement: path.resolve(uiPkgDir, "src/index.ts"),
      },
    ],
  },

  server: {
    // Let Vite serve files from the entire monorepo (workspace packages)
    fs: {
      allow: [repoRoot],
    },

    // Watch workspace package source directories for changes
    watch: {
      // chokidar can't follow symlinks into node_modules by default;
      // the alias above bypasses that, but we still tell it to watch
      // the package dirs explicitly for belt-and-suspenders reliability.
      ignored: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.git/**",
      ],
    },
  },

  // Don't pre-bundle workspace packages — we want Vite to process them
  // as source so edits trigger HMR / full reload immediately.
  optimizeDeps: {
    exclude: ["@pojagi/sanjaya-ui"],
  },
});
