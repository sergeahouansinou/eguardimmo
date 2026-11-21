import { useRef } from 'react';

const HEX = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, '0'));

export function uuidV7(now: number = Date.now(), random: Uint8Array = crypto.getRandomValues(new Uint8Array(10))): string {
  const bytes = new Uint8Array(16);
  for (let index = 0; index < 6; index += 1) bytes[index] = Math.floor(now / 2 ** (8 * (5 - index))) % 256;
  bytes.set(random.subarray(0, 10), 6);
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f);
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f);
  const hex = Array.from(bytes, (byte) => HEX[byte]).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function fingerprintOf(fields: readonly string[], files: readonly File[]): string {
  return JSON.stringify([fields, files.map((file) => [file.name, file.size, file.lastModified])]);
}

export interface SendIntent {
  clientIdFor: (fingerprint: string) => string;
  settle: () => void;
}

export function useSendIntent(): SendIntent {
  const current = useRef<{ fingerprint: string; clientId: string } | null>(null);
  return {
    clientIdFor: (fingerprint) => {
      if (current.current?.fingerprint !== fingerprint) current.current = { fingerprint, clientId: uuidV7() };
      return current.current.clientId;
    },
    settle: () => {
      current.current = null;
    },
  };
}
