import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		https: true,
		host: '0.0.0.0' // Expose to network for Tailscale
	}
});