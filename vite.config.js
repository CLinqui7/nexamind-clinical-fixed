import { defineConfig } from 'vite';
export default defineConfig({server:{host:'127.0.0.1',port:4173,strictPort:true},preview:{host:'127.0.0.1',port:4173,strictPort:true},build:{outDir:'dist',sourcemap:false,rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules'))return id.includes('@supabase')?'supabase':'vendor';}}}}});
