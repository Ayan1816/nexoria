import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function vendorChunk(id) {
  const path = id.replaceAll('\\', '/')
  if (path.includes('/node_modules/ethers/')) return 'ethers'
  if (path.includes('/node_modules/firebase/') || path.includes('/node_modules/@firebase/')) return 'firebase'
  if (
    path.includes('/node_modules/react/')
    || path.includes('/node_modules/react-dom/')
    || path.includes('/node_modules/scheduler/')
    || path.includes('/node_modules/lucide-react/')
    || path.includes('/node_modules/canvas-confetti/')
  ) return 'ui'
  return undefined
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
})
