import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { getRequiredScope } from "./authService.js";

const ALLOWED_TYPES = new Set([
  "estagio-profissional",
  "estagio-curricular",
  "recomendacao",
  "emprego",
]);

const ALLOWED_STATUS = new Set(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized.toLowerCase() : null;
}

function normalizePetitionType(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ALLOWED_TYPES.has(normalized) ? normalized : "estagio-profissional";
}

function normalizeStatus(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  return ALLOWED_STATUS.has(normalized) ? normalized : "PENDING";
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

async function getScopedFields() {
  const { session, profile } = await getRequiredScope();
  return {
    area_id: profile.areaId,
    requester_id: session?.user?.id ?? null,
    created_by: session?.user?.id ?? null,
  };
}

export function canUsePetitionApi() {
  return isSupabaseConfigured && Boolean(supabase);
}

export async function createStudentPetition(petition) {
  if (!canUsePetitionApi()) {
    throw new Error("Supabase não está configurado");
  }

  const scope = await getScopedFields();
  const payload = {
    ...scope,
    petition_type: normalizePetitionType(petition.type),
    full_name: normalizeText(petition.fullName),
    email: normalizeEmail(petition.email),
    course: normalizeText(petition.course),
    target_area: normalizeText(petition.targetArea),
    start_date: normalizeDate(petition.startDate),
    end_date: normalizeDate(petition.endDate),
    purpose: normalizeText(petition.purpose),
    status: normalizeStatus(petition.status ?? "PENDING"),
    updated_at: new Date().toISOString(),
  };

  if (!payload.requester_id) {
    throw new Error("Requester ID is required");
  }

  if (!payload.email) {
    throw new Error("Email inválido");
  }

  const { data, error } = await supabase
    .from("student_petitions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}
