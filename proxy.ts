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

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/

function resolveClientIp(request: NextRequest): string | null {
  // x-forwarded-for は「クライアント申告値, ..., 経路上のプロキシが追記した値」の並び。
  // 先頭はクライアントが偽装できるため、右側（プロキシが追記した側）を優先して
  // グローバルIPを実際の接続元とみなす。
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (!forwardedFor) return null

  const candidates = forwardedFor
    .split(",")
    // IPv4-mapped IPv6（::ffff:203.0.113.10）はIPv4表記に正規化して比較する
    .map((value) => value.trim().replace(/^::ffff:/i, ""))
    .reverse()
    .filter((value) => value && !PRIVATE_IP_PATTERN.test(value))

  // 許可リストはIPv4（社内の固定グローバルIP）で運用しているため、
  // 経路にIPv4とIPv6が混在する場合はIPv4を接続元として優先する
  // （CloudFront→オリジン間がIPv6の場合、右端がCloudFrontのIPv6になるため）。
  const ipv4 = candidates.find((value) => IPV4_PATTERN.test(value))
  return ipv4 ?? candidates[0] ?? null
}

export default function proxy(request: NextRequest) {
  if (allowedIps.length === 0) {
    return NextResponse.next()
  }

  const clientIp = resolveClientIp(request)
  if (!clientIp || !allowedIps.includes(clientIp)) {
    // 【一時診断】正規IPが403になる原因特定のため、判定内容を表示する。
    // 原因特定後はこの詳細表示を削除すること（経路情報の露出を避ける）。
    const forwardedFor = request.headers.get("x-forwarded-for") ?? "(なし)"
    return new NextResponse(
      [
        "アクセスが許可されていないネットワークです。",
        "",
        `判定された接続元IP: ${clientIp ?? "(判定不能)"}`,
        `x-forwarded-for: ${forwardedFor}`,
      ].join("\n"),
      {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    )
  }

  return NextResponse.next()
}

export const config = {
  // 静的アセットはAmplifyのCDNから直接配信されるため対象外（ページ・APIを保護する）
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
