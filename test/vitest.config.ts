import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

/**
 * Suíte única do monorepo. Rode sempre da raiz: `npm run test:ci`
 * (cwd em `test/` ou `frontend/` sem --config quebra resolução no Windows.)
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'backend',
          root: repoRoot,
          environment: 'node',
          include: ['test/backend/**/*.test.ts'],
          env: { NODE_ENV: 'test' },
        },
      },
      {
        plugins: [react(), tailwindcss()],
        test: {
          name: 'frontend',
          root: repoRoot,
          environment: 'jsdom',
          include: ['test/frontend/**/*.test.ts'],
          setupFiles: [path.join(repoRoot, 'frontend/src/test/setup.ts')],
        },
      },
    ],
  },
})
