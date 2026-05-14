/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export is only used for the Chrome extension build (BUILD_STATIC=1)
  // Vercel deployment uses the default server-side rendering mode
  //
  // trailingSlash: true is required for chrome-extension:// because the
  // extension serves files by literal path — /dashboard/tracker only works
  // if the export emits dashboard/tracker/index.html (not dashboard/tracker.html)
  ...(process.env.BUILD_STATIC === '1'
    ? { output: 'export', trailingSlash: true }
    : {}),
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
