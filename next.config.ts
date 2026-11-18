import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Nada de la agenda se indexa en buscadores: es una página a la que llegas por un enlace tuyo.
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
  serverExternalPackages: ['postgres', 'nodemailer'],
};

export default nextConfig;
