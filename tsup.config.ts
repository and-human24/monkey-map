import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
  clean: false,
})
