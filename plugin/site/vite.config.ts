import { defineConfig } from "vite";
import { viagen } from "../src";

export default defineConfig({
  envDir: "..",
  plugins: [viagen({ editable: [".", "../src", "../package.json"] })],
});
