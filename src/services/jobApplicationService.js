import { supabase } from "../lib/supabase.js";
import { createNotification } from "./notificationsService.js";
import { createCompanyProgress } from "./companyProgressService.js";

export function canUseJobApplicationApi() {
  return typeof supabase !== "undefined" && supabase !== null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim()
  );
}

async function resolveFallbackTrainingAreaId() {
  const { data, error } = await supabase
    .from("training_area")
    .select("id")
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[jobApplicationService] resolveFallbackTrainingAreaId error:", error);
  } else if (data?.id) {
    return data.id;
  }

  // Em bases legadas sem training_area semeada, tenta reaproveitar uma área já usada por outro aluno.
  const { data: studentArea, error: studentAreaError } = await supabase
    .from("students")
    .select("training_area_id")
    .not("training_area_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (studentAreaError) {
    console.warn("[jobApplicationService] resolveFallbackTrainingAreaId students fallback error:", studentAreaError);
    return null;
  }

  return studentArea?.training_area_id ?? null;
}

async function ensureStudentRecord(studentId) {
  const { data: existing, error: existingError } = await supabase
    .from("students")
    .select("id, cv_url, cover_letter_url, internship_letter_url")
    .eq("id", studentId)
    .maybeSingle();

  if (existingError) {
    console.error("[jobApplicationService] ensureStudentRecord check error:", existingError);
    return null;
  }

  if (existing) {
    return existing;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[jobApplicationService] ensureStudentRecord getUser error:", userError);
    return null;
  }

  const metadataAreaId = user.app_metadata?.area_id ?? user.user_metadata?.area_id;
  const trainingAreaId = isUuid(metadataAreaId)
    ? metadataAreaId
    : await resolveFallbackTrainingAreaId();

  const fullName =
    user.user_metadata?.display_name ??
    user.user_metadata?.name ??
    (typeof user.email === "string" ? user.email.split("@")[0] : null) ??
    "Estudante";

  const studentPayload = {
    id: studentId,
    full_name: fullName,
    email: user.email ?? null,
    status: "ACTIVE",
  };

  if (trainingAreaId) {
    studentPayload.training_area_id = trainingAreaId;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("students")
    .upsert(
      studentPayload,
      { onConflict: "id" }
    )
    .select("id, cv_url, cover_letter_url, internship_letter_url")
    .single();

  if (insertError) {
    console.error("[jobApplicationService] ensureStudentRecord upsert error:", insertError);
    return null;
  }

  return inserted;
}

async function resolveStudentEntityId(userId) {
  const normalizedUserId = String(userId ?? "").trim();
  if (!isUuid(normalizedUserId)) {
    return normalizedUserId;
  }

  const { data, error } = await supabase
    .from("student_accounts")
    .select("student_id")
    .eq("id", normalizedUserId)
    .maybeSingle();

  if (error) {
    console.warn("[jobApplicationService] resolveStudentEntityId error:", error);
    return normalizedUserId;
  }

  return isUuid(data?.student_id) ? data.student_id : normalizedUserId;
}

function isMissingRpc(error) {
  const message = String(error?.message ?? "").toLowerCase();
  return error?.code === "PGRST202" || message.includes("could not find the function");
}

async function reserveVacancySlot(vacancyId) {
  const { data: vacancy, error: vacancyError } = await supabase
    .from("partner_vacancies")
    .select("id, status, total_slots, filled_slots")
    .eq("id", vacancyId)
    .single();

  if (vacancyError || !vacancy) {
    console.error("[jobApplicationService] reserveVacancySlot fetch error:", vacancyError);
    return { ok: false, reason: "vacancy_not_found" };
  }

  const totalSlots = Number(vacancy.total_slots ?? 0);
  const filledSlots = Number(vacancy.filled_slots ?? 0);
  const isOpen = String(vacancy.status ?? "").toUpperCase() === "OPEN";

  if (!isOpen || filledSlots >= totalSlots) {
    return { ok: false, reason: "no_capacity" };
  }

  const { error: rpcError } = await supabase.rpc("increment_vacancy_filled_slots", {
    p_vacancy_id: vacancyId,
    p_increment: 1,
  });

  if (!rpcError) {
    return { ok: true, strategy: "rpc" };
  }

  if (!isMissingRpc(rpcError)) {
    console.warn("[jobApplicationService] reserveVacancySlot rpc error:", rpcError);
  }

  const nextFilledSlots = filledSlots + 1;
  const { error: updateError } = await supabase
    .from("partner_vacancies")
    .update({ filled_slots: nextFilledSlots })
    .eq("id", vacancyId)
    .eq("filled_slots", filledSlots);

  if (updateError) {
    console.warn("[jobApplicationService] reserveVacancySlot fallback update error:", updateError);
    return { ok: false, reason: "capacity_conflict" };
  }

  return { ok: true, strategy: "fallback" };
}

async function releaseVacancySlot(vacancyId) {
  if (!vacancyId) return;

  const { error: rpcError } = await supabase.rpc("increment_vacancy_filled_slots", {
    p_vacancy_id: vacancyId,
    p_increment: -1,
  });

  if (!rpcError) return;

  const { data: vacancy, error: vacancyError } = await supabase
    .from("partner_vacancies")
    .select("id, filled_slots")
    .eq("id", vacancyId)
    .single();

  if (vacancyError || !vacancy) return;

  const filledSlots = Number(vacancy.filled_slots ?? 0);
  if (filledSlots <= 0) return;

  await supabase
    .from("partner_vacancies")
    .update({ filled_slots: filledSlots - 1 })
    .eq("id", vacancyId)
    .eq("filled_slots", filledSlots);
}

/**
 * Listar candidaturas de um aluno
 */
export async function listStudentApplications(studentId) {
  if (!canUseJobApplicationApi()) return [];

  const resolvedStudentId = await resolveStudentEntityId(studentId);

  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      student_id,
      partner_id,
      vacancy_id,
      partner:partners(id, empresa, photo_preview),
      vacancy:partner_vacancies(id, title, description, total_slots, filled_slots, status),
      status,
      cv_url,
      cover_letter_url,
      internship_letter_url,
      applied_at,
      reviewed_at,
      rejection_reason,
      acceptance_notes
    `
    )
    .eq("student_id", resolvedStudentId)
    .order("applied_at", { ascending: false });

  if (error) {
    console.error("[jobApplicationService] listStudentApplications error:", error);
    return [];
  }
  return data || [];
}

/**
 * Listar candidaturas para uma empresa
 */
export async function listPartnerApplications(partnerId) {
  if (!canUseJobApplicationApi()) return [];

  const { data, error } = await supabase
    .from("job_applications")
    .select(
      `
      id,
      partner_id,
      vacancy_id,
      student:students(id, full_name, email, profile_photo_url, cv_url, cover_letter_url, internship_letter_url),
      vacancy:partner_vacancies(id, title, description, total_slots, filled_slots, status),
      status,
      cv_url,
      cover_letter_url,
      internship_letter_url,
      applied_at,
      reviewed_at,
      acceptance_notes
    `
    )
    .eq("partner_id", partnerId)
    .order("applied_at", { ascending: false });

  if (error) {
    console.error("[jobApplicationService] listPartnerApplications error:", error);
    return [];
  }
  return data || [];
}

/**
 * Submeter nova candidatura
 */
export async function submitJobApplication(studentId, partnerId, vacancyId) {
  if (!canUseJobApplicationApi()) return null;

  if (!vacancyId) {
    console.error("[jobApplicationService] submitJobApplication requires vacancyId");
    return null;
  }

  const resolvedStudentId = await resolveStudentEntityId(studentId);
  const studentDocs = await ensureStudentRecord(resolvedStudentId);
  if (!studentDocs) {
    console.error("[jobApplicationService] submitJobApplication missing student record");
    return null;
  }

  const { data, error } = await supabase
    .from("job_applications")
    .insert([
      {
        student_id: resolvedStudentId,
        partner_id: partnerId,
        vacancy_id: vacancyId,
        status: "PENDING",
        cv_url: studentDocs?.cv_url ?? null,
        cover_letter_url: studentDocs?.cover_letter_url ?? null,
        internship_letter_url: studentDocs?.internship_letter_url ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[jobApplicationService] submitJobApplication error:", error);
    return null;
  }

  try {
    await createNotification({
      title: "Nova candidatura submetida para vaga de parceiro.",
      prioridade: "medium",
    });
  } catch (notifyError) {
    console.warn("[jobApplicationService] submit notification failed:", notifyError);
  }

  return data;
}

/**
 * Aceitar candidatura (Empresa)
 */
export async function acceptJobApplication(applicationId, notes = "") {
  if (!canUseJobApplicationApi()) return null;

  const { data: application, error: fetchError } = await supabase
    .from("job_applications")
    .select("student_id, partner_id, vacancy_id, status")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) {
    console.error("[jobApplicationService] acceptJobApplication fetch error:", fetchError);
    return null;
  }

  if (application.status === "ACCEPTED") {
    return application;
  }

  const reservation = await reserveVacancySlot(application.vacancy_id);
  if (!reservation.ok) {
    console.warn("[jobApplicationService] acceptJobApplication reservation failed:", reservation.reason);
    return null;
  }

  // Atualizar candidatura
  const { data: updatedApp, error: updateError } = await supabase
    .from("job_applications")
    .update({
      status: "ACCEPTED",
      acceptance_notes: notes,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .select()
    .single();

  if (updateError) {
    console.error("[jobApplicationService] acceptJobApplication update error:", updateError);
    await releaseVacancySlot(application.vacancy_id);
    return null;
  }

  // Incrementar vagas preenchidas
  const { error: vagasError } = await supabase.rpc("increment_vagas_preenchidas", {
    id: application.partner_id,
    increment: 1,
  });

  if (vagasError && !isMissingRpc(vagasError)) {
    console.warn("[jobApplicationService] Could not update vagas_preenchidas");
  }

  const { data: existingProgress } = await supabase
    .from("company_progress")
    .select("id")
    .eq("student_id", application.student_id)
    .eq("partner_id", application.partner_id)
    .maybeSingle();

  if (!existingProgress?.id) {
    await createCompanyProgress(application.student_id, application.partner_id, applicationId);
  }

  try {
    await createNotification({
      title: "Candidatura aceite por parceiro.",
      prioridade: "high",
    });
  } catch (notifyError) {
    console.warn("[jobApplicationService] accept notification failed:", notifyError);
  }

  return updatedApp;
}

/**
 * Rejeitar candidatura (Empresa)
 */
export async function rejectJobApplication(applicationId, reason = "") {
  if (!canUseJobApplicationApi()) return null;

  const { data, error } = await supabase
    .from("job_applications")
    .update({
      status: "REJECTED",
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .select()
    .single();

  if (error) {
    console.error("[jobApplicationService] rejectJobApplication error:", error);
    return null;
  }

  try {
    await createNotification({
      title: "Candidatura rejeitada por parceiro.",
      prioridade: "medium",
    });
  } catch (notifyError) {
    console.warn("[jobApplicationService] reject notification failed:", notifyError);
  }

  return data;
}

/**
 * Retirar candidatura (Aluno)
 */
export async function withdrawJobApplication(applicationId) {
  if (!canUseJobApplicationApi()) return null;

  const { data, error } = await supabase
    .from("job_applications")
    .update({ status: "WITHDRAWN" })
    .eq("id", applicationId)
    .select()
    .single();

  if (error) {
    console.error("[jobApplicationService] withdrawJobApplication error:", error);
    return null;
  }
  return data;
}

export async function completeJobApplication(applicationId) {
  if (!canUseJobApplicationApi()) return null;

  const { data, error } = await supabase
    .from("job_applications")
    .update({ status: "COMPLETED", reviewed_at: new Date().toISOString() })
    .eq("id", applicationId)
    .select()
    .single();

  if (error) {
    console.error("[jobApplicationService] completeJobApplication error:", error);
    return null;
  }
  return data;
}

/**
 * Verificar se aluno já candidatou a empresa
 */
export async function checkApplicationExists(studentId, partnerId, vacancyId = null) {
  if (!canUseJobApplicationApi()) return false;

  let query = supabase
    .from("job_applications")
    .select("id")
    .eq("student_id", studentId)
    .eq("partner_id", partnerId);

  if (vacancyId) {
    query = query.eq("vacancy_id", vacancyId);
  }

  const { data, error } = await query.single();

  if (error && error.code !== "PGRST116") {
    console.error("[jobApplicationService] checkApplicationExists error:", error);
  }
  return !!data;
}
