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
					label: 'Introduction',
					items: [
						{ label: 'What is Forkspacer?', link: '/introduction/overview/' },
						{ label: 'Core Concepts', link: '/introduction/concepts/' },
					],
				},
				{
					label: 'Getting Started',
					autogenerate: { directory: 'guides' },
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				{
					label: 'Development',
					autogenerate: { directory: 'development' },
				},
			],
		}),
	],
});
