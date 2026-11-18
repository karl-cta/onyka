import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // React itself must live with react-dom: left unassigned, it can land in a chunk
            // that loads after the ones importing it, and the app never mounts.
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
              return 'vendor'
            }
            if (id.includes('@tiptap/') || id.includes('prosemirror')) {
              return 'tiptap'
            }
            if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) {
              return 'framer-motion'
            }
            if (id.includes('@dnd-kit/')) {
              return 'dnd-kit'
            }
            if (id.includes('socket.io')) {
              return 'socket-io'
            }
          }
        },
      },
    },
  },
})
