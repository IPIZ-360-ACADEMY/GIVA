import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { getRequiredScope } from "./authService.js";

const PARTNERS_TABLE = "partners";

function normalizePayload(input) {
  return {
    empresa: String(input?.empresa ?? "").trim(),
    nif: String(input?.nif ?? "").trim(),
    setor: String(input?.setor ?? "tech").trim() || "tech",
    areas: Array.isArray(input?.areas) ? input.areas.filter((item) => typeof item === "string") : [],
    vagas: Number(input?.vagas ?? 0) || 0,
    sla: String(input?.sla ?? "").trim(),
    responsavel: String(input?.responsavel ?? "").trim(),
    telefone: String(input?.telefone ?? "").trim(),
    email: String(input?.email ?? "").trim(),
    website: String(input?.website ?? "").trim(),
    endereco: String(input?.endereco ?? "").trim(),
    photo_preview: typeof input?.photoPreview === "string" ? input.photoPreview : null,
  };
}

function normalizeRow(row) {
  return {
    id: row.id,
    empresa: row.empresa,
    nif: row.nif,
    setor: row.setor,
    areas: Array.isArray(row.areas) ? row.areas : [],
    vagas: String(row.vagas ?? ""),
    sla: typeof row.sla === "string" ? row.sla : String(row.sla ?? ""),
    responsavel: row.responsavel ?? "",
    telefone: row.telefone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    endereco: row.endereco ?? "",
    photoPreview: row.photo_preview ?? null,
    areaId: row.area_id ?? null,
  };
}

async function getScopedFields() {
  const { session, profile } = await getRequiredScope();

  return {
    area_id: profile.areaId,
    created_by: session?.user?.id ?? null,
  };
}

export function canUsePartnersApi() {
  return isSupabaseConfigured && Boolean(supabase);
}

/**
 * Obter o parceiro associado ao utilizador autenticado (ADMIN_1)
 */
export async function getMyPartner() {
  if (!canUsePartnersApi()) return null;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  const userEmail = String(userData?.user?.email ?? "").trim().toLowerCase();
  if (!userId) return null;

  const { data, error } = await supabase
    .from(PARTNERS_TABLE)
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[partnersService] getMyPartner error:", error);
    return null;
  }

  if (Array.isArray(data) && data[0]) {
    return normalizeRow(data[0]);
  }

  if (!userEmail) {
    return null;
  }

  const { data: byEmail, error: emailError } = await supabase
    .from(PARTNERS_TABLE)
    .select("*")
    .ilike("email", userEmail)
    .order("created_at", { ascending: false })
    .limit(1);

  if (emailError) {
    console.error("[partnersService] getMyPartner by email error:", emailError);
    return null;
  }

  return Array.isArray(byEmail) && byEmail[0] ? normalizeRow(byEmail[0]) : null;
}

export async function listPartners() {
  if (!canUsePartnersApi()) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from(PARTNERS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(normalizeRow);
}

export async function createPartner(partner) {
  if (!canUsePartnersApi()) {
    throw new Error("Supabase is not configured");
  }

  const scope = await getScopedFields();
  const payload = { ...normalizePayload(partner), ...scope };
  const { data, error } = await supabase.from(PARTNERS_TABLE).insert(payload).select("*").single();

  if (error) {
    throw error;
  }

  return normalizeRow(data);
}

export async function updatePartner(id, partner) {
  if (!canUsePartnersApi()) {
    throw new Error("Supabase is not configured");
  }

  const scope = await getScopedFields();
  const payload = { ...normalizePayload(partner), area_id: scope.area_id };
  const { data, error } = await supabase
    .from(PARTNERS_TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return normalizeRow(data);
}

export async function deletePartner(id) {
  if (!canUsePartnersApi()) {
    throw new Error("Supabase is not configured");
  }

  const { error } = await supabase.from(PARTNERS_TABLE).delete().eq("id", id);

  if (error) {
    throw error;
  }
}
