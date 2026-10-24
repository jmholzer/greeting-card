// Allow next/image to load the card front only from the exact remote URL set in
// NEXT_PUBLIC_CARD_FRONT_URL (if any), not from every host.
function cardFrontRemotePatterns() {
  const value = (process.env.NEXT_PUBLIC_CARD_FRONT_URL ?? '').trim();
  if (!value || value.startsWith('/')) return [];

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `NEXT_PUBLIC_CARD_FRONT_URL must be a path starting with "/" or an http(s) URL, got "${value}".`,
    );
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('NEXT_PUBLIC_CARD_FRONT_URL must use http or https.');
  }

  return [
    {
      protocol: url.protocol.slice(0, -1),
      hostname: url.hostname,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
    },
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Stops `next dev` from appending its own block to AGENTS.md.
  agentRules: false,
  images: {
    remotePatterns: cardFrontRemotePatterns(),
  },
};

export default nextConfig;
