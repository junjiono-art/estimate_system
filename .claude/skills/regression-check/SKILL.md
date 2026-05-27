---
name: regression-check
description: Verify formula engine correctness by comparing simulation outputs against expected CSV baselines in data/regression/. Use after any changes to lib/formula-*.ts or calculation logic.
disable-model-invocation: true
---

Check calculation regressions after formula engine changes:

1. Read `data/regression/input-base.csv` to understand the input format.
2. Read `data/regression/scenario-overrides.csv` for per-scenario overrides.
3. Read all `data/regression/expected-*.csv` files — these are the expected outputs for Conservative, Standard, and Aggressive scenarios.
4. Review recent changes to `lib/formula-*.ts` or relevant calculation files.
5. Trace through the changed logic against the CSV inputs to check if outputs would still match the expected values.
6. Report: which scenarios are affected, whether expected values still hold, and flag any discrepancy.

Note: there is no automated test runner for these CSVs — this is a manual trace/review step.
