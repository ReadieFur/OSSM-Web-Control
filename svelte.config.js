import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import pkg from './package.json' with { type: 'json' };

/** @type {import('@sveltejs/kit').Config} */
const config = {
    // Enables Vite to process <style lang="scss"> tags using your vite.config.ts settings
    preprocess: vitePreprocess(),
    compilerOptions: {
        runes: ({ filename }) =>
            filename.split(/[/\\]/).includes('node_modules') ? undefined : true
    },
    kit: {
        adapter: adapter({
            fallback: 'index.html'
        }),
        alias: {
            '$view/*': 'src/views/*',
            '$component/*': 'src/components/*'
        },
        version: {
            name: pkg.version
        }
    }
};

export default config;
