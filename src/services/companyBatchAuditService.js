import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const AUDIT_TABLE = "company_batch_operations_audit";

function normalizeAuditRow(row) {
  return {
    id: row.id,
    batchId: row.batch_id,
    processedAt: row.processed_at,
    processedBy: row.processed_by_name || "Utilizador",
    processedById: row.processed_by,
    action: row.action,
    studentName: row.student_name || "Sem nome",
    vacancyTitle: row.vacancy_title || "Sem vaga",
    result: row.result,
    reason: row.reason || "",
    applicationId: row.application_id,
    vacancyId: row.vacancy_id,
    partnerId: row.partner_id,
    metadata: row.metadata || {},
  };
}

export function canUseCompanyBatchAuditApi() {
  return isSupabaseConfigured && Boolean(supabase);
}

export async function listCompanyBatchAuditRows(partnerId, options = {}) {
  if (!canUseCompanyBatchAuditApi() || !partnerId) return [];

  const limit = Math.max(1, Math.min(500, Number(options.limit ?? 100) || 100));

  const { data, error } = await supabase
    .from(AUDIT_TABLE)
    .select("*")
    .eq("partner_id", partnerId)
    .order("processed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[companyBatchAuditService] listCompanyBatchAuditRows error:", error);
    return [];
  }

  return (data ?? []).map(normalizeAuditRow);
}

export async function insertCompanyBatchAuditRows(rows) {
  if (!canUseCompanyBatchAuditApi()) return false;

  const payload = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!payload.length) return true;

  const { error } = await supabase.from(AUDIT_TABLE).insert(payload);

  if (error) {
    console.error("[companyBatchAuditService] insertCompanyBatchAuditRows error:", error);
    return false;
  }

  return true;
}
