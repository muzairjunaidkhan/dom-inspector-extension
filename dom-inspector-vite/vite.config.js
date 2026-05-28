import { defineConfig, build } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function buildContentScript() {
  return {
    name: 'build-content-script',
    apply: 'build',
    async closeBundle() {
      await build({
        configFile: false,
        build: {
          emptyOutDir: false,
          outDir: 'extension',
          lib: {
            entry: path.resolve(__dirname, 'src/content/index.js'),
            formats: ['iife'],
            name: 'DOMInspector',
            fileName: () => 'content.js',
          },
        },
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildContentScript()],
})
