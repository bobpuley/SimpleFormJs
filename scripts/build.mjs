import { build } from 'esbuild';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)));
const banner = `/*! SimpleFormJs v${pkg.version} | MIT License | https://github.com/bobpuley/SimpleFormJs */`;
const common = { bundle: true, target: 'es2020', banner: { js: banner }, logLevel: 'info' };
// IIFE + CommonJS export = UMD good enough for <script> tags, bundlers and require()
const umd = {
  ...common,
  entryPoints: ['src/umd.js'],
  format: 'iife',
  globalName: 'SimpleFormJs',
  footer: { js: "if (typeof module === 'object' && module.exports) module.exports = SimpleFormJs;" },
};

await mkdir('dist', { recursive: true });
await Promise.all([
  build({ ...common, entryPoints: ['src/index.js'], format: 'esm', outfile: 'dist/simpleform.esm.mjs' }),
  build({ ...common, entryPoints: ['src/index.js'], format: 'esm', outfile: 'dist/simpleform.esm.min.mjs', minify: true }),
  build({ ...umd, outfile: 'dist/simpleform.umd.js' }),
  build({ ...umd, outfile: 'dist/simpleform.umd.min.js', minify: true, sourcemap: true }),
  copyFile('src/simpleform.css', 'dist/simpleform.css'),
  // dist/*.js are UMD scripts: make Node treat them as CommonJS (ESM bundles use .mjs)
  writeFile('dist/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n'),
]);
