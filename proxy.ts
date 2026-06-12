import { NextRequest, NextResponse } from "next/server"

// 社内の固定グローバルIPからのアクセスのみを許可するIP制限。
// ALLOWED_IPS（カンマ区切り、例: "203.0.113.10,198.51.100.20"）が
// 未設定の場合はチェックを行わない（ローカル開発を想定したフェイルオープン）。
// 本番（Amplify）では必ず環境変数 ALLOWED_IPS を設定すること。

const allowedIps = (process.env.ALLOWED_IPS ?? "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean)

// プライベート/ループバック/リンクローカル帯（経路上の内部ホップを除外するため）
const PRIVATE_IP_PATTERN =
  /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.|::1$|f[cd])/i

function resolveClientIp(request: NextRequest): string | null {
  // x-forwarded-for は「クライアント申告値, ..., 経路上のプロキシが追記した値」の並び。
  // 先頭はクライアントが偽装できるため、右側から走査して
  // 最初に現れるグローバルIPを実際の接続元とみなす。
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (!forwardedFor) return null

  const candidates = forwardedFor
    .split(",")
    .map((value) => value.trim())
    .reverse()

  for (const candidate of candidates) {
    if (candidate && !PRIVATE_IP_PATTERN.test(candidate)) {
      return candidate
    }
  }
  return null
}

export default function proxy(request: NextRequest) {
  if (allowedIps.length === 0) {
    return NextResponse.next()
  }

  const clientIp = resolveClientIp(request)
  if (!clientIp || !allowedIps.includes(clientIp)) {
    return new NextResponse("アクセスが許可されていないネットワークです。", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    })
  }

  return NextResponse.next()
}

export const config = {
  // 静的アセットはAmplifyのCDNから直接配信されるため対象外（ページ・APIを保護する）
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
