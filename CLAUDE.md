# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

##　言語設定
- 常に日本語で会話を行う
- コメントも日本語
- エラーメッセージの説明も日本語
- ドキュメントも日本語


## Project

**フィットネスジム出店試算ツール (Fitness Gym Store Estimate System)**  
Next.js 16 frontend + AWS Lambda backend. Calculates investment costs, revenue projections, and payback period for gym store openings.
- 新店舗を出す際の費用を試算するためのもの
- マスタ管理＞ロジック可視化では、試算で使用する計算パラメータを、ユーザーによる手動更新を可能とすることを目的としてます。(ゴール)


## 実行環境
- aws amplify
- データは基本的にDynamoDB

## Tech Stack

- **Next.js 16** (App Router, React 19, TypeScript 5.7)
- **Tailwind CSS v4** with OKLCH color system — do not use hex/HSL color values
- **Shadcn/ui** (New York style) + Radix UI primitives
- **AWS Lambda** (Node.js 20, esbuild-bundled) + **DynamoDB** (SDK v3)
- **React Hook Form** + **Zod** for form validation
- Path alias: `@/` maps to the repo root

## Key Commands

```bash
npm run dev              # Dev server (port 3000)
npm run build            # Next.js production build
npm run lint             # ESLint
npm run lambda:build     # Compile + zip all Lambda functions → lambda/dist/zips/
npm run lambda:package:all   # Full Lambda build + create lambda-all.zip
```

Use **npm** (not pnpm) — both lock files exist but npm is primary.

## Required Env Vars

```
ESTAT_APP_ID          # Japanese e-Stat API key
LAMBDA_API_BASE_URL   # Empty locally → uses Next.js BFF routes as fallback
LAMBDA_API_KEY        # Lambda API authentication key
```

See `.env.local` for full list. Production secrets are injected via AWS Amplify at build time.

## Architecture

- `app/api/` — Next.js BFF routes. When `LAMBDA_API_BASE_URL` is set, some routes proxy to Lambda; otherwise they serve locally.
- `lambda/functions/` — Lambda handlers, all named `ES_*.ts`. Build output goes to `lambda/dist/`.
- `lib/formula-*.ts` — Custom formula evaluation engine (core business logic). Handles token parsing, dependency resolution, and fallback strategies.
- `components/ui/` — Shadcn/ui primitives (do not edit these directly; use `npx shadcn@latest add` to add components).

## Branch Conventions

Use `feature/`, `fix/`, or `chore/` prefixes (e.g., `feature/export-pdf`, `fix/calc-rounding`).

## Gotchas

- `next.config.mjs` has `ignoreBuildErrors: true` — TypeScript errors do not block the Next.js build. This is intentional.
- All business domain code and documentation (`doc/`) is in Japanese.
- `doc/` and `lambda/` directories are in `.gitignore` but tracked locally (not committed).
- Demographics data comes from the Japanese e-Stat API; prefecture/city lookups use `jp-pref-lookup` and `jp-city-lookup`.
- Regression test CSVs are in `data/regression/` — these reflect expected calculation outputs for Conservative / Standard / Aggressive scenarios.