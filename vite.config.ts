import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { viagen } from "viagen";

export default defineConfig({
  server: {
    allowedHosts: true,
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  ssr: {
    noExternal: ["react-markdown"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react-markdown",
      "radix-ui",
    ],
  },
  plugins: [
    tailwindcss(),
    viagen({
      editable: ["."],
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
});
