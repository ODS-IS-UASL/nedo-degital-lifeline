import fs from 'node:fs';
import { brotliDecompress as _brotliDecompress } from 'node:zlib';
import { promisify } from 'node:util';

const brotliDecompress = promisify(_brotliDecompress);

export async function brotliDecompressToString(inputPath: string): Promise<string> {
  const fileContents = await fs.promises.readFile(inputPath);
  const buffer = await brotliDecompress(fileContents);
  return buffer.toString('utf-8');
}
