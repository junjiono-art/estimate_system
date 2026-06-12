/**
 * 既定式セットを本番（Lambda/DynamoDB）に新バージョンとして登録し、有効化する。
 *
 * 実行（本番資格情報を環境変数で渡す）:
 *   LAMBDA_API_BASE_URL=https://... LAMBDA_API_KEY=xxxx \
 *     node scripts/run.mjs scripts/register-formula-set.ts
 *
 * 動作:
 *   1. POST /master/formula-sets            … DEFAULT_FORMULA_DEFINITIONS で新版作成
 *   2. POST /master/formula-sets/{ver}/activate … 作成した版を有効化
 *
 * 失敗時は終了コード 1。既存の有効版に戻すには、旧版（例 v0001）を activate すればよい。
 */
import { DEFAULT_FORMULA_DEFINITIONS } from "@/lib/formula-default-set"

const baseUrl = process.env.LAMBDA_API_BASE_URL?.trim().replace(/\/$/, "")
const apiKey = process.env.LAMBDA_API_KEY?.trim()
const basePath = process.env.LAMBDA_FORMULA_SETS_BASE_PATH?.trim() || "/master/formula-sets"
const createdBy = process.env.FORMULA_SET_CREATED_BY?.trim() || "register-script"
const basedOnVersion = process.env.FORMULA_SET_BASED_ON?.trim() || "v0001"

if (!baseUrl) {
  console.error("LAMBDA_API_BASE_URL が未設定です。")
  process.exit(1)
}

const headers: Record<string, string> = { "Content-Type": "application/json" }
if (apiKey) headers["x-api-key"] = apiKey

async function main() {
  // 1. 新版作成
  const createRes = await fetch(`${baseUrl}${basePath}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      comment: "ロジック可視化6式をExcel準拠で登録（initialJoiners/paymentFee/monthlyRoyalty/appFee/adCostMonthly/monthlyCost）",
      createdBy,
      basedOnVersion,
      formulas: DEFAULT_FORMULA_DEFINITIONS,
    }),
  })

  const createPayload = await createRes.json().catch(() => null)
  if (!createRes.ok) {
    console.error("式セット作成に失敗:", createRes.status, JSON.stringify(createPayload, null, 2))
    process.exit(1)
  }

  const newVersion: string | undefined = createPayload?.formulaSet?.setVersion
  if (!newVersion) {
    console.error("作成レスポンスに setVersion がありません:", JSON.stringify(createPayload, null, 2))
    process.exit(1)
  }
  console.log(`✓ 新式セット作成: ${newVersion}`)

  // 2. 有効化
  const activateRes = await fetch(`${baseUrl}${basePath}/${encodeURIComponent(newVersion)}/activate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ updatedBy: createdBy }),
  })

  const activatePayload = await activateRes.json().catch(() => null)
  if (!activateRes.ok) {
    console.error("有効化に失敗:", activateRes.status, JSON.stringify(activatePayload, null, 2))
    console.error(`※ ${newVersion} は作成済み。手動で activate するか、旧版を有効化してください。`)
    process.exit(1)
  }

  console.log(`✓ 有効化完了: ${newVersion}`)
  console.log("\n完了。/api/master/logic-visualization を再取得すると formulaCount が 6 になります。")
}

main().catch((error) => {
  console.error("登録処理で例外:", error)
  process.exit(1)
})
