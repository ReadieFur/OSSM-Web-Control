import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    plugins: [sveltekit()],
    resolve: {
        alias: {
            $view: path.resolve('./src/views'),
            $component: path.resolve('./src/components')
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                additionalData: `@use "$lib/styles/_variables.scss" as *;`
            }
        }
    }
});
