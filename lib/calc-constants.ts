export const MONTHLY_MEMBER_FEE_EX_TAX = 2_980

// ── LTV計算シート(元スプレッドシート)の入力定数 ──
/** 初月継続率 (入力欄!C68): 月1→月2の継続率 */
export const FIRST_MONTH_RETENTION_RATE = 1.0
/** 2か月目以降継続率 (入力欄!C69): 月3以降の継続率 */
export const SUBSEQUENT_RETENTION_RATE = 0.94
/** 理想の獲得単価の対LTV比率 (LTV計算!I10 = 年間LTV×30%) */
export const IDEAL_ACQUISITION_COST_LTV_RATIO = 0.3

// ── 変動費（1人あたり。事業計画!L6:L10）の定数 ──
/** アプリ利用料/人（入力欄!C74 = IF(ロイヤリティ=0, 0, 50)）。ロイヤリティ有り時のみ発生 */
export const APP_FEE_PER_MEMBER_WITH_ROYALTY = 50
/** サプリの原価率（事業計画!L10 = サプリ単価 × 0.7 × 加入構成比） */
export const SUPPLEMENT_COST_RATE = 0.7
