import { supabase } from "../lib/supabase.js";

const PROGRESS_AUDIT_TABLE = "company_batch_operations_audit";

function nowIso() {
  return new Date().toISOString();
}

function isStageOneOf(stage, allowedStages) {
  const normalized = String(stage ?? "").trim().toUpperCase();
  return allowedStages.includes(normalized);
}

function normalizeRating(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

async function getProgressSnapshot(progressId) {
  const { data, error } = await supabase
    .from("company_progress")
    .select("id, student_id, partner_id, job_application_id, progression_stage, progress_status")
    .eq("id", progressId)
    .maybeSingle();

  if (error) {
    console.error("[companyProgressService] getProgressSnapshot error:", error);
    return null;
  }

  return data ?? null;
}

async function resolveAuditActor() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      return { id: null, name: "Sistema" };
    }

    const userId = data.user.id;
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return { id: userId, name: data.user.email ?? "Utilizador" };
    }

    return {
      id: userId,
      name: profile?.display_name || data.user.email || "Utilizador",
    };
  } catch {
    return { id: null, name: "Sistema" };
  }
}

async function insertProgressAuditRow({
  previous,
  current,
  action,
  reason = "",
  metadata = {},
}) {
  if (!current?.partner_id) {
    return;
  }

  const actor = await resolveAuditActor();
  const payload = {
    batch_id: `progress-${current.id}`,
    partner_id: current.partner_id,
    application_id: current.job_application_id ?? null,
    vacancy_id: null,
    processed_by: actor.id,
    processed_by_name: actor.name,
    action,
    result: "SUCCESS",
    reason: reason || null,
    student_name: "Estagiário",
    vacancy_title: "Progresso de estágio",
    processed_at: nowIso(),
    metadata: {
      source: "company-progress",
      from_stage: previous?.progression_stage ?? null,
      to_stage: current?.progression_stage ?? null,
      from_status: previous?.progress_status ?? null,
      to_status: current?.progress_status ?? null,
      ...metadata,
    },
  };

  const { error } = await supabase.from(PROGRESS_AUDIT_TABLE).insert(payload);
  if (error) {
    // Auditoria é best-effort: não deve quebrar o fluxo principal.
    console.warn("[companyProgressService] insertProgressAuditRow warning:", error);
  }
}

export function canUseCompanyProgressApi() {
  return typeof supabase !== "undefined" && supabase !== null;
}

/**
 * Obter progresso da empresa para um aluno
 */
export async function getCompanyProgress(studentId, partnerId) {
  if (!canUseCompanyProgressApi()) return null;

  const { data, error } = await supabase
    .from("company_progress")
    .select(
      `
      id,
      student_id,
      partner_id,
      job_application_id,
      progression_stage,
      progress_status,
      interview_date,
      interview_result,
      interview_notes,
      internship_start_date,
      internship_end_date,
      internship_has_compensation,
      internship_compensation_amount,
      internship_duration_months,
      contract_type,
      contract_start_date,
      contract_end_date,
      contract_salary,
      company_contact_name,
      company_contact_email,
      company_contact_phone,
      status_updated_at,
      student_assessment_rating,
      company_assessment_rating,
      company_assessment_text,
      created_at,
      updated_at
    `
    )
    .eq("student_id", studentId)
    .eq("partner_id", partnerId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("[companyProgressService] getCompanyProgress error:", error);
  }
  return data || null;
}

/**
 * Listar progressos de um aluno em múltiplas empresas
 */
export async function listStudentProgressByPartner(studentId) {
  if (!canUseCompanyProgressApi()) return [];

  const { data, error } = await supabase
    .from("company_progress")
    .select(
      `
      id,
      partner:partners(id, empresa, photo_preview),
      progression_stage,
      progress_status,
      internship_start_date,
      internship_end_date,
      contract_type,
      updated_at
    `
    )
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[companyProgressService] listStudentProgressByPartner error:", error);
    return [];
  }
  return data || [];
}

/**
 * Criar novo registro de progresso (Empresa após aceitar candidatura)
 */
export async function createCompanyProgress(studentId, partnerId, jobApplicationId) {
  if (!canUseCompanyProgressApi()) return null;

  const { data, error } = await supabase
    .from("company_progress")
    .insert([
      {
        student_id: studentId,
        partner_id: partnerId,
        job_application_id: jobApplicationId,
        progression_stage: "INTERVIEW",
        progress_status: "IN_PROGRESS",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] createCompanyProgress error:", error);
    return null;
  }
  return data;
}

/**
 * Atualizar fase de entrevista
 */
export async function updateInterviewPhase(progressId, payload) {
  if (!canUseCompanyProgressApi()) return null;

  const previous = await getProgressSnapshot(progressId);
  if (!previous) return null;
  if (!isStageOneOf(previous.progression_stage, ["INTERVIEW"])) {
    console.warn("[companyProgressService] updateInterviewPhase blocked by stage:", previous.progression_stage);
    return null;
  }

  const nextStatus = payload.result === "REJECTED" ? "FAILED" : previous.progress_status;
  const nextStage = payload.result === "ACCEPTED" ? "INTERNSHIP" : previous.progression_stage;

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      interview_date: payload.date,
      interview_result: payload.result, // ACCEPTED | REJECTED
      interview_notes: payload.notes,
      status_updated_at: nowIso(),
      ...(payload.result === "ACCEPTED" && {
        progression_stage: "INTERNSHIP",
      }),
      ...(payload.result === "REJECTED" && {
        progress_status: "FAILED",
      }),
    })
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] updateInterviewPhase error:", error);
    return null;
  }

  await insertProgressAuditRow({
    previous,
    current: data,
    action: "INTERVIEW_UPDATE",
    reason: payload.result === "REJECTED" ? (payload.notes || "Entrevista rejeitada") : "Entrevista atualizada",
    metadata: { interview_result: payload.result ?? null, forced_stage: nextStage, forced_status: nextStatus },
  });

  return data;
}

/**
 * Atualizar fase de estágio
 */
export async function updateInternshipPhase(progressId, payload) {
  if (!canUseCompanyProgressApi()) return null;

  const previous = await getProgressSnapshot(progressId);
  if (!previous) return null;
  if (!isStageOneOf(previous.progression_stage, ["INTERNSHIP"])) {
    console.warn("[companyProgressService] updateInternshipPhase blocked by stage:", previous.progression_stage);
    return null;
  }

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      internship_start_date: payload.startDate,
      internship_end_date: payload.endDate,
      internship_has_compensation: payload.hasCompensation,
      internship_compensation_amount: payload.compensationAmount,
      internship_duration_months: payload.durationMonths,
      status_updated_at: nowIso(),
    })
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] updateInternshipPhase error:", error);
    return null;
  }

  await insertProgressAuditRow({
    previous,
    current: data,
    action: "INTERNSHIP_UPDATE",
    metadata: {
      internship_start_date: payload.startDate ?? null,
      internship_end_date: payload.endDate ?? null,
    },
  });

  return data;
}

/**
 * Atualizar fase de contrato
 */
export async function updateContractPhase(progressId, payload) {
  if (!canUseCompanyProgressApi()) return null;

  const previous = await getProgressSnapshot(progressId);
  if (!previous) return null;
  if (!isStageOneOf(previous.progression_stage, ["INTERNSHIP", "FIXED_TERM_CONTRACT", "PERMANENT_CONTRACT"])) {
    console.warn("[companyProgressService] updateContractPhase blocked by stage:", previous.progression_stage);
    return null;
  }
  if (!["FIXED_TERM", "PERMANENT"].includes(String(payload.contractType ?? ""))) {
    console.warn("[companyProgressService] updateContractPhase invalid contractType:", payload.contractType);
    return null;
  }

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      progression_stage: payload.contractType === "PERMANENT" ? "PERMANENT_CONTRACT" : "FIXED_TERM_CONTRACT",
      contract_type: payload.contractType,
      contract_start_date: payload.startDate,
      contract_end_date: payload.endDate,
      contract_salary: payload.salary,
      status_updated_at: nowIso(),
    })
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] updateContractPhase error:", error);
    return null;
  }

  await insertProgressAuditRow({
    previous,
    current: data,
    action: "CONTRACT_UPDATE",
    metadata: {
      contract_type: payload.contractType,
      contract_start_date: payload.startDate ?? null,
      contract_end_date: payload.endDate ?? null,
    },
  });

  return data;
}

/**
 * Atualizar contato da empresa
 */
export async function updateCompanyContact(progressId, contactData) {
  if (!canUseCompanyProgressApi()) return null;

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      company_contact_name: contactData.name,
      company_contact_email: contactData.email,
      company_contact_phone: contactData.phone,
    })
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] updateCompanyContact error:", error);
    return null;
  }
  return data;
}

/**
 * Adicionar avaliação mútua (aluno → empresa ou empresa → aluno)
 */
export async function addMutualAssessment(progressId, assessmentData) {
  if (!canUseCompanyProgressApi()) return null;

  const previous = await getProgressSnapshot(progressId);
  if (!previous) return null;
  if (!isStageOneOf(previous.progression_stage, ["COMPLETED", "TERMINATED"])) {
    console.warn("[companyProgressService] addMutualAssessment blocked by stage:", previous.progression_stage);
    return null;
  }

  const updatePayload = {};
  const rating = normalizeRating(assessmentData.rating);
  if (rating == null || rating < 0 || rating > 5) {
    console.warn("[companyProgressService] addMutualAssessment invalid rating:", assessmentData.rating);
    return null;
  }

  if (assessmentData.type === "company") {
    updatePayload.company_assessment_rating = rating;
    updatePayload.company_assessment_text = assessmentData.text;
  } else if (assessmentData.type === "student") {
    updatePayload.student_assessment_rating = rating;
  } else {
    console.warn("[companyProgressService] addMutualAssessment invalid type:", assessmentData.type);
    return null;
  }

  updatePayload.status_updated_at = nowIso();

  const { data, error } = await supabase
    .from("company_progress")
    .update(updatePayload)
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] addMutualAssessment error:", error);
    return null;
  }

  await insertProgressAuditRow({
    previous,
    current: data,
    action: "MUTUAL_ASSESSMENT_UPDATE",
    metadata: {
      assessment_type: assessmentData.type,
      rating,
    },
  });

  return data;
}

/**
 * Completar progresso
 */
export async function completeProgress(progressId) {
  if (!canUseCompanyProgressApi()) return null;

  const previous = await getProgressSnapshot(progressId);
  if (!previous) return null;
  if (!isStageOneOf(previous.progression_stage, ["FIXED_TERM_CONTRACT", "PERMANENT_CONTRACT"])) {
    console.warn("[companyProgressService] completeProgress blocked by stage:", previous.progression_stage);
    return null;
  }

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      progression_stage: "COMPLETED",
      progress_status: "COMPLETED",
      status_updated_at: nowIso(),
    })
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] completeProgress error:", error);
    return null;
  }

  if (data?.job_application_id) {
    const { error: appError } = await supabase
      .from("job_applications")
      .update({ status: "COMPLETED", reviewed_at: nowIso() })
      .eq("id", data.job_application_id);
    if (appError) {
      console.warn("[companyProgressService] completeProgress sync application warning:", appError);
    }
  }

  await insertProgressAuditRow({
    previous,
    current: data,
    action: "PROGRESS_COMPLETED",
  });

  return data;
}

/**
 * Terminar progresso (Empresa encerra relação)
 */
export async function terminateProgress(progressId, reason = "") {
  if (!canUseCompanyProgressApi()) return null;

  const previous = await getProgressSnapshot(progressId);
  if (!previous) return null;
  if (isStageOneOf(previous.progression_stage, ["COMPLETED"])) {
    console.warn("[companyProgressService] terminateProgress blocked by stage:", previous.progression_stage);
    return null;
  }

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      progression_stage: "TERMINATED",
      progress_status: "FAILED",
      company_assessment_text: reason,
      status_updated_at: nowIso(),
    })
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] terminateProgress error:", error);
    return null;
  }

  if (data?.job_application_id) {
    const { error: appError } = await supabase
      .from("job_applications")
      .update({ status: "REJECTED", rejection_reason: reason || "Processo encerrado pela empresa", reviewed_at: nowIso() })
      .eq("id", data.job_application_id);
    if (appError) {
      console.warn("[companyProgressService] terminateProgress sync application warning:", appError);
    }
  }

  await insertProgressAuditRow({
    previous,
    current: data,
    action: "PROGRESS_TERMINATED",
    reason,
  });

  return data;
}
