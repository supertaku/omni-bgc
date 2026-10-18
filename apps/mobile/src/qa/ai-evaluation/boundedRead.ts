import { FileMode, type File } from 'expo-file-system';

/** Bound actual bytes read, including SAF providers with missing or misleading size metadata. */
export function readBoundedBytes(file: File, maxBytes: number): Uint8Array<ArrayBuffer> {
  const handle = file.open(FileMode.ReadOnly),
    chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const requested = Math.min(65536, maxBytes - total + 1),
        chunk = handle.readBytes(requested);
      if (chunk.length > requested || total + chunk.length > maxBytes)
        throw new Error('Selected file exceeds byte limit');
      if (!chunk.length) break;
      chunks.push(chunk);
      total += chunk.length;
    }
  } finally {
    handle.close();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export function readBoundedText(file: File, maxBytes: number) {
  return new TextDecoder('utf-8', { fatal: true }).decode(readBoundedBytes(file, maxBytes));
}
