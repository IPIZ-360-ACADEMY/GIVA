import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import { getRequiredScope } from "./authService.js";

const STUDENT_NOTES_TABLE = "student_notes";

export function canUseStudentNotesApi() {
  return isSupabaseConfigured && Boolean(supabase);
}

export async function createStudentNote(input) {
  if (!canUseStudentNotesApi()) {
    throw new Error("Supabase is not configured");
  }

  const { session, profile } = await getRequiredScope();
  const payload = {
    note: String(input?.note ?? "").trim(),
    student_name: String(input?.studentName ?? "Aluno").trim() || "Aluno",
    area_id: profile.areaId,
    created_by: session?.user?.id ?? null,
  };

  const { data, error } = await supabase.from(STUDENT_NOTES_TABLE).insert(payload).select("id").single();

  if (error) {
    throw error;
  }

  return data;
}
