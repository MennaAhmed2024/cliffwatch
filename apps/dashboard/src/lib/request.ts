export function isLocalSameOrigin(request: Request): boolean {
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  if (!host || !/^127\.0\.0\.1:[0-9]{1,5}$/.test(host) || !origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && url.host === host && url.pathname === '/' && !url.search && !url.hash;
  } catch { return false; }
}
