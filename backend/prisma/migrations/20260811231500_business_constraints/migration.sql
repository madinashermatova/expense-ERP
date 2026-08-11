-- TZ 3.16.3: companyId faqat PLATFORM_OWNER uchun NULL bo'lishi mumkin
ALTER TABLE "users"
  ADD CONSTRAINT "users_company_role_check"
  CHECK (("role" = 'PLATFORM_OWNER' AND "companyId" IS NULL)
      OR ("role" <> 'PLATFORM_OWNER' AND "companyId" IS NOT NULL));

-- TZ 5.3 invariant: Expense.refundedAmount <= Expense.amount
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_refunded_amount_check"
  CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "amount");

-- TZ 3.6: summa musbat bo'lishi shart
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_positive_check"
  CHECK ("amount" > 0 AND "amountUzs" > 0);

ALTER TABLE "expense_shares"
  ADD CONSTRAINT "expense_shares_amount_positive_check"
  CHECK ("amount" > 0);

ALTER TABLE "refunds"
  ADD CONSTRAINT "refunds_amount_positive_check"
  CHECK ("amount" > 0);

-- TZ 3.2: filial kodi 2–5 ta lotin harfi
ALTER TABLE "branches"
  ADD CONSTRAINT "branches_code_format_check"
  CHECK ("code" ~ '^[A-Z]{2,5}$');

-- TZ 3.13: hisobot davri boshlanish kuni 1–28
ALTER TABLE "companies"
  ADD CONSTRAINT "companies_report_period_day_check"
  CHECK ("reportPeriodStartDay" BETWEEN 1 AND 28);

-- TZ 3.10: byudjet ogohlantirish chegarasi 80 yoki 100
ALTER TABLE "budget_alerts"
  ADD CONSTRAINT "budget_alerts_threshold_check"
  CHECK ("threshold" IN (80, 100));

-- TZ 3.14: audit jurnali append-only — UPDATE va DELETE bloklanadi
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
