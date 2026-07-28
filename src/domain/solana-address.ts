const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Returns a trimmed, syntactically valid 32-byte Solana public key. */
export function normalizeSolanaAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim();
  const decoded = decodeBase58(address);
  return decoded?.length === 32 ? address : null;
}

export function isSolanaAddress(value: unknown): boolean {
  return normalizeSolanaAddress(value) !== null;
}

function decodeBase58(value: string): Uint8Array | undefined {
  if (value.length === 0) return undefined;

  let decoded = 0n;
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character);
    if (index === -1) return undefined;
    decoded = decoded * 58n + BigInt(index);
  }

  const bytes: number[] = [];
  while (decoded > 0n) {
    bytes.push(Number(decoded & 0xffn));
    decoded >>= 8n;
  }
  bytes.reverse();

  let leadingZeroes = 0;
  while (value[leadingZeroes] === "1") leadingZeroes += 1;
  return Uint8Array.from([...Array<number>(leadingZeroes).fill(0), ...bytes]);
}
