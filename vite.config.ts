import tailwindcss from "@tailwindcss/vite";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { viagen } from "viagen";

export default defineConfig({
  server: {
    allowedHosts: true,
  },
  ssr: {
    noExternal: ["react-markdown"],
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
