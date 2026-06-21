import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const functionDir = join(root, 'cloudbase/functions/shoubayi-api');

await mkdir(functionDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'src/cloudbase/ShouBaYiApi.ts')],
  outfile: join(functionDir, 'index.js'),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: false,
  packages: 'external',
  external: ['@cloudbase/node-sdk']
});

await writeFile(
  join(functionDir, 'package.json'),
  `${JSON.stringify(
    {
      name: 'shoubayi-api',
      version: '0.1.0',
      private: true,
      main: 'index.js',
      scripts: {
        start: 'node index.js'
      },
      dependencies: {
        '@cloudbase/node-sdk': '^3.18.3',
        ws: '^8.18.3'
      }
    },
    null,
    2
  )}\n`
);

await writeFile(join(functionDir, 'scf_bootstrap'), '#!/bin/bash\nnode index.js\n');
await copyFile(join(root, 'README.md'), join(functionDir, 'README.md'));
