import { defineConfig } from 'vite';

const pdfPackages = ['/jspdf/', '/canvg/', '/core-js/', '/dompurify/', '/fast-png/', '/fflate/', '/html2canvas/', '/@babel/runtime/'];

export default defineConfig({server:{host:'127.0.0.1',port:4173,strictPort:true},preview:{host:'127.0.0.1',port:4173,strictPort:true},build:{outDir:'dist',sourcemap:false,rollupOptions:{output:{manualChunks(id){
  const moduleId=id.replaceAll('\\','/');
  if(pdfPackages.some(name=>moduleId.includes(`/node_modules${name}`)))return 'pdf';
  if(moduleId.includes('/node_modules/'))return moduleId.includes('/node_modules/@supabase/')?'supabase':'vendor';
}}}}});
