// lib/calc-constants.ts
var MONTHLY_MEMBER_FEE_EX_TAX = 2980;
var FIRST_MONTH_RETENTION_RATE = 1;
var SUBSEQUENT_RETENTION_RATE = 0.94;
var IDEAL_ACQUISITION_COST_LTV_RATIO = 0.3;
var APP_FEE_PER_MEMBER_WITH_ROYALTY = 50;
var SUPPLEMENT_COST_RATE = 0.7;

// lib/average-price.ts
function computeAveragePrice(pricing) {
  const optionRevenue = pricing.options.reduce((acc, opt) => acc + opt.price * opt.ratio, 0);
  return optionRevenue + pricing.memberFeeExTax;
}
function computeVariableCostPerMember(averagePrice, royaltyRate, paymentFeeRate, pricing) {
  const appFee = royaltyRate > 0 ? APP_FEE_PER_MEMBER_WITH_ROYALTY : 0;
  const royaltyCost = royaltyRate > 0 ? averagePrice * royaltyRate : 0;
  const paymentFee = averagePrice * paymentFeeRate;
  const supplement = pricing.options.filter((opt) => opt.label.includes("\u30B5\u30D7\u30EA")).reduce((acc, opt) => acc + opt.price * SUPPLEMENT_COST_RATE * opt.ratio, 0);
  return appFee + royaltyCost + paymentFee + supplement;
}

// lib/capacity.ts
function computeCapacity(floorAreaTsubo, locationType, params) {
  const area = Number.isFinite(floorAreaTsubo) && floorAreaTsubo > 0 ? floorAreaTsubo : 0;
  const concurrentUsers = params.areaPerMemberTsubo > 0 ? area / params.areaPerMemberTsubo : 0;
  const weeklySlots = concurrentUsers * params.businessHours * 7;
  const usageDemand = params.visitsPerWeek * params.avgStayHours;
  const capacityBase = usageDemand > 0 ? weeklySlots / usageDemand : 0;
  const ruralAdj = locationType === "rural" ? params.ruralFactor : 1;
  const maxMembers = capacityBase * params.avgUtilization * ruralAdj;
  const parkingSpaces = Math.round(params.parkingUtilization * concurrentUsers);
  return { maxMembers, concurrentUsers, parkingSpaces };
}

// lib/member-growth.ts
function buildSignageSeries(base, cfg, months) {
  const series = [];
  const totalMonths = Math.max(months, 12);
  for (let m = 1; m <= totalMonths; m += 1) {
    let value;
    if (m > 12) {
      value = series[11];
    } else if (m === 1) {
      value = base;
    } else if (m === 2) {
      value = base * cfg.month2Factor;
    } else if (m === 3) {
      value = base * cfg.month3Factor;
    } else if (m === 4) {
      value = base * cfg.month4Factor;
    } else {
      value = series[m - 2] * cfg.monthlyDecay;
    }
    series[m - 1] = value;
  }
  return series.slice(0, months);
}
function adEffectiveness(month, signage) {
  const year = Math.ceil(month / 12);
  if (year <= 1) return 1;
  if (year <= 5) return signage.adEffectivenessYear2to5;
  return signage.adEffectivenessYear6Plus;
}
function webJoinersForMonth(month, initialJoiners, acq, signage) {
  if (month === 1) return initialJoiners * acq.channelSplit.web;
  const base = acq.semCpaY1Y2 > 0 ? acq.webBudgetMonthly / acq.semCpaY1Y2 : 0;
  return base * adEffectiveness(month, signage);
}
function snsJoinersForMonth(month, initialJoiners, acq, signage) {
  if (month === 1) return initialJoiners * acq.channelSplit.sns + acq.snsInitialBonus;
  const base = acq.snsAdUnitCost > 0 ? acq.snsBudgetMonthly / acq.snsAdUnitCost : 0;
  return base * adEffectiveness(month, signage);
}
function simulateMemberGrowth(params) {
  const { initialJoiners, maxMembers, months, retention, acquisition, signage } = params;
  const cap = maxMembers;
  const signageBaseRaw = initialJoiners * acquisition.channelSplit.signage * signage.baseFactor;
  const signageBase = signage.roundDownBase ? Math.floor(signageBaseRaw) : signageBaseRaw;
  const signageSeries = buildSignageSeries(signageBase, signage, months);
  const result = [];
  const newSeries = [];
  const retainSeries = [];
  for (let m = 1; m <= months; m += 1) {
    const prevMembers = m === 1 ? 0 : result[m - 2].members;
    let organic = 0;
    let referral = 0;
    if (m >= 2 && cap > 0) {
      const headroomRatio = (cap - prevMembers) / cap;
      organic = prevMembers * acquisition.organicSearchRate * headroomRatio;
      referral = acquisition.referralRate * prevMembers * headroomRatio;
    }
    const web = webJoinersForMonth(m, initialJoiners, acquisition, signage);
    const sns = snsJoinersForMonth(m, initialJoiners, acquisition, signage);
    const signageJoiners = signageSeries[m - 1];
    const newMembers = signageJoiners + web + sns + organic + referral;
    const retainedMembers = m === 1 ? 0 : newSeries[m - 2] * retention.firstMonth + retainSeries[m - 2] * retention.subsequent;
    newSeries[m - 1] = newMembers;
    retainSeries[m - 1] = retainedMembers;
    const uncapped = newMembers + retainedMembers;
    const members = cap > 0 ? Math.min(uncapped, cap) : uncapped;
    result.push({
      month: m,
      newMembers,
      retainedMembers,
      members,
      signageJoiners,
      webJoiners: web,
      snsJoiners: sns,
      organicJoiners: organic,
      referralJoiners: referral
    });
  }
  return result;
}

// lib/depreciation.ts
function computeMonthlyDepreciation(investmentBreakdown, params, yearsByField) {
  if (!investmentBreakdown) return 0;
  const yearsSource = { ...params.usefulLifeYears, ...yearsByField ?? {} };
  let monthly = 0;
  for (const [fieldId, years] of Object.entries(yearsSource)) {
    const amount = Number(investmentBreakdown[fieldId]);
    if (Number.isFinite(amount) && amount > 0 && Number(years) > 0) {
      monthly += amount / Number(years) / 12;
    }
  }
  return monthly;
}

// lib/ltv.ts
var TOTAL_MONTHS = 24;
function calculateLtv(input = {}) {
  const monthlyFee = input.monthlyFee ?? MONTHLY_MEMBER_FEE_EX_TAX;
  const firstMonthRetention = input.firstMonthRetention ?? FIRST_MONTH_RETENTION_RATE;
  const subsequentRetention = input.subsequentRetention ?? SUBSEQUENT_RETENTION_RATE;
  const retention = (month) => {
    if (month <= 1) return 1;
    if (month === 2) return firstMonthRetention;
    return subsequentRetention;
  };
  const fees = [];
  for (let m = 1; m <= TOTAL_MONTHS; m += 1) {
    fees[m - 1] = m === 1 ? monthlyFee : fees[m - 2] * retention(m);
  }
  const sumFees = (fromMonth, toMonth) => fees.slice(fromMonth - 1, toMonth).reduce((acc, v2) => acc + v2, 0);
  const productRetention = (fromMonth, toMonth) => {
    let product = 1;
    for (let m = fromMonth; m <= toMonth; m += 1) product *= retention(m);
    return product;
  };
  const ltv1Year = sumFees(1, 12);
  const halfYearRetentionRate = productRetention(2, 6);
  const oneYearRetentionRate = productRetention(2, 12);
  return {
    monthlyExpectedFees: fees,
    ltv1Year,
    halfYearRetentionRate,
    halfYearChurnRate: 1 - halfYearRetentionRate,
    // F8 = 1 - E8
    oneYearRetentionRate,
    oneYearChurnRate: 1 - oneYearRetentionRate,
    // F14 = 1 - E14
    acquisitionCostCapHalfYear: sumFees(1, 6),
    // I8 = SUM(C3:C8)
    idealAcquisitionCost: ltv1Year * IDEAL_ACQUISITION_COST_LTV_RATIO
    // I10 = E3 × 30%
  };
}

// lib/server/formula-runtime.ts
function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
function buildInitialPhaseContext(input, calcParams) {
  if (!input) return {};
  const { km1Ring = 0, km3Ring = 0, km5Ring = 0 } = input.populationByRadius ?? {};
  return {
    floorAreaTsubo: toNumber(input.floorAreaTsubo, 0),
    competitorCount: toNumber(input.competitorCount, 0),
    // locationType: 0=suburban, 1=urban, 2=rural
    locationType: input.locationType === "urban" ? 1 : input.locationType === "rural" ? 2 : 0,
    populationKm1Ring: km1Ring,
    populationKm3Ring: km3Ring,
    populationKm5Ring: km5Ring,
    rentPerTsubo: toNumber(input.rentPerTsubo, 0),
    runningCostTotal: toNumber(input.runningCostTotal, 0),
    // 競合影響率（initialJoiners 式が参照）。パラメータ連動維持
    competitorImpactUpTo2: toNumber(calcParams?.competitorImpact?.upTo2, 0),
    competitorImpactFor3: toNumber(calcParams?.competitorImpact?.for3, 0),
    competitorImpactFor4: toNumber(calcParams?.competitorImpact?.for4, 0),
    competitorImpactOver4: toNumber(calcParams?.competitorImpact?.over4, 0)
  };
}
function buildFormulaContext({
  input,
  calcParams,
  derived,
  initialPhase
}) {
  const rentPerTsubo = toNumber(input?.rentPerTsubo, 0);
  const runningCostTotal = toNumber(input?.runningCostTotal, 0);
  const royaltyRate = toNumber(input?.royaltyRate, 0);
  const franchiseRate = toNumber(input?.franchiseRate ?? input?.royaltyRate, 0);
  const { km1Ring = 0, km3Ring = 0, km5Ring = 0 } = input?.populationByRadius ?? {};
  return {
    // ───── Input層 ─────
    floorAreaTsubo: toNumber(input?.floorAreaTsubo, 0),
    rentPerTsubo,
    competitorCount: toNumber(input?.competitorCount, 0),
    royaltyRate,
    franchiseRate,
    runningCostTotal,
    initialInvestmentTotal: toNumber(input?.initialInvestmentTotal, 0),
    // ───── Geospatial層（新規） ─────
    populationKm1Ring: km1Ring,
    populationKm3Ring: km3Ring,
    populationKm5Ring: km5Ring,
    locationType: input?.locationType === "urban" ? 1 : input?.locationType === "rural" ? 2 : 0,
    // ───── Param層 ─────
    paymentFeeRate: toNumber(calcParams.paymentFeeRate, 0),
    royaltyCapMonthly: toNumber(calcParams.royaltyCapMonthly, 0),
    appFeeMonthly: toNumber(calcParams.appFeeMonthly, 0),
    // 広告費スケジュール（adCostMonthly 式が参照。パラメータ連動維持）
    adCostYear1Month1: toNumber(calcParams.adCost?.year1Month1, 0),
    adCostYear1Month2: toNumber(calcParams.adCost?.year1Month2, 0),
    adCostYear1Month3To4: toNumber(calcParams.adCost?.year1Month3To4, 0),
    adCostYear1Month5To12: toNumber(calcParams.adCost?.year1Month5To12, 0),
    adCostYear2Monthly: toNumber(calcParams.adCost?.year2Monthly, 0),
    adCostYear3PlusMonthly: toNumber(calcParams.adCost?.year3PlusMonthly, 0),
    // ───── Constant層 ─────
    monthlyMemberFeeExTax: toNumber(MONTHLY_MEMBER_FEE_EX_TAX, 0),
    // ───── Derived層（月別） ─────
    month: toNumber(derived?.month, 1),
    members: toNumber(derived?.members, 0),
    monthlyRevenue: toNumber(derived?.monthlyRevenue, 0),
    monthlyRent: toNumber(derived?.monthlyRent, rentPerTsubo),
    monthlyRunningCost: toNumber(derived?.monthlyRunningCost, runningCostTotal),
    adCostMonthly: toNumber(derived?.adCostMonthly, 0),
    paymentFee: toNumber(derived?.paymentFee, 0),
    monthlyRoyalty: toNumber(derived?.monthlyRoyalty, 0),
    // ───── Derived層（初期値層・新規） ─────
    initialJoiners: toNumber(initialPhase?.initialJoiners, 0),
    demandMultiplier: toNumber(initialPhase?.demandMultiplier, 1)
  };
}
function readVar(token, context) {
  const key = token.varKey || token.namedConstKey;
  if (!key) throw new Error("\u5909\u6570\u30AD\u30FC\u304C\u672A\u6307\u5B9A\u3067\u3059\u3002");
  const value = context[key];
  if (value === void 0) {
    throw new Error(`\u5909\u6570 "${key}" \u304C context \u306B\u5B58\u5728\u3057\u307E\u305B\u3093\u3002`);
  }
  return value;
}
function readConst(token) {
  const value = toNumber(token.value, NaN);
  if (!Number.isFinite(value)) throw new Error("\u6570\u5024\u5B9A\u6570\u304C\u4E0D\u6B63\u3067\u3059\u3002");
  return value;
}
function tokenIsOpenParen(token) {
  return token?.type === "paren" && token.paren === "(";
}
function tokenIsCloseParen(token) {
  return token?.type === "paren" && token.paren === ")";
}
function tokenOperator(token) {
  if (token.type === "op") {
    if (token.op) return token.op;
    if (typeof token.value === "string") return token.value;
  }
  return null;
}
var COMPARISON_OPERATORS = /* @__PURE__ */ new Set([">", "<", ">=", "<=", "==", "!="]);
function precedence(operator) {
  if (operator === "*" || operator === "/") return 3;
  if (operator === "+" || operator === "-") return 2;
  if (COMPARISON_OPERATORS.has(operator)) return 1;
  return -1;
}
var Parser = class {
  constructor(tokens, context) {
    this.tokens = tokens;
    this.context = context;
    this.index = 0;
  }
  parse() {
    const value = this.parseExpression(0);
    if (this.index !== this.tokens.length) {
      throw new Error("\u5F0F\u306E\u672B\u5C3E\u306B\u672A\u51E6\u7406\u30C8\u30FC\u30AF\u30F3\u304C\u3042\u308A\u307E\u3059\u3002");
    }
    if (!Number.isFinite(value)) {
      throw new Error("\u8A08\u7B97\u7D50\u679C\u304C\u4E0D\u6B63\u3067\u3059\u3002");
    }
    return value;
  }
  parseExpression(minPrec) {
    let left = this.parsePrimary();
    while (true) {
      const token = this.peek();
      if (!token) break;
      const op = tokenOperator(token);
      if (!op) break;
      const prec = precedence(op);
      if (prec < minPrec) break;
      this.consume();
      const right = this.parseExpression(prec + 1);
      left = this.applyOperator(op, left, right);
    }
    return left;
  }
  parsePrimary() {
    const token = this.consume();
    if (!token) throw new Error("\u5F0F\u304C\u7A7A\u3067\u3059\u3002");
    if (token.type === "const") {
      return readConst(token);
    }
    if (token.type === "var" || token.type === "namedConst") {
      return readVar(token, this.context);
    }
    if (tokenIsOpenParen(token)) {
      const value = this.parseExpression(0);
      const close = this.consume();
      if (!tokenIsCloseParen(close)) {
        throw new Error("\u9589\u3058\u62EC\u5F27 ')' \u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059\u3002");
      }
      return value;
    }
    if (token.type === "fn") {
      const fn = String(token.fnName || "");
      const open = this.consume();
      if (!tokenIsOpenParen(open)) {
        throw new Error(`\u95A2\u6570 ${fn} \u306E\u5F8C\u306B '(' \u304C\u5FC5\u8981\u3067\u3059\u3002`);
      }
      const args = this.parseFunctionArgs(fn);
      return this.applyFunction(fn, args);
    }
    throw new Error(`\u672A\u5BFE\u5FDC\u30C8\u30FC\u30AF\u30F3\u3067\u3059: ${token.type}`);
  }
  // 関数引数をカンマ区切りでパースする（'(' は呼び出し元で消費済み）。
  parseFunctionArgs(fn) {
    const args = [];
    args.push(this.parseExpression(0));
    while (true) {
      const next = this.peek();
      if (next && tokenOperator(next) === ",") {
        this.consume();
        args.push(this.parseExpression(0));
        continue;
      }
      break;
    }
    const close = this.consume();
    if (!tokenIsCloseParen(close)) {
      throw new Error(`\u95A2\u6570 ${fn} \u306E\u9589\u3058\u62EC\u5F27 ')' \u304C\u4E0D\u8DB3\u3057\u3066\u3044\u307E\u3059\u3002`);
    }
    return args;
  }
  applyFunction(fn, args) {
    const expect = (n) => {
      if (args.length !== n) {
        throw new Error(`\u95A2\u6570 ${fn} \u306F\u5F15\u6570 ${n} \u500B\u304C\u5FC5\u8981\u3067\u3059\uFF08\u5B9F\u969B: ${args.length}\uFF09\u3002`);
      }
    };
    if (fn === "round") {
      expect(1);
      return Math.round(args[0]);
    }
    if (fn === "ceil") {
      expect(1);
      return Math.ceil(args[0]);
    }
    if (fn === "floor") {
      expect(1);
      return Math.floor(args[0]);
    }
    if (fn === "min") {
      expect(2);
      return Math.min(args[0], args[1]);
    }
    if (fn === "max") {
      expect(2);
      return Math.max(args[0], args[1]);
    }
    if (fn === "if") {
      expect(3);
      return args[0] !== 0 ? args[1] : args[2];
    }
    throw new Error(`\u672A\u5BFE\u5FDC\u306E\u95A2\u6570\u3067\u3059: ${fn}`);
  }
  applyOperator(op, left, right) {
    if (op === "+") return left + right;
    if (op === "-") return left - right;
    if (op === "*") return left * right;
    if (op === "/") {
      if (right === 0) throw new Error("0\u9664\u7B97\u306F\u3067\u304D\u307E\u305B\u3093\u3002");
      return left / right;
    }
    if (op === ">") return left > right ? 1 : 0;
    if (op === "<") return left < right ? 1 : 0;
    if (op === ">=") return left >= right ? 1 : 0;
    if (op === "<=") return left <= right ? 1 : 0;
    if (op === "==") return left === right ? 1 : 0;
    if (op === "!=") return left !== right ? 1 : 0;
    throw new Error(`\u672A\u5BFE\u5FDC\u6F14\u7B97\u5B50\u3067\u3059: ${op}`);
  }
  peek() {
    return this.tokens[this.index];
  }
  consume() {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }
};
function evaluateFormulaTokens(tokens, context) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("\u30C8\u30FC\u30AF\u30F3\u304C\u7A7A\u3067\u3059\u3002");
  }
  return new Parser(tokens, context).parse();
}
function evaluateFormulaByKey(setRecord, formulaKey, context) {
  if (!setRecord?.formulas) return null;
  const formula = setRecord.formulas[formulaKey];
  if (!formula?.tokens?.length) return null;
  return evaluateFormulaTokens(formula.tokens, context);
}

// lib/fitness-machine-cost.ts
var FITNESS_MACHINE_BASE_COST = 375e4;
var PREFECTURE_MACHINE_UNIT_PRICE = {
  \u5317\u6D77\u9053: 22e4,
  \u9752\u68EE: 2e5,
  \u5CA9\u624B: 2e5,
  \u5BAE\u57CE: 2e5,
  \u79CB\u7530: 2e5,
  \u5C71\u5F62: 2e5,
  \u798F\u5CF6: 2e5,
  \u8328\u57CE: 18e4,
  \u7FA4\u99AC: 18e4,
  \u57FC\u7389: 18e4,
  \u6803\u6728: 18e4,
  \u5343\u8449: 18e4,
  \u6771\u4EAC: 18e4,
  \u795E\u5948\u5DDD: 18e4,
  \u65B0\u6F5F: 2e5,
  \u5BCC\u5C71: 18e4,
  \u77F3\u5DDD: 18e4,
  \u798F\u4E95: 18e4,
  \u5C71\u68A8: 18e4,
  \u9577\u91CE: 18e4,
  \u5C90\u961C: 16e4,
  \u9759\u5CA1: 17e4,
  \u611B\u77E5: 15e4,
  \u4E09\u91CD: 16e4,
  \u6ECB\u8CC0: 17e4,
  \u4EAC\u90FD: 17e4,
  \u5927\u962A: 17e4,
  \u5175\u5EAB: 17e4,
  \u5948\u826F: 17e4,
  \u548C\u6B4C\u5C71: 18e4,
  \u9CE5\u53D6: 18e4,
  \u5CF6\u6839: 18e4,
  \u5CA1\u5C71: 18e4,
  \u5E83\u5CF6: 18e4,
  \u5C71\u53E3: 18e4,
  \u5FB3\u5CF6: 18e4,
  \u9999\u5DDD: 2e5,
  \u611B\u5A9B: 2e5,
  \u9AD8\u77E5: 2e5,
  \u798F\u5CA1: 2e5,
  \u4F50\u8CC0: 2e5,
  \u9577\u5D0E: 2e5,
  \u718A\u672C: 2e5,
  \u5927\u5206: 2e5,
  \u5BAE\u5D0E: 2e5,
  \u9E7F\u5150\u5CF6: 2e5,
  \u6C96\u7E04: 22e4
};
var PREFECTURE_FULL_NAMES = [
  "\u5317\u6D77\u9053",
  "\u9752\u68EE\u770C",
  "\u5CA9\u624B\u770C",
  "\u5BAE\u57CE\u770C",
  "\u79CB\u7530\u770C",
  "\u5C71\u5F62\u770C",
  "\u798F\u5CF6\u770C",
  "\u8328\u57CE\u770C",
  "\u6803\u6728\u770C",
  "\u7FA4\u99AC\u770C",
  "\u57FC\u7389\u770C",
  "\u5343\u8449\u770C",
  "\u6771\u4EAC\u90FD",
  "\u795E\u5948\u5DDD\u770C",
  "\u65B0\u6F5F\u770C",
  "\u5BCC\u5C71\u770C",
  "\u77F3\u5DDD\u770C",
  "\u798F\u4E95\u770C",
  "\u5C71\u68A8\u770C",
  "\u9577\u91CE\u770C",
  "\u5C90\u961C\u770C",
  "\u9759\u5CA1\u770C",
  "\u611B\u77E5\u770C",
  "\u4E09\u91CD\u770C",
  "\u6ECB\u8CC0\u770C",
  "\u4EAC\u90FD\u5E9C",
  "\u5927\u962A\u5E9C",
  "\u5175\u5EAB\u770C",
  "\u5948\u826F\u770C",
  "\u548C\u6B4C\u5C71\u770C",
  "\u9CE5\u53D6\u770C",
  "\u5CF6\u6839\u770C",
  "\u5CA1\u5C71\u770C",
  "\u5E83\u5CF6\u770C",
  "\u5C71\u53E3\u770C",
  "\u5FB3\u5CF6\u770C",
  "\u9999\u5DDD\u770C",
  "\u611B\u5A9B\u770C",
  "\u9AD8\u77E5\u770C",
  "\u798F\u5CA1\u770C",
  "\u4F50\u8CC0\u770C",
  "\u9577\u5D0E\u770C",
  "\u718A\u672C\u770C",
  "\u5927\u5206\u770C",
  "\u5BAE\u5D0E\u770C",
  "\u9E7F\u5150\u5CF6\u770C",
  "\u6C96\u7E04\u770C"
];
function toPrefectureKey(fullName) {
  const s = fullName.replace(/[\s　]/g, "");
  if (s === "\u5317\u6D77\u9053") return "\u5317\u6D77\u9053";
  return s.replace(/(都|府|県)$/u, "");
}
function extractPrefectureFromAddress(address) {
  if (!address) return null;
  const normalized = address.replace(/[\s　]/g, "");
  const matched = PREFECTURE_FULL_NAMES.find((name) => normalized.startsWith(name));
  return matched ? toPrefectureKey(matched) : null;
}
function getFitnessMachineUnitPriceByAddress(address, fallbackUnitPrice) {
  const fallback = Math.max(0, Number(fallbackUnitPrice) || 0);
  const prefecture = extractPrefectureFromAddress(address);
  if (!prefecture) return fallback;
  return PREFECTURE_MACHINE_UNIT_PRICE[prefecture] ?? fallback;
}
function getFitnessMachineSurchargeByAddress(address) {
  const unitPrice = getFitnessMachineUnitPriceByAddress(address, 0);
  return unitPrice;
}
function resolveFitnessMachineCostByAddress(address, baseCost) {
  const base = Math.max(0, Number(baseCost) || FITNESS_MACHINE_BASE_COST);
  return base + getFitnessMachineSurchargeByAddress(address);
}

// lib/machine-maintenance.ts
function resolveMaintenanceTsuboTier(tiers, floorAreaTsubo) {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => a.minTsubo - b.minTsubo);
  let chosen = sorted[0];
  for (const tier of sorted) {
    if (floorAreaTsubo >= tier.minTsubo) chosen = tier;
  }
  return chosen;
}
function resolveMaintenanceUnitPrice(prefecture, config) {
  const override = prefecture ? config.unitPriceByPrefecture?.[prefecture] : void 0;
  if (override != null && Number.isFinite(Number(override))) {
    return Math.max(0, Number(override));
  }
  const distance = prefecture ? config.distanceByPrefecture?.[prefecture] : void 0;
  if (distance != null && Number.isFinite(Number(distance))) {
    const stepKm = Math.max(1, Number(config.distanceStepKm) || 100);
    const stepCost = Math.max(0, Number(config.distanceStepCost) || 0);
    const base = Math.max(0, Number(config.baseUnitPrice) || 0);
    const divisor = Math.max(1, Number(config.unitPriceDivisor) || 1);
    const n = Math.floor(Math.max(0, Number(distance)) / stepKm);
    const o2 = n * stepCost;
    const p = base + o2;
    return p / divisor;
  }
  return Math.max(0, Number(config.fallbackUnitPrice) || 0);
}
function computeMachineMaintenanceMonthly(args) {
  const { address, floorAreaTsubo, royaltyRate, config } = args;
  if (!config) return 0;
  if (config.applyOnlyWhenFranchise && royaltyRate <= 0) return 0;
  const interval = Math.max(1, Number(config.intervalMonths) || 1);
  const prefecture = extractPrefectureFromAddress(address);
  const unitPrice = resolveMaintenanceUnitPrice(prefecture, config);
  const tier = resolveMaintenanceTsuboTier(config.tsuboTiers, Number(floorAreaTsubo) || 0);
  if (!tier) return 0;
  const workers = Math.max(0, Number(tier.workers) || 0);
  const days = Math.max(0, Number(tier.days) || 0);
  const perVisit = unitPrice * workers * days;
  return Math.round(perVisit / interval);
}

// lib/formula-dependencies.ts
var DEFAULT_FORMULA_DEPENDENCIES = {
  // Phase: pre （初月計算層）
  initialJoiners: {
    key: "initialJoiners",
    label: "\u521D\u6708\u5165\u4F1A\u4EBA\u6570",
    dependsOn: [],
    // 入力層のみに依存
    phase: "pre"
  },
  demandMultiplier: {
    key: "demandMultiplier",
    label: "\u9700\u8981\u4E57\u6570",
    dependsOn: ["initialJoiners"],
    // ← initialJoiners に依存
    phase: "pre"
  },
  // Phase: monthly （月別計算層）
  paymentFee: {
    key: "paymentFee",
    label: "\u6C7A\u6E08\u624B\u6570\u6599",
    dependsOn: [],
    // 入力層のみに依存
    phase: "monthly"
  },
  monthlyRoyalty: {
    key: "monthlyRoyalty",
    label: "\u6708\u6B21\u30ED\u30A4\u30E4\u30EA\u30C6\u30A3",
    dependsOn: ["paymentFee"],
    // ← paymentFee に依存
    phase: "monthly"
  },
  appFee: {
    key: "appFee",
    label: "\u30A2\u30D7\u30EA\u5229\u7528\u6599",
    dependsOn: ["paymentFee", "monthlyRoyalty"],
    // ← 両者に依存
    phase: "monthly"
  },
  monthlyCost: {
    key: "monthlyCost",
    // 総コスト = 家賃+ランニング+広告+決済手数料+ロイヤリティ+アプリ利用料。
    // 評価値を context に注入させるため、加算対象の式すべてを依存に含める。
    label: "\u6708\u6B21\u7DCF\u30B3\u30B9\u30C8",
    dependsOn: ["paymentFee", "monthlyRoyalty", "appFee", "adCostMonthly"],
    phase: "monthly"
  },
  adCostMonthly: {
    key: "adCostMonthly",
    label: "\u6708\u6B21\u5E83\u544A\u8CBB",
    dependsOn: [],
    // テーブル参照（現在）
    phase: "monthly"
  }
};
function buildFormulaDependencyGraph(formulaSet, defaultDeps = DEFAULT_FORMULA_DEPENDENCIES) {
  const nodes = {};
  const visited = /* @__PURE__ */ new Set();
  const visiting = /* @__PURE__ */ new Set();
  const circularPath = [];
  const allKeys = new Set(Object.keys(defaultDeps));
  if (formulaSet?.formulas) {
    Object.keys(formulaSet.formulas).forEach((key) => allKeys.add(key));
  }
  allKeys.forEach((key) => {
    const userDef = formulaSet?.formulas?.[key];
    const defaultDef = defaultDeps[key];
    nodes[key] = {
      key,
      label: userDef?.label || defaultDef?.label || key,
      dependsOn: defaultDef?.dependsOn || [],
      // 依存関係はデフォルト定義から
      phase: defaultDef?.phase || "monthly"
    };
  });
  const sorted = [];
  function visit(key, path) {
    if (visited.has(key)) return true;
    if (visiting.has(key)) {
      circularPath.push(...path, key);
      return false;
    }
    visiting.add(key);
    const node = nodes[key];
    if (node?.dependsOn) {
      for (const dep of node.dependsOn) {
        if (!visit(dep, [...path, key])) {
          return false;
        }
      }
    }
    visiting.delete(key);
    visited.add(key);
    sorted.push(key);
    return true;
  }
  for (const key of allKeys) {
    if (!visited.has(key)) {
      if (!visit(key, [])) {
        return {
          nodes,
          executionOrder: sorted,
          hasCircularDependency: true,
          circularPath
        };
      }
    }
  }
  return {
    nodes,
    executionOrder: sorted,
    hasCircularDependency: false
  };
}
function validateFormulaDependencies(graph) {
  const errors = [];
  if (graph.hasCircularDependency) {
    errors.push(`\u5FAA\u74B0\u4F9D\u5B58\u3092\u691C\u51FA: ${graph.circularPath?.join(" \u2192 ") || ""}`);
  }
  Object.entries(graph.nodes).forEach(([key, node]) => {
    node.dependsOn?.forEach((dep) => {
      if (!graph.nodes[dep]) {
        errors.push(`\u5F0F "${key}" \u304C\u5B58\u5728\u3057\u306A\u3044\u4F9D\u5B58\u5148 "${dep}" \u3092\u53C2\u7167\u3057\u3066\u3044\u307E\u3059\u3002`);
      }
    });
  });
  return {
    valid: errors.length === 0,
    errors
  };
}

// lib/formula-fallbacks.ts
var FormulaEvaluationErrorLog = class {
  constructor() {
    this.errors = [];
  }
  addError(error) {
    this.errors.push(error);
  }
  hasErrors() {
    return this.errors.length > 0;
  }
  getErrors() {
    return [...this.errors];
  }
  /**
   * 警告をコンソールに出力
   */
  logWarnings() {
    this.errors.forEach((error) => {
      const fallbackInfo = error.fallbackApplied ? `(fallback: ${error.fallbackValue})` : "";
      console.warn(
        `[FormulaEvaluation] ${error.key}: ${error.errorType}`,
        error.message,
        fallbackInfo
      );
    });
  }
  /**
   * ログをリセット
   */
  clear() {
    this.errors = [];
  }
};
function applyConstraints(value, min, max) {
  let result = value;
  if (typeof min === "number") result = Math.max(min, result);
  if (typeof max === "number") result = Math.min(max, result);
  return result;
}

// lib/server/formula-evaluation-engine.ts
var FormulaEvaluationEngine = class {
  constructor(formulaSet, defaultDeps = DEFAULT_FORMULA_DEPENDENCIES) {
    this.evaluationResults = {};
    this.errorLog = new FormulaEvaluationErrorLog();
    this.formulaSet = formulaSet;
    this.defaultDeps = defaultDeps;
    this.graph = buildFormulaDependencyGraph(formulaSet, defaultDeps);
    const validation = validateFormulaDependencies(this.graph);
    if (!validation.valid) {
      throw new Error(`\u5F0F\u306E\u4F9D\u5B58\u95A2\u4FC2\u304C\u4E0D\u6B63\u3067\u3059: ${validation.errors.join(", ")}`);
    }
  }
  /**
   * 指定フェーズの式をすべて評価
   *
   * @param phase "pre" | "monthly" | "post"
   * @param context 式が参照するコンテキスト
   * @param fallbackValues 式が未定義時のデフォルト値
   * @returns 評価結果（key => value）
   */
  evaluatePhase(phase, context, fallbackValues = {}) {
    const results = { ...this.evaluationResults };
    for (const key of this.graph.executionOrder) {
      const node = this.graph.nodes[key];
      if (!node || node.phase !== phase) continue;
      const contextWithDeps = { ...context };
      node.dependsOn?.forEach((dep) => {
        if (results[dep] !== void 0) {
          contextWithDeps[dep] = results[dep];
        }
      });
      const value = this.evaluateFormula(key, contextWithDeps, fallbackValues[key] ?? 0);
      results[key] = value;
    }
    Object.assign(this.evaluationResults, results);
    return results;
  }
  /**
   * 単一の式を評価
   *
   * @param key 式キー
   * @param context コンテキスト
   * @param fallbackValue フォールバック値
   * @returns 評価結果
   */
  evaluateFormula(key, context, fallbackValue) {
    try {
      const formula = this.formulaSet?.formulas?.[key];
      if (!formula?.tokens || formula.tokens.length === 0) {
        this.recordError({
          key,
          errorType: "undefined",
          message: `\u5F0F "${key}" \u304C\u5B9A\u7FA9\u3055\u308C\u3066\u3044\u307E\u305B\u3093\u3002`,
          fallbackApplied: true,
          fallbackValue
        });
        return fallbackValue;
      }
      const evaluated = evaluateFormulaByKey(this.formulaSet, key, context);
      if (evaluated == null || !Number.isFinite(evaluated)) {
        this.recordError({
          key,
          errorType: "runtime",
          message: `\u5F0F "${key}" \u306E\u8A55\u4FA1\u7D50\u679C\u304C\u4E0D\u6B63\u3067\u3059\u3002`,
          fallbackApplied: true,
          fallbackValue
        });
        return fallbackValue;
      }
      const result = formula.roundResult === false ? evaluated : Math.round(evaluated);
      return applyConstraints(result, formula.minValue, formula.maxValue);
    } catch (error) {
      this.recordError({
        key,
        errorType: "runtime",
        message: `\u5F0F "${key}" \u306E\u8A55\u4FA1\u306B\u5931\u6557: ${error instanceof Error ? error.message : String(error)}`,
        fallbackApplied: true,
        fallbackValue
      });
      return fallbackValue;
    }
  }
  /**
   * エラーをログに記録
   */
  recordError(error) {
    this.errorLog.addError(error);
  }
  /**
   * エラーログを取得
   */
  getErrorLog() {
    return this.errorLog;
  }
  /**
   * 評価結果をリセット
   */
  reset() {
    Object.keys(this.evaluationResults).forEach((key) => {
      delete this.evaluationResults[key];
    });
    this.errorLog.clear();
  }
  /**
   * 依存グラフを取得（デバッグ用）
   */
  getDependencyGraph() {
    return this.graph;
  }
};

// lib/server/calc-engine.ts
var PROJECTION_MONTHS = 120;
var INITIAL_INVESTMENT = 2311e4;
var INTERIOR_COST = 15e6;
var DEFAULT_MONTHLY_RENT = 9e5;
var DEFAULT_MONTHLY_RUNNING = 308e3;
var BASE_FLOOR_AREA_TSUBO = 50;
var BASE_SUBURBAN_FIRST_MONTH_JOINERS = 334;
var BASE_URBAN_ESTIMATED_JOINERS = 137;
var BASE_SUBURBAN_ESTIMATED_JOINERS = 137 + 316;
var BASE_RURAL_ESTIMATED_JOINERS = 137 + 316 + 65;
var POPULATION_FACTOR = 1 - 0.26;
var BASE_REGRESSION_INPUT = {
  storeName: "regression-base",
  locationType: "suburban",
  floorAreaTsubo: BASE_FLOOR_AREA_TSUBO,
  rentPerTsubo: DEFAULT_MONTHLY_RENT,
  runningCostTotal: DEFAULT_MONTHLY_RUNNING,
  initialInvestmentTotal: INITIAL_INVESTMENT,
  competitorCount: 2,
  royaltyRate: 0,
  franchiseRate: 0,
  populationByRadius: { km1Ring: 11416, km3Ring: 39505, km5Ring: 64764 }
};
function roundDown1(value) {
  return Math.floor(value * 10) / 10;
}
function getCompetitorImpactRate(competitorCount, calcParams) {
  if (competitorCount <= 0) return 0;
  if (competitorCount <= 2) return calcParams.competitorImpact.upTo2;
  if (competitorCount === 3) return calcParams.competitorImpact.for3;
  if (competitorCount === 4) return calcParams.competitorImpact.for4;
  return calcParams.competitorImpact.over4;
}
function getDemandMultiplier(locationType, competitorCount, calcParams) {
  if (locationType === "urban") {
    const urbanJoiners = BASE_URBAN_ESTIMATED_JOINERS * POPULATION_FACTOR;
    return urbanJoiners / BASE_SUBURBAN_FIRST_MONTH_JOINERS;
  }
  if (locationType === "rural") {
    const ruralJoiners = BASE_RURAL_ESTIMATED_JOINERS * POPULATION_FACTOR * (1 - getCompetitorImpactRate(competitorCount, calcParams));
    return ruralJoiners / BASE_SUBURBAN_FIRST_MONTH_JOINERS;
  }
  const suburbanJoiners = BASE_SUBURBAN_ESTIMATED_JOINERS * POPULATION_FACTOR;
  return suburbanJoiners / BASE_SUBURBAN_FIRST_MONTH_JOINERS;
}
function getPaymentFee(revenue, calcParams) {
  return Math.round(revenue * calcParams.paymentFeeRate);
}
function getMonthlyAdCost(month, calcParams) {
  const year = Math.ceil(month / 12);
  const monthInYear = (month - 1) % 12 + 1;
  if (year === 1) {
    if (monthInYear === 1) return calcParams.adCost.year1Month1;
    if (monthInYear === 2) return calcParams.adCost.year1Month2;
    if (monthInYear === 3 || monthInYear === 4) return calcParams.adCost.year1Month3To4;
    return calcParams.adCost.year1Month5To12;
  }
  if (year === 2) return calcParams.adCost.year2Monthly;
  return calcParams.adCost.year3PlusMonthly;
}
var DEFAULT_AD_COST_WEB = { year1Month1: 8e4, year1Month2: 8e4, monthly: 12e4 };
function getMonthlyAdCostWeb(month, adCostTotal, calcParams) {
  const cfg = calcParams.adCostWeb ?? DEFAULT_AD_COST_WEB;
  const raw = month === 1 ? cfg.year1Month1 : month === 2 ? cfg.year1Month2 : cfg.monthly;
  return Math.max(0, Math.min(raw, adCostTotal));
}
function resolveMonthlyRent(input) {
  if (!input) return DEFAULT_MONTHLY_RENT;
  const rentPerTsubo = Number(input.rentPerTsubo);
  if (Number.isFinite(rentPerTsubo) && rentPerTsubo > 0) {
    return Math.round(rentPerTsubo);
  }
  return DEFAULT_MONTHLY_RENT;
}
function resolveMonthlyRunning(input) {
  const running = Number(input?.runningCostTotal);
  if (Number.isFinite(running) && running >= 0) return Math.round(running);
  return DEFAULT_MONTHLY_RUNNING;
}
function resolveMachineMaintenance(input, calcParams, floorAreaTsubo, royaltyRate) {
  const manual = Number(input?.machineMaintenanceCost);
  if (Number.isFinite(manual) && manual >= 0) return Math.round(manual);
  return computeMachineMaintenanceMonthly({
    address: input?.prefecture ?? input?.location,
    floorAreaTsubo,
    royaltyRate,
    config: calcParams.machineMaintenance
  });
}
function resolveInitialInvestment(input) {
  const total = Number(input?.initialInvestmentTotal);
  if (Number.isFinite(total) && total > 0) return Math.round(total);
  return INITIAL_INVESTMENT;
}
function resolveFranchiseRate(input) {
  const rate = input?.franchiseRate ?? input?.royaltyRate ?? 0;
  if (rate === 10 || rate === 15) return rate;
  return 0;
}
function lookupMemberCoefficient(population) {
  const steps = Math.min(72, Math.floor(Math.max(0, population) / 5e3));
  return -(16 + steps) / 100;
}
function resolveInitialJoiners(input, calcParams) {
  const pop = input.populationByRadius;
  const locationType = input.locationType ?? "suburban";
  const competitorCount = Math.max(0, input.competitorCount ?? 0);
  if (!pop) {
    const locationMultiplier = getDemandMultiplier(locationType, competitorCount, calcParams);
    const floorArea = Number(input.floorAreaTsubo);
    const areaMultiplier = Number.isFinite(floorArea) && floorArea > 0 ? floorArea / BASE_FLOOR_AREA_TSUBO : 1;
    return Math.max(0.2, locationMultiplier * areaMultiplier) * BASE_SUBURBAN_FIRST_MONTH_JOINERS;
  }
  const { km1Ring, km3Ring, km5Ring } = pop;
  const e60 = km1Ring * 0.012;
  const f60 = km3Ring * 8e-3;
  const g60 = km5Ring * 1e-3;
  const lookupPop = locationType === "urban" ? km1Ring : locationType === "suburban" ? km1Ring + km3Ring : km1Ring + km3Ring + km5Ring;
  const e38 = lookupMemberCoefficient(lookupPop);
  let baseJoiners;
  if (locationType === "urban") {
    baseJoiners = e60 * (1 + e38);
  } else if (locationType === "suburban") {
    baseJoiners = e60 + f60 * (1 + e38);
  } else {
    baseJoiners = e60 + f60 + g60 * (1 + e38);
  }
  const competitorImpact2 = getCompetitorImpactRate(competitorCount, calcParams);
  return Math.max(0, baseJoiners * (1 - competitorImpact2));
}
function buildMonthlyDerivedContext(month, monthlyRevenue, members, monthlyRent, monthlyRunningCost, adCostMonthly) {
  return {
    month,
    members,
    monthlyRevenue,
    monthlyRent,
    monthlyRunningCost,
    adCostMonthly
  };
}
function resolveInitialJoinersWithFormula(input, calcParams, engine) {
  const fallback = resolveInitialJoiners(input, calcParams);
  if (!engine) return fallback;
  try {
    const preContext = buildInitialPhaseContext(input, calcParams);
    const pre = engine.evaluatePhase("pre", preContext, { initialJoiners: fallback, demandMultiplier: 1 });
    return Number.isFinite(pre.initialJoiners) ? pre.initialJoiners : fallback;
  } catch {
    return fallback;
  }
}
function buildRegressionRows(scenario, input, calcParams, formulaSet) {
  const resolvedInput = input ?? BASE_REGRESSION_INPUT;
  const averagePrice = computeAveragePrice(calcParams.pricing);
  const locationType = resolvedInput.locationType ?? "suburban";
  const floorArea = Number(resolvedInput.floorAreaTsubo) || BASE_FLOOR_AREA_TSUBO;
  const capacity = computeCapacity(floorArea, locationType, calcParams.capacity);
  let engine;
  if (formulaSet) {
    try {
      engine = new FormulaEvaluationEngine(formulaSet);
    } catch {
      engine = void 0;
    }
  }
  const initialJoiners = resolveInitialJoinersWithFormula(resolvedInput, calcParams, engine);
  const growth = simulateMemberGrowth({
    initialJoiners,
    maxMembers: capacity.maxMembers,
    months: PROJECTION_MONTHS,
    retention: calcParams.retention,
    acquisition: calcParams.acquisition,
    signage: calcParams.signage[scenario]
  });
  const royaltyRate = Math.max(0, resolveFranchiseRate(resolvedInput)) / 100;
  const monthlyRent = resolveMonthlyRent(resolvedInput);
  const machineMaintenance = resolveMachineMaintenance(resolvedInput, calcParams, floorArea, royaltyRate);
  const monthlyRunning = resolveMonthlyRunning(resolvedInput) + machineMaintenance;
  const fixedCost = monthlyRent + monthlyRunning;
  return growth.map((g) => {
    const members = Math.round(g.members);
    const revenue = Math.round(averagePrice * roundDown1(g.members));
    const adCost = getMonthlyAdCost(g.month, calcParams);
    const defaultPaymentFee = getPaymentFee(revenue, calcParams);
    const defaultRoyalty = Math.min(Math.round(revenue * royaltyRate), calcParams.royaltyCapMonthly);
    const defaultAppFee = defaultRoyalty > 0 ? calcParams.appFeeMonthly : 0;
    const defaultCost = fixedCost + adCost + defaultPaymentFee + defaultRoyalty + defaultAppFee;
    let cost = defaultCost;
    let resolvedPaymentFee = defaultPaymentFee;
    let resolvedRoyalty = defaultRoyalty;
    let resolvedAppFee = defaultAppFee;
    if (engine) {
      try {
        const context = buildFormulaContext({
          input: resolvedInput,
          calcParams,
          derived: buildMonthlyDerivedContext(g.month, revenue, members, monthlyRent, monthlyRunning, adCost),
          initialPhase: { initialJoiners, demandMultiplier: 1 }
        });
        const results = engine.evaluatePhase("monthly", context, {
          paymentFee: defaultPaymentFee,
          monthlyRoyalty: defaultRoyalty,
          appFee: defaultAppFee,
          monthlyCost: defaultCost
        });
        const paymentFee = Number.isFinite(results.paymentFee) ? results.paymentFee : defaultPaymentFee;
        const royalty = Number.isFinite(results.monthlyRoyalty) ? results.monthlyRoyalty : defaultRoyalty;
        const appFee = Number.isFinite(results.appFee) ? results.appFee : defaultAppFee;
        cost = Number.isFinite(results.monthlyCost) ? results.monthlyCost : fixedCost + adCost + paymentFee + royalty + appFee;
        resolvedPaymentFee = paymentFee;
        resolvedRoyalty = royalty;
        resolvedAppFee = appFee;
      } catch {
        cost = defaultCost;
      }
    }
    const adCostWeb = getMonthlyAdCostWeb(g.month, adCost, calcParams);
    return {
      month: g.month,
      members,
      revenue,
      cost,
      profit: revenue - cost,
      breakdown: {
        newMembers: g.newMembers,
        retainedMembers: g.retainedMembers,
        signageJoiners: g.signageJoiners,
        webJoiners: g.webJoiners,
        snsJoiners: g.snsJoiners,
        organicJoiners: g.organicJoiners,
        referralJoiners: g.referralJoiners,
        adCost,
        adCostWeb,
        adCostSns: adCost - adCostWeb,
        fixedCost,
        paymentFee: resolvedPaymentFee,
        royalty: resolvedRoyalty,
        appFee: resolvedAppFee
      }
    };
  });
}
function estimatePaybackMonths(rows, initialInvestment) {
  let cumulativeProfit = -initialInvestment;
  for (const row of rows) {
    cumulativeProfit += row.profit;
    if (cumulativeProfit >= 0) return row.month;
  }
  return 999;
}
function buildMonthlyProjection(rows, initialInvestment, cashLagMonths) {
  const lag = Math.max(0, Math.round(cashLagMonths));
  let cumulativeProfit = -initialInvestment;
  let cumulativeCash = -initialInvestment;
  return rows.map((row, index) => {
    cumulativeProfit += row.profit;
    const laggedRevenue = index - lag >= 0 ? rows[index - lag].revenue : 0;
    cumulativeCash += laggedRevenue - row.cost;
    return {
      month: row.month,
      members: row.members,
      revenue: row.revenue,
      cost: row.cost,
      profit: row.profit,
      cumulativeProfit,
      cumulativeCash
    };
  });
}
function buildAnnualProjection(rows, initialInvestment, taxRate) {
  const annual = [];
  let cumulativePretax = 0;
  let prevRevenue;
  for (let year = 1; year <= 10; year += 1) {
    const slice = rows.slice((year - 1) * 12, year * 12);
    if (slice.length === 0) break;
    const revenue = slice.reduce((sum, row) => sum + row.revenue, 0);
    const cost = slice.reduce((sum, row) => sum + row.cost, 0);
    const pretaxProfit = revenue - cost;
    cumulativePretax += pretaxProfit;
    const afterTaxProfit = pretaxProfit > 0 ? Math.round(pretaxProfit * (1 - taxRate)) : pretaxProfit;
    annual.push({
      year,
      yearEndMembers: slice[slice.length - 1].members,
      revenue,
      cost,
      pretaxProfit,
      afterTaxProfit,
      revenueGrowthRate: prevRevenue && prevRevenue > 0 ? revenue / prevRevenue : void 0,
      paybackRatio: initialInvestment > 0 ? cumulativePretax / initialInvestment : 0
    });
    prevRevenue = revenue;
  }
  return annual;
}
function buildBusinessPlan(args) {
  const {
    rows,
    monthlyRent,
    monthlyRunning,
    monthlyMachineMaintenance,
    runningCostBreakdown,
    monthlyDepreciation,
    depreciationIncludedInCost
  } = args;
  const fixedCostItems = [
    { id: "rent", label: "\u5BB6\u8CC3", monthlyAmount: monthlyRent }
  ];
  if (runningCostBreakdown?.length) {
    for (const item of runningCostBreakdown) {
      const amount = Number(item.monthlyAmount);
      fixedCostItems.push({
        id: String(item.id),
        label: String(item.label || item.id),
        monthlyAmount: Number.isFinite(amount) ? Math.round(amount) : 0
      });
    }
  } else {
    fixedCostItems.push({ id: "runningCostTotal", label: "\u30E9\u30F3\u30CB\u30F3\u30B0\u30B3\u30B9\u30C8", monthlyAmount: monthlyRunning });
  }
  fixedCostItems.push({
    id: "machineMaintenance",
    label: "\u30DE\u30B7\u30F3\u30E1\u30F3\u30C6\u30CA\u30F3\u30B9\u8CBB",
    monthlyAmount: monthlyMachineMaintenance
  });
  const fixedCostActual = monthlyRent + monthlyRunning + monthlyMachineMaintenance;
  const itemsTotal = fixedCostItems.reduce((sum, item) => sum + item.monthlyAmount, 0);
  const diff = fixedCostActual - itemsTotal;
  if (Math.abs(diff) >= 1) {
    fixedCostItems.push({ id: "runningCostAdjustment", label: "\u305D\u306E\u4ED6\uFF08\u8ABF\u6574\uFF09", monthlyAmount: diff });
  }
  return {
    fixedCostItems,
    monthlyDepreciation,
    depreciationIncludedInCost,
    months: rows.map((row) => {
      const b = row.breakdown;
      return {
        month: row.month,
        members: row.members,
        newMembers: b?.newMembers ?? 0,
        retainedMembers: b?.retainedMembers ?? 0,
        signageJoiners: b?.signageJoiners ?? 0,
        webJoiners: b?.webJoiners ?? 0,
        snsJoiners: b?.snsJoiners ?? 0,
        organicJoiners: b?.organicJoiners ?? 0,
        referralJoiners: b?.referralJoiners ?? 0,
        revenue: row.revenue,
        adCost: b?.adCost ?? 0,
        adCostWeb: b?.adCostWeb ?? 0,
        adCostSns: b?.adCostSns ?? 0,
        fixedCostTotal: b?.fixedCost ?? fixedCostActual,
        appFee: b?.appFee ?? 0,
        royalty: b?.royalty ?? 0,
        paymentFee: b?.paymentFee ?? 0,
        variableCostTotal: (b?.appFee ?? 0) + (b?.royalty ?? 0) + (b?.paymentFee ?? 0),
        totalCost: row.cost,
        pretaxProfit: row.profit
      };
    })
  };
}
function calculateSimulation(input, calcParams, options) {
  const scenario = input.scenario ?? "standard";
  const hasFormInvestmentTotal = Number.isFinite(Number(input.initialInvestmentTotal)) && Number(input.initialInvestmentTotal) > 0;
  const breakdownMachinesCost = Number(input.investmentBreakdown?.fitnessMachineCost);
  const machinesCost = Number.isFinite(breakdownMachinesCost) && breakdownMachinesCost >= 0 ? Math.round(breakdownMachinesCost) : resolveFitnessMachineCostByAddress(input.prefecture ?? input.location);
  const machineDelta = hasFormInvestmentTotal ? 0 : machinesCost - FITNESS_MACHINE_BASE_COST;
  const initialInvestment = Math.max(0, resolveInitialInvestment(input) + machineDelta);
  const monthlyRent = resolveMonthlyRent(input);
  const franchiseRate = resolveFranchiseRate(input);
  const royaltyRate = Math.max(0, franchiseRate) / 100;
  const includeDepreciation = input.includeDepreciation !== false;
  const averagePrice = computeAveragePrice(calcParams.pricing);
  const locationType = input.locationType ?? "suburban";
  const floorArea = Number(input.floorAreaTsubo) || BASE_FLOOR_AREA_TSUBO;
  const capacityResult = computeCapacity(floorArea, locationType, calcParams.capacity);
  const monthlyMachineMaintenance = resolveMachineMaintenance(input, calcParams, floorArea, royaltyRate);
  const monthlyRunningCost = resolveMonthlyRunning(input) + monthlyMachineMaintenance;
  const baseRows = buildRegressionRows(scenario, { ...input, franchiseRate }, calcParams, options?.formulaSet);
  const monthlyDepreciation = includeDepreciation ? Math.round(computeMonthlyDepreciation(input.investmentBreakdown, calcParams.depreciation, input.depreciationYearsByField)) : 0;
  const rows = baseRows.map((row) => ({
    ...row,
    cost: row.cost + monthlyDepreciation,
    profit: row.revenue - (row.cost + monthlyDepreciation)
  }));
  const monthlyProjection = buildMonthlyProjection(rows, initialInvestment, calcParams.cashCollectionLagMonths);
  const annualProjection = buildAnnualProjection(rows, initialInvestment, calcParams.corporateTaxRate);
  const year1Last = monthlyProjection[11];
  const monthlyRevenue = year1Last?.revenue ?? 0;
  const monthlyProfit = year1Last?.profit ?? 0;
  const projectedMembers = Math.max(0, year1Last?.members ?? 0);
  const monthlyRoyalty = Math.min(Math.round(monthlyRevenue * royaltyRate), calcParams.royaltyCapMonthly);
  const monthlyAppFee = monthlyRoyalty > 0 ? calcParams.appFeeMonthly : 0;
  const memberFee = calcParams.pricing.memberFeeExTax;
  const variableCostPerMember = computeVariableCostPerMember(
    averagePrice,
    royaltyRate,
    calcParams.paymentFeeRate,
    calcParams.pricing
  );
  const contributionMargin = averagePrice - variableCostPerMember;
  const fixedCostForBreakeven = monthlyRent + monthlyRunningCost;
  const breakevenMembers = contributionMargin > 0 ? Math.round(fixedCostForBreakeven / contributionMargin) : void 0;
  const simpleBreakevenMembers = memberFee > 0 ? Math.ceil(fixedCostForBreakeven / memberFee) : void 0;
  const adCostForBreakeven = getMonthlyAdCost(12, calcParams);
  const depreciationForBreakeven = Math.round(computeMonthlyDepreciation(input.investmentBreakdown, calcParams.depreciation, input.depreciationYearsByField));
  const breakevenVariants = contributionMargin > 0 ? {
    fixedOnly: Math.round(fixedCostForBreakeven / contributionMargin),
    withAdCost: Math.round((fixedCostForBreakeven + adCostForBreakeven) / contributionMargin),
    withDepreciation: Math.round((fixedCostForBreakeven + depreciationForBreakeven) / contributionMargin),
    withAdCostAndDepreciation: Math.round((fixedCostForBreakeven + adCostForBreakeven + depreciationForBreakeven) / contributionMargin)
  } : void 0;
  const businessPlan = buildBusinessPlan({
    rows,
    monthlyRent,
    monthlyRunning: resolveMonthlyRunning(input),
    monthlyMachineMaintenance,
    runningCostBreakdown: input.runningCostBreakdown,
    monthlyDepreciation: depreciationForBreakeven,
    depreciationIncludedInCost: includeDepreciation
  });
  const interiorCostInput = Number(input.investmentBreakdown?.interiorCost);
  const interiorCost = Number.isFinite(interiorCostInput) && interiorCostInput >= 0 ? Math.round(interiorCostInput) : INTERIOR_COST;
  return {
    id: `calc-${Date.now()}`,
    storeName: input.storeName.trim() || "\u8A66\u7B97\u7D50\u679C",
    location: input.location,
    locationType: input.locationType ?? "suburban",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    createdBy: input.createdBy?.trim() || "API",
    scenario,
    franchiseRate,
    totalInitialInvestment: initialInvestment,
    machinesCost,
    interiorCost,
    franchiseInitialCost: 0,
    otherInitialCost: Math.max(0, initialInvestment - (machinesCost + interiorCost)),
    investmentBreakdown: input.investmentBreakdown,
    monthlyRevenue,
    monthlyRent,
    monthlyRunningCost,
    monthlyMachineMaintenance,
    monthlyFranchiseCost: monthlyRoyalty + monthlyAppFee,
    monthlyProfit,
    paybackMonths: estimatePaybackMonths(rows, initialInvestment),
    breakevenMembers,
    simpleBreakevenMembers,
    breakevenVariants,
    formulaSetVersion: options?.formulaSet?.setVersion,
    averagePrice,
    variableCostPerMember: Math.round(variableCostPerMember),
    contributionMarginPerMember: Math.round(contributionMargin),
    // minimumUnitPrice,  // 最低単価は非表示方針のためコメントアウト（算出ロジックも上部で残置）
    capacity: {
      maxMembers: Math.round(capacityResult.maxMembers),
      concurrentUsers: Math.round(capacityResult.concurrentUsers),
      parkingSpaces: capacityResult.parkingSpaces
    },
    annualProjection,
    cashCollectionLagMonths: calcParams.cashCollectionLagMonths,
    monthlyProjection,
    businessPlan,
    ltv: calculateLtv({
      monthlyFee: calcParams.pricing.memberFeeExTax,
      firstMonthRetention: calcParams.retention.firstMonth,
      subsequentRetention: calcParams.retention.subsequent
    })
  };
}

// lib/default-calc-params.ts
var DEFAULT_CALC_PARAMS = {
  paymentFeeRate: 0.035,
  royaltyCapMonthly: 3e5,
  appFeeMonthly: 1e4,
  competitorImpact: {
    upTo2: 0.1,
    for3: 0.15,
    for4: 0.2,
    over4: 0.25
  },
  adCost: {
    // 事業計画 R42（Web広告費+SNS広告費の月次スケジュール）
    year1Month1: 52e4,
    year1Month2: 28e4,
    year1Month3To4: 24e4,
    year1Month5To12: 18e4,
    year2Monthly: 18e4,
    year3PlusMonthly: 12e4
  },
  adCostWeb: {
    // 事業計画 R43（Web広告費）。SNS広告費（R44）は adCost との差分で算出する
    year1Month1: 8e4,
    year1Month2: 8e4,
    monthly: 12e4
  },
  // ── Excel計算モデル移植で追加 ──
  pricing: {
    memberFeeExTax: 2980,
    // 入力欄!C72
    // 入力欄!C85:E90（オプション料金表）
    options: [
      { label: "\u30A6\u30A9\u30FC\u30BF\u30FC\u30B5\u30FC\u30D0\u30FC", price: 500, ratio: 0.35 },
      { label: "\u5951\u7D04\u30ED\u30C3\u30AB\u30FC", price: 1e3, ratio: 0.05 },
      { label: "\u4F53\u7D44\u6210\u8A08", price: 500, ratio: 0.28 },
      { label: "\u30B5\u30D7\u30EA", price: 2500, ratio: 0 },
      { label: "\u30B4\u30EB\u30D5", price: 7e3, ratio: 0 },
      { label: "\u306A\u3057", price: 0, ratio: 0.32 }
    ]
  },
  retention: {
    firstMonth: 1,
    // 入力欄!C68
    subsequent: 0.94
    // 入力欄!C69
  },
  acquisition: {
    organicSearchRate: 0.04,
    // 入力欄!C71
    referralRate: 0.03,
    // 入力欄!C70
    channelSplit: { signage: 0.7, web: 0.25, sns: 0.05 },
    // 入力欄!D41/D42/D43
    semCpaY1Y2: 4e3,
    // 入力欄!C64
    semCpaY3Plus: 6e3,
    // 入力欄!C65
    snsAdUnitCost: 1e4,
    // 入力欄!C66
    webBudgetMonthly: 12e4,
    // 入力欄!C76
    snsBudgetMonthly: 6e4,
    // 入力欄!C77
    snsInitialBonus: 40
    // 事業計画!D38(+40)
  },
  signage: {
    // 事業計画 R35（D35基準値と逓減）。base=初月見込×channelSplit.signage×baseFactor
    // adEffectiveness は年2以降のWeb/SNS獲得に掛かる係数（事業計画 D89/D299 等）。
    aggressive: { baseFactor: 1, roundDownBase: false, month2Factor: 0.5, month3Factor: 0.2, month4Factor: 0.1, monthlyDecay: 0.92, adEffectivenessYear2to5: 1, adEffectivenessYear6Plus: 1 },
    standard: { baseFactor: 0.7, roundDownBase: false, month2Factor: 0.25, month3Factor: 0.2, month4Factor: 0.1, monthlyDecay: 0.92, adEffectivenessYear2to5: 0.8, adEffectivenessYear6Plus: 0.7 },
    conservative: { baseFactor: 0.3, roundDownBase: true, month2Factor: 0.25, month3Factor: 0.2, month4Factor: 0.1, monthlyDecay: 0.92, adEffectivenessYear2to5: 0.6, adEffectivenessYear6Plus: 0.5 }
  },
  capacity: {
    visitsPerWeek: 2,
    // D9
    avgStayHours: 1,
    // D10
    areaPerMemberTsubo: 3.5,
    // D12
    businessHours: 24,
    // D14
    avgUtilization: 0.604166666666667,
    // D17(=H34)
    ruralFactor: 0.6,
    // D18 田舎型
    parkingUtilization: 0.8
    // D22
  },
  depreciation: {
    // 入力欄 D5:D10（耐用年数）。掲載外の投資項目は非償却。
    usefulLifeYears: {
      interiorCost: 10,
      fitnessMachineCost: 6,
      flapperGateCost: 6,
      bodyCompositionCost: 6
    }
  },
  machineMaintenance: {
    // 入力欄 B34: C34=IF(C73=0,0,K23*N19*P19) / 「2〜3ヶ月に1回実施」を月割り
    applyOnlyWhenFranchise: true,
    // C73(ロイヤリティ)=0 の直営は計上しない
    intervalMonths: 3,
    // 「2〜3ヶ月に1回」の中間値。月額=1回費用÷3
    // ── 距離連動の単価モデル（入力欄 K25:Q72。Q=P/2, P=$L$47+O, O=N×20000, N=ROUNDDOWN(L,-2)/100）──
    baseUnitPrice: 11e4,
    // 入力欄 $L$47（距離0=拠点 愛知 の基本料）
    distanceStepKm: 100,
    // 入力欄 M=ROUNDDOWN(L,-2) の -2（100km単位に切り捨て）
    distanceStepCost: 2e4,
    // 入力欄 O=N×20000（100kmごとの距離加算）
    unitPriceDivisor: 2,
    // 入力欄 Q=P/2
    fallbackUnitPrice: 65e3,
    // 都道府県不明時（入力欄 Q列の標準値帯）
    // 坪数帯→作業人数・日数（入力欄 N19/P19 の IF カスケード）
    tsuboTiers: [
      { minTsubo: 0, workers: 2, days: 1 },
      { minTsubo: 110, workers: 2, days: 1 },
      { minTsubo: 160, workers: 3, days: 1 },
      { minTsubo: 200, workers: 2, days: 2 }
    ],
    // 拠点(愛知)からの距離km（入力欄 L列）。愛知は基準額アンカーのため距離0扱い。
    distanceByPrefecture: {
      \u5317\u6D77\u9053: 955.4,
      \u9752\u68EE: 711,
      \u5CA9\u624B: 626.9,
      \u5BAE\u57CE: 492.8,
      \u79CB\u7530: 577.5,
      \u5C71\u5F62: 459,
      \u798F\u5CF6: 427.9,
      \u8328\u57CE: 345.1,
      \u6803\u6728: 309.7,
      \u7FA4\u99AC: 236.6,
      \u57FC\u7389: 259.8,
      \u5343\u8449: 296,
      \u6771\u4EAC: 259.1,
      \u795E\u5948\u5DDD: 250.5,
      \u65B0\u6F5F: 356.6,
      \u5BCC\u5C71: 170.3,
      \u77F3\u5DDD: 159,
      \u798F\u4E95: 116.1,
      \u5C71\u68A8: 160.2,
      \u9577\u91CE: 199.7,
      \u5C90\u961C: 28.8,
      \u9759\u5CA1: 136.5,
      \u611B\u77E5: 0,
      \u4E09\u91CD: 61.8,
      \u6ECB\u8CC0: 96.7,
      \u4EAC\u90FD: 106.4,
      \u5927\u962A: 138,
      \u5175\u5EAB: 166.5,
      \u5948\u826F: 112.4,
      \u548C\u6B4C\u5C71: 191.3,
      \u9CE5\u53D6: 245.2,
      \u5CF6\u6839: 352.1,
      \u5CA1\u5C71: 277.6,
      \u5E83\u5CF6: 416.2,
      \u5C71\u53E3: 510.1,
      \u5FB3\u5CF6: 248.2,
      \u9999\u5DDD: 278.2,
      \u611B\u5A9B: 408.1,
      \u9AD8\u77E5: 358.7,
      \u798F\u5CA1: 621.5,
      \u4F50\u8CC0: 645.3,
      \u9577\u5D0E: 704,
      \u718A\u672C: 628.2,
      \u5927\u5206: 533.2,
      \u5BAE\u5D0E: 624.9,
      \u9E7F\u5150\u5CF6: 714.1,
      \u6C96\u7E04: 1328.9
    },
    // Q列が式ではなく手入力固定値で上書きされている県のみ（距離計算値ではなくこの値を採用）。
    // ここに無い県は distanceByPrefecture から距離連動で算出する。
    unitPriceByPrefecture: {
      \u5317\u6D77\u9053: 7e4,
      \u8328\u57CE: 75e3,
      \u6803\u6728: 75e3,
      \u7FA4\u99AC: 65e3,
      \u57FC\u7389: 65e3,
      \u5343\u8449: 65e3,
      \u6771\u4EAC: 65e3,
      \u795E\u5948\u5DDD: 65e3,
      \u6ECB\u8CC0: 6e4,
      \u4EAC\u90FD: 7e4,
      \u5927\u962A: 7e4,
      \u5175\u5EAB: 7e4,
      \u5948\u826F: 7e4,
      \u548C\u6B4C\u5C71: 7e4,
      \u798F\u5CA1: 65e3,
      \u4F50\u8CC0: 7e4,
      \u9577\u5D0E: 7e4,
      \u718A\u672C: 8e4,
      \u5927\u5206: 7e4,
      \u5BAE\u5D0E: 9e4,
      \u9E7F\u5150\u5CF6: 9e4,
      \u6C96\u7E04: 9e4
    }
  },
  corporateTaxRate: 0.232,
  // 入力欄!C92
  cashCollectionLagMonths: 1
  // 入力欄!C79
};

// lib/formula-default-set.ts
var v = (varKey) => ({ type: "var", varKey });
var c = (value) => ({ type: "const", value });
var o = (op) => ({ type: "op", op });
var LP = { type: "paren", paren: "(" };
var RP = { type: "paren", paren: ")" };
var COMMA = { type: "op", op: "," };
var group = (...t) => [LP, ...t, RP];
var call = (fnName, ...args) => {
  const inner = [];
  args.forEach((a, i) => {
    if (i > 0) inner.push(COMMA);
    inner.push(...a);
  });
  return [{ type: "fn", fnName }, LP, ...inner, RP];
};
var paymentFeeTokens = call("round", [v("monthlyRevenue"), o("*"), v("paymentFeeRate")]);
var monthlyRoyaltyTokens = call(
  "min",
  call("round", [v("monthlyRevenue"), o("*"), v("franchiseRate"), o("/"), c(100)]),
  [v("royaltyCapMonthly")]
);
var appFeeTokens = call(
  "if",
  [v("monthlyRoyalty"), o(">"), c(0)],
  [v("appFeeMonthly")],
  [c(0)]
);
var adCostMonthlyTokens = call(
  "if",
  [v("month"), o("<="), c(1)],
  [v("adCostYear1Month1")],
  call(
    "if",
    [v("month"), o("<="), c(2)],
    [v("adCostYear1Month2")],
    call(
      "if",
      [v("month"), o("<="), c(4)],
      [v("adCostYear1Month3To4")],
      call(
        "if",
        [v("month"), o("<="), c(12)],
        [v("adCostYear1Month5To12")],
        call(
          "if",
          [v("month"), o("<="), c(24)],
          [v("adCostYear2Monthly")],
          [v("adCostYear3PlusMonthly")]
        )
      )
    )
  )
);
var monthlyCostTokens = [
  v("monthlyRent"),
  o("+"),
  v("monthlyRunningCost"),
  o("+"),
  v("adCostMonthly"),
  o("+"),
  v("paymentFee"),
  o("+"),
  v("monthlyRoyalty"),
  o("+"),
  v("appFee")
];
var onePlusE38 = (lookupPop) => group(
  c(1),
  o("+"),
  ...group(
    ...group(
      c(0),
      o("-"),
      ...group(
        c(16),
        o("+"),
        ...call("min", [c(72)], call("floor", group(...lookupPop, o("/"), c(5e3))))
      )
    ),
    o("/"),
    c(100)
  )
);
var km1 = v("populationKm1Ring");
var km3 = v("populationKm3Ring");
var km5 = v("populationKm5Ring");
var urbanBranch = [
  km1,
  o("*"),
  c(0.012),
  o("*"),
  ...onePlusE38([km1])
];
var suburbanBranch = [
  km1,
  o("*"),
  c(0.012),
  o("+"),
  km3,
  o("*"),
  c(8e-3),
  o("*"),
  ...onePlusE38([km1, o("+"), km3])
];
var ruralBranch = [
  km1,
  o("*"),
  c(0.012),
  o("+"),
  km3,
  o("*"),
  c(8e-3),
  o("+"),
  km5,
  o("*"),
  c(1e-3),
  o("*"),
  ...onePlusE38([km1, o("+"), km3, o("+"), km5])
];
var competitorImpact = call(
  "if",
  [v("competitorCount"), o("<="), c(0)],
  [c(0)],
  call(
    "if",
    [v("competitorCount"), o("<="), c(2)],
    [v("competitorImpactUpTo2")],
    call(
      "if",
      [v("competitorCount"), o("=="), c(3)],
      [v("competitorImpactFor3")],
      call(
        "if",
        [v("competitorCount"), o("=="), c(4)],
        [v("competitorImpactFor4")],
        [v("competitorImpactOver4")]
      )
    )
  )
);
var locationBranch = call(
  "if",
  [v("locationType"), o("=="), c(1)],
  urbanBranch,
  call("if", [v("locationType"), o("=="), c(2)], ruralBranch, suburbanBranch)
);
var initialJoinersTokens = call(
  "max",
  [c(0)],
  [...group(...locationBranch), o("*"), ...group(c(1), o("-"), ...competitorImpact)]
);
var DEFAULT_FORMULA_DEFINITIONS = {
  initialJoiners: {
    key: "initialJoiners",
    label: "\u521D\u6708\u5165\u4F1A\u4EBA\u6570",
    tokens: initialJoinersTokens,
    outputType: "number",
    // 未丸めで会員成長モデルへ渡すため丸めない
    roundResult: false,
    description: "\u5165\u529B\u6B04 G38 \u306E\u79FB\u690D\uFF08\u7ACB\u5730\u5206\u5C90 \xD7 \u7AF6\u5408\u5F71\u97FF\u3001\u4EBA\u53E3\u4FC2\u6570\u306F\u7DDA\u5F62\u8FD1\u4F3C\uFF09"
  },
  paymentFee: {
    key: "paymentFee",
    label: "\u6C7A\u6E08\u624B\u6570\u6599",
    tokens: paymentFeeTokens,
    outputType: "currency",
    description: "\u58F2\u4E0A \xD7 \u6C7A\u6E08\u624B\u6570\u6599\u7387"
  },
  monthlyRoyalty: {
    key: "monthlyRoyalty",
    label: "\u6708\u6B21\u30ED\u30A4\u30E4\u30EA\u30C6\u30A3",
    tokens: monthlyRoyaltyTokens,
    outputType: "currency",
    description: "min(\u58F2\u4E0A \xD7 FC\u7387, \u4E0A\u9650)"
  },
  appFee: {
    key: "appFee",
    label: "\u30A2\u30D7\u30EA\u5229\u7528\u6599",
    tokens: appFeeTokens,
    outputType: "currency",
    description: "\u30ED\u30A4\u30E4\u30EA\u30C6\u30A3\u767A\u751F\u6642\u306E\u307F\u5B9A\u984D"
  },
  adCostMonthly: {
    key: "adCostMonthly",
    label: "\u6708\u6B21\u5E83\u544A\u8CBB",
    tokens: adCostMonthlyTokens,
    outputType: "currency",
    description: "\u4E8B\u696D\u8A08\u753B R42 \u306E\u6708\u6B21\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB"
  },
  monthlyCost: {
    key: "monthlyCost",
    label: "\u6708\u6B21\u7DCF\u30B3\u30B9\u30C8",
    tokens: monthlyCostTokens,
    outputType: "currency",
    description: "\u5BB6\u8CC3+\u30E9\u30F3\u30CB\u30F3\u30B0+\u5E83\u544A+\u6C7A\u6E08+\u30ED\u30A4\u30E4\u30EA\u30C6\u30A3+\u30A2\u30D7\u30EA\u6599"
  }
};
var DEFAULT_FORMULA_SET = {
  setVersion: "default",
  formulas: DEFAULT_FORMULA_DEFINITIONS
};

// scripts/verify-formula-set.ts
var BASE_INPUT = {
  storeName: "verify-base",
  locationType: "suburban",
  floorAreaTsubo: 50,
  rentPerTsubo: 9e5,
  runningCostTotal: 308e3,
  machineMaintenanceCost: 0,
  initialInvestmentTotal: 2311e4,
  competitorCount: 2,
  royaltyRate: 0,
  franchiseRate: 0,
  populationByRadius: { km1Ring: 11416, km3Ring: 39505, km5Ring: 64764 }
};
var VARIANTS = [
  { name: "FC\u76F4\u55B6(0%)", input: { ...BASE_INPUT } },
  { name: "FC10%", input: { ...BASE_INPUT, royaltyRate: 10, franchiseRate: 10 } },
  { name: "FC15%", input: { ...BASE_INPUT, royaltyRate: 15, franchiseRate: 15 } },
  { name: "\u90FD\u5E02\u578B", input: { ...BASE_INPUT, locationType: "urban" } },
  { name: "\u7530\u820E\u578B/\u7AF6\u54084", input: { ...BASE_INPUT, locationType: "rural", competitorCount: 4 } }
];
var SCENARIOS = ["conservative", "standard", "aggressive"];
var failures = 0;
var checks = 0;
for (const variant of VARIANTS) {
  for (const scenario of SCENARIOS) {
    const input = { ...variant.input, scenario };
    const withSet = calculateSimulation(input, DEFAULT_CALC_PARAMS, { formulaSet: DEFAULT_FORMULA_SET });
    const withoutSet = calculateSimulation(input, DEFAULT_CALC_PARAMS);
    const a = withSet.monthlyProjection;
    const b = withoutSet.monthlyProjection;
    if (a.length !== b.length) {
      console.error(`\u2717 ${variant.name}/${scenario}: \u6708\u6570\u4E0D\u4E00\u81F4 ${a.length} vs ${b.length}`);
      failures++;
      continue;
    }
    let variantFail = 0;
    for (let i = 0; i < a.length; i++) {
      checks++;
      for (const key of ["members", "revenue", "cost", "profit"]) {
        const av = Number(a[i][key]);
        const bv = Number(b[i][key]);
        if (Math.abs(av - bv) > 0.5) {
          if (variantFail < 3) {
            console.error(`\u2717 ${variant.name}/${scenario} m${i + 1} ${key}: set=${av} fallback=${bv}`);
          }
          variantFail++;
          failures++;
        }
      }
    }
    if (variantFail === 0) {
      console.log(`\u2713 ${variant.name}/${scenario}: 120\u30F6\u6708 members/revenue/cost/profit \u5B8C\u5168\u4E00\u81F4`);
    } else {
      console.error(`\u2717 ${variant.name}/${scenario}: ${variantFail}\u4EF6\u4E0D\u4E00\u81F4`);
    }
  }
}
console.log(`
\u691C\u8A3C\u4EF6\u6570: ${checks} \u30BB\u30EB / \u4E0D\u4E00\u81F4: ${failures}`);
if (failures > 0) {
  console.error("\u274C \u7B49\u4FA1\u691C\u8A3C \u5931\u6557 \u2014 \u5F0F\u5B9A\u7FA9\u304CExcel/\u30B3\u30FC\u30C9\u3068\u4E0D\u4E00\u81F4\u3067\u3059");
  process.exit(1);
} else {
  console.log("\u2705 \u7B49\u4FA1\u691C\u8A3C \u5408\u683C \u2014 6\u5F0F\u3059\u3079\u3066\u30B3\u30FC\u30C9(=Excel)\u3068\u5B8C\u5168\u4E00\u81F4");
}
