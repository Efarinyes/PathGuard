export async function generateLocationId(
  timestamp: number,
  lat: number,
  lng: number,
  walkId: number
): Promise<string> {
  const input = `${timestamp}:${lat.toFixed(6)}:${lng.toFixed(6)}:${walkId}`;
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
