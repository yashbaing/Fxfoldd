import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@fxfold/solver': path.resolve(__dirname, '../packages/solver/src/index.ts'),
    },
  },
})
