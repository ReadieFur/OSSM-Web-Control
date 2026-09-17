import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    plugins: [
        sveltekit({
            compilerOptions: {
                runes: ({ filename }) =>
                    filename.split(/[/\\]/).includes('node_modules') ? undefined : true
            },
            adapter: adapter({
                fallback: 'index.html'
            })
        })
    ],
	resolve: {
		alias: {
			$views: path.resolve('./src/views'),
            $components: path.resolve('./src/components'),
		}
	}
});
