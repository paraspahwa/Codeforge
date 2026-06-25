/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@codeforge/shared", "@codeforge/ui", "@codeforge/design-tokens"],
};

export default nextConfig;
