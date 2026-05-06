import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canUse() {
  return typeof supabase !== "undefined" && supabase !== null;
}

const RATING_LABELS = {
  1: "Mau",
  2: "Fraco",
  3: "Suficiente",
  4: "Bom",
  5: "Excelente",
};

export function getRatingLabel(rating) {
  return RATING_LABELS[rating] ?? "—";
}

// ---------------------------------------------------------------------------
// DIÁRIO DE ACOMPANHAMENTO (intern_followup_logs)
// ---------------------------------------------------------------------------

export async function listFollowupLogs(companyProgressId) {
  if (!canUse() || !companyProgressId) return [];
  const { data, error } = await supabase
    .from("intern_followup_logs")
    .select("*")
    .eq("company_progress_id", companyProgressId)
    .order("period_start", { ascending: false });
  if (error) {
    console.error("[internFollowupService] listFollowupLogs:", error);
    return [];
  }
  return data ?? [];
}

export async function createFollowupLog(payload) {
  if (!canUse()) return null;
  const { data, error } = await supabase
    .from("intern_followup_logs")
    .insert([payload])
    .select()
    .single();
  if (error) {
    console.error("[internFollowupService] createFollowupLog:", error);
    return null;
  }
  return data;
}

export async function updateFollowupLog(id, patch) {
  if (!canUse() || !id) return null;
  const { data, error } = await supabase
    .from("intern_followup_logs")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[internFollowupService] updateFollowupLog:", error);
    return null;
  }
  return data;
}

export async function deleteFollowupLog(id) {
  if (!canUse() || !id) return false;
  const { error } = await supabase
    .from("intern_followup_logs")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[internFollowupService] deleteFollowupLog:", error);
    return false;
  }
  return true;
}

// Estatísticas agregadas de presenças
export function calcAttendanceStats(logs) {
  const present = logs.reduce((s, l) => s + Number(l.attendance_present ?? 0), 0);
  const absent = logs.reduce((s, l) => s + Number(l.attendance_absent ?? 0), 0);
  const justified = logs.reduce((s, l) => s + Number(l.attendance_justified ?? 0), 0);
  const total = present + absent + justified;
  const pct = total > 0 ? Math.round((present / total) * 100) : null;
  return { present, absent, justified, total, pct };
}

// Média de desempenho semanal
export function calcAvgPerformance(logs) {
  const rated = logs.filter((l) => l.performance_rating != null);
  if (!rated.length) return null;
  const sum = rated.reduce((s, l) => s + Number(l.performance_rating), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

// ---------------------------------------------------------------------------
// OBJECTIVOS (intern_objectives)
// ---------------------------------------------------------------------------

export async function listObjectives(companyProgressId) {
  if (!canUse() || !companyProgressId) return [];
  const { data, error } = await supabase
    .from("intern_objectives")
    .select("*")
    .eq("company_progress_id", companyProgressId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[internFollowupService] listObjectives:", error);
    return [];
  }
  return data ?? [];
}

export async function createObjective(payload) {
  if (!canUse()) return null;
  const { data, error } = await supabase
    .from("intern_objectives")
    .insert([payload])
    .select()
    .single();
  if (error) {
    console.error("[internFollowupService] createObjective:", error);
    return null;
  }
  return data;
}

export async function updateObjective(id, patch) {
  if (!canUse() || !id) return null;
  const { data, error } = await supabase
    .from("intern_objectives")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[internFollowupService] updateObjective:", error);
    return null;
  }
  return data;
}

export async function deleteObjective(id) {
  if (!canUse() || !id) return false;
  const { error } = await supabase
    .from("intern_objectives")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[internFollowupService] deleteObjective:", error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// AVALIAÇÕES (intern_evaluations)
// ---------------------------------------------------------------------------

export async function listEvaluations(companyProgressId) {
  if (!canUse() || !companyProgressId) return [];
  const { data, error } = await supabase
    .from("intern_evaluations")
    .select("*")
    .eq("company_progress_id", companyProgressId)
    .order("eval_date", { ascending: false });
  if (error) {
    console.error("[internFollowupService] listEvaluations:", error);
    return [];
  }
  return data ?? [];
}

export async function upsertEvaluation(payload) {
  if (!canUse()) return null;

  const evalType = String(payload?.eval_type ?? "").toUpperCase();
  if (evalType !== "MIDTERM" && evalType !== "FINAL") {
    return {
      __error: true,
      message: "Tipo de avaliação inválido. Use MIDTERM ou FINAL.",
    };
  }

  const { data: progress, error: progressError } = await supabase
    .from("company_progress")
    .select("progression_stage")
    .eq("id", payload.company_progress_id)
    .maybeSingle();

  if (progressError) {
    console.error("[internFollowupService] upsertEvaluation stage lookup:", progressError);
    return null;
  }

  const stage = String(progress?.progression_stage ?? "").toUpperCase();
  const isMidtermAllowed = stage === "INTERNSHIP" || stage === "FIXED_TERM_CONTRACT" || stage === "PERMANENT_CONTRACT";
  const isFinalAllowed = stage === "COMPLETED" || stage === "TERMINATED";

  if (evalType === "MIDTERM" && !isMidtermAllowed) {
    return {
      __error: true,
      message: "Avaliação intercalar permitida apenas durante estágio/contrato e antes do encerramento.",
    };
  }

  if (evalType === "FINAL" && !isFinalAllowed) {
    return {
      __error: true,
      message: "Avaliação final permitida apenas quando o processo estiver concluído ou encerrado.",
    };
  }

  // Se existir avaliação do mesmo tipo, faz update; senão insert
  const { data: existing } = await supabase
    .from("intern_evaluations")
    .select("id")
    .eq("company_progress_id", payload.company_progress_id)
    .eq("eval_type", payload.eval_type)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("intern_evaluations")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      console.error("[internFollowupService] upsertEvaluation update:", error);
      // Surfaçar mensagem do trigger de validação de fase (errcode P0002/P0003)
      if (error.message) {
        return { __error: true, message: error.message };
      }
      return null;
    }
    return data;
  }

  const { data, error } = await supabase
    .from("intern_evaluations")
    .insert([payload])
    .select()
    .single();
  if (error) {
    console.error("[internFollowupService] upsertEvaluation insert:", error);
    // Surfaçar mensagem do trigger de validação de fase (errcode P0002/P0003)
    if (error.message) {
      return { __error: true, message: error.message };
    }
    return null;
  }
  return data;
}

export const RECOMMENDATION_LABELS = {
  HIRE: "Contratar",
  EXTEND: "Prolongar estágio",
  NO_ACTION: "Sem acção",
  TERMINATE: "Encerrar estágio",
};
