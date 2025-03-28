import { loadXMLGeoidModel } from '../src/libs/geoid';
import fs from 'node:fs';
import path from 'node:path';
import zlib, { gzipSync, brotliCompressSync } from 'node:zlib';

(async () => {
  const model = await loadXMLGeoidModel(process.argv[2]);
  const basename = path.basename(process.argv[2], '.xml');
  const json = JSON.stringify(model);
  const brotlied = brotliCompressSync(json, {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    },
  });
  fs.writeFileSync(
    path.join(__dirname, '..', 'data', `${basename}.json.br`),
    brotlied
  );
})();
