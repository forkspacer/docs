// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://forkspacer.com',
	integrations: [
		starlight({
			title: 'Forkspacer',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/forkspacer' }],
			sidebar: [
				{
					label: 'Guides',
					autogenerate: { directory: 'guides' },
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
