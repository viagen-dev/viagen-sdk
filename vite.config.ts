import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { viagen } from "viagen";

export default defineConfig({
  plugins: [
    viagen({
      editable: ["./app"],
    }),
    reactRouter(),
    tsconfigPaths(),
  ],
});
