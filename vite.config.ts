import { stripUnusedExternalFeatures } from './scripts/strip-external-features';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { stripUnusedRouterFramework } from './scripts/strip-framework-loader';
export default defineConfig({plugins:[stripUnusedRouterFramework(),stripUnusedExternalFeatures(),react()],base:'./',resolve:{dedupe:['react-router','react-router-dom']},build:{sourcemap:false,rollupOptions:{output:{inlineDynamicImports:true}}},server:{host:'127.0.0.1'}});
