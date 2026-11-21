// Configured service origins may be local or publicly deployed.
export function serviceOrigin(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must be an HTTP or HTTPS origin`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an HTTP or HTTPS origin without credentials, path, query or fragment`);
  }
  return url.origin;
}
