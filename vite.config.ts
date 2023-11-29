import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';


export default defineConfig({
	plugins: [sveltekit()],

	resolve: {
		alias: {
			'$fonts': path.resolve('./node_modules/bootstrap-icons/font/fonts'),
		}
	},
	css: {
		preprocessorOptions: {
			scss: {
				additionalData: '@use "src/variables.scss" as *;'
			}
		}
	}
});
