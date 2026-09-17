import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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
        })
    }
};

export default config;
