/** True when the request comes from a page on this same site (browsers always send Origin on a POST). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const host = request.headers.get('host') ?? new URL(request.url).host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
