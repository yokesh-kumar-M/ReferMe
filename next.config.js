/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export is only used for the Chrome extension build (BUILD_STATIC=1)
  // Vercel deployment uses the default server-side rendering mode
  ...(process.env.BUILD_STATIC === '1' ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
