/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 商圏人口の集計はサーバ側で data/small-area/*.json.gz を実行時に読む。
  // Next.js のファイルトレースは動的な readFileSync を追えないため、明示的に同梱する。
  outputFileTracingIncludes: {
    "/api/e-stat/small-area-population": ["./data/small-area/**"],
  },
}

export default nextConfig
