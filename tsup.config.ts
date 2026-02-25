import { defineConfig } from 'tsup';

export default defineConfig([
    // ESM build
    {
        entry: ['src/index.ts'],
        format: ['esm'],
        outDir: 'dist/esm',
        dts: false,
        sourcemap: true,
        clean: true,
        target: 'es2022',
        splitting: false,
    },
    // CJS build (.cjs so Node treats it as CommonJS when package has "type": "module")
    {
        entry: ['src/index.ts'],
        format: ['cjs'],
        outDir: 'dist/cjs',
        outExtension: () => ({ js: '.cjs' }),
        dts: false,
        sourcemap: true,
        clean: true,
        target: 'es2022',
        splitting: false,
    },
    // Types-only build
    {
        entry: ['src/index.ts'],
        outDir: 'dist/types',
        dts: { only: true },
        format: ['esm'],
        clean: true,
    },
]);
