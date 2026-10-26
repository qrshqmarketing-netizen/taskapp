/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the board out of search engines on every host (it is a private team tool)
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default nextConfig;
