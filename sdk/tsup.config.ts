import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/sandbox.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
})
