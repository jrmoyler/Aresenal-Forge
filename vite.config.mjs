import {defineConfig} from 'vite';
export default defineConfig({build:{rollupOptions:{input:{forge:'index.html',native:'native.html'}}}});
