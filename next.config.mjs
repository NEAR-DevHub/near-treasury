/** @type {import('next').NextConfig} */
const nextConfig = {
  // External packages that should not be bundled by Turbopack
  // This prevents Next.js from trying to bundle test files and internal dependencies
  serverExternalPackages: [
    "pino",
    "thread-stream",
    "@walletconnect/sign-client",
  ],
};

export default nextConfig;
