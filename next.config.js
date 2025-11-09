/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ['react'],
  },
};
module.exports = nextConfig;
