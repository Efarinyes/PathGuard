import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: false,
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  sw: "pathguard-sw.js",
  workboxOptions: {
    skipWaiting: true,
    disableDevLogs: true,
    exclude: [
      /\/_next\/static\/chunks\/app\/_global-error\/page.*\.js$/,
      /\/_next\/static\/chunks\/app\/_not-found\/page.*\.js$/,
      /\/_next\/static\/chunks\/next\/dist\/client\/components\/builtin\/.*\.js$/,
      /middleware-manifest\.json$/,
      /\/api\/v1\/.*/,
    ],
    navigateFallbackDenylist: [/\/api\/v1\/.*/],
    navigateFallback: "/offline",
    runtimeCaching: [
      {
        urlPattern: /\/api\/v1\/.*/i,
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
