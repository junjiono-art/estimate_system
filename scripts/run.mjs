/**
 * TypeScript スクリプトランナー（esbuild バンドル経由）。
 *
 * 用途: `@/` エイリアスを含む lib/ コードを import する単発スクリプトを実行する。
 *   esbuild は tsconfig.json の paths（@/* → ./*）を自動解決するため、
 *   tsx/ts-node 無しで TS を実行できる。
 *
 * 実行: node scripts/run.mjs <entry.ts> [args...]
 */
import { build } from "esbuild"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join, resolve } from "node:path"
import { rmSync } from "node:fs"

const __dirname = dirname(fileURLToPath(import.meta.url))

const entry = process.argv[2]
if (!entry) {
  console.error("使い方: node scripts/run.mjs <entry.ts> [args...]")
  process.exit(1)
}

const entryPath = resolve(process.cwd(), entry)
const outFile = join(__dirname, `.run.${Date.now()}.tmp.mjs`)

try {
  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outfile: outFile,
    // Node 組み込み & SDK はバンドルせず実行時解決（高速化）
    packages: "external",
    logLevel: "warning",
  })

  await import(pathToFileURL(outFile).href)
} finally {
  try {
    rmSync(outFile, { force: true })
  } catch {
    // 後始末失敗は無視
  }
}
