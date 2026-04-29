import { supabase } from "../lib/supabase.js";

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

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      interview_date: payload.date,
      interview_result: payload.result, // ACCEPTED | REJECTED
      interview_notes: payload.notes,
      status_updated_at: new Date().toISOString(),
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
  return data;
}

/**
 * Atualizar fase de estágio
 */
export async function updateInternshipPhase(progressId, payload) {
  if (!canUseCompanyProgressApi()) return null;

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      internship_start_date: payload.startDate,
      internship_end_date: payload.endDate,
      internship_has_compensation: payload.hasCompensation,
      internship_compensation_amount: payload.compensationAmount,
      internship_duration_months: payload.durationMonths,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] updateInternshipPhase error:", error);
    return null;
  }
  return data;
}

/**
 * Atualizar fase de contrato
 */
export async function updateContractPhase(progressId, payload) {
  if (!canUseCompanyProgressApi()) return null;

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      progression_stage: payload.contractType === "PERMANENT" ? "PERMANENT_CONTRACT" : "FIXED_TERM_CONTRACT",
      contract_type: payload.contractType,
      contract_start_date: payload.startDate,
      contract_end_date: payload.endDate,
      contract_salary: payload.salary,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", progressId)
    .select()
    .single();

  if (error) {
    console.error("[companyProgressService] updateContractPhase error:", error);
    return null;
  }
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

  const updatePayload = {};
  if (assessmentData.type === "company") {
    updatePayload.company_assessment_rating = assessmentData.rating;
    updatePayload.company_assessment_text = assessmentData.text;
  } else if (assessmentData.type === "student") {
    updatePayload.student_assessment_rating = assessmentData.rating;
  }

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
  return data;
}

/**
 * Completar progresso
 */
export async function completeProgress(progressId) {
  if (!canUseCompanyProgressApi()) return null;

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      progression_stage: "COMPLETED",
      progress_status: "COMPLETED",
      status_updated_at: new Date().toISOString(),
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
      .update({ status: "COMPLETED", reviewed_at: new Date().toISOString() })
      .eq("id", data.job_application_id);
    if (appError) {
      console.warn("[companyProgressService] completeProgress sync application warning:", appError);
    }
  }

  return data;
}

/**
 * Terminar progresso (Empresa encerra relação)
 */
export async function terminateProgress(progressId, reason = "") {
  if (!canUseCompanyProgressApi()) return null;

  const { data, error } = await supabase
    .from("company_progress")
    .update({
      progression_stage: "TERMINATED",
      progress_status: "FAILED",
      company_assessment_text: reason,
      status_updated_at: new Date().toISOString(),
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
      .update({ status: "REJECTED", rejection_reason: reason || "Processo encerrado pela empresa", reviewed_at: new Date().toISOString() })
      .eq("id", data.job_application_id);
    if (appError) {
      console.warn("[companyProgressService] terminateProgress sync application warning:", appError);
    }
  }

  return data;
}
