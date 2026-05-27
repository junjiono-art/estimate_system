---
name: lambda-build
description: Build and package all AWS Lambda functions for deployment. Compiles TypeScript with esbuild, outputs individual zips to lambda/dist/zips/ and a combined lambda-all.zip.
disable-model-invocation: true
---

Run the Lambda build pipeline:

1. Run `npm run lambda:package:all` from the repo root.
2. Confirm `lambda/dist/zips/` contains updated `.zip` files for each `ES_*` function.
3. Report which functions were built and the total output size if available.
4. Note: upload to AWS Lambda is manual — share the zip paths so the user can upload via AWS Console or CLI.
