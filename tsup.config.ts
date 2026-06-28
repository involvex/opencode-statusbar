import {defineConfig} from 'tsup'

export default defineConfig({
	entry: {
		index: 'src/index.tsx',
	},
	format: ['esm'],
	target: 'node22',
	outDir: 'dist',
	external: ['@opentui/core', '@opentui/solid', 'solid-js'],
	dts: false,
	splitting: false,
	treeshake: true,
})
