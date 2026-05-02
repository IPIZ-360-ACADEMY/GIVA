import { supabase } from "../lib/supabase.js";

function rbac() {
  return supabase.schema("rbac");
}

export function canUseRbacApi() {
  return typeof supabase !== "undefined" && supabase !== null;
}

export async function listStudentJobs() {
  if (!canUseRbacApi()) return [];

  const { data, error } = await rbac()
    .from("jobs")
    .select("id, title, description, course_id, company_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[rbacService] listStudentJobs error:", error);
    return [];
  }

  return data ?? [];
}

export async function applyToJob(jobId) {
  if (!canUseRbacApi() || !jobId) return null;

  const { data, error } = await rbac().rpc("create_application", { p_job_id: jobId });

  if (error) {
    console.error("[rbacService] applyToJob error:", error);
    return null;
  }

  return data;
}

export async function listCompanyApplications() {
  if (!canUseRbacApi()) return [];

  const { data, error } = await rbac()
    .from("applications")
    .select("id, job_id, student_id, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[rbacService] listCompanyApplications error:", error);
    return [];
  }

  return data ?? [];
}

export async function evaluateApplication(applicationId, status) {
  if (!canUseRbacApi() || !applicationId || !status) return null;

  const normalizedStatus = String(status).trim().toUpperCase();
  if (!["ACCEPTED", "REJECTED", "PENDING"].includes(normalizedStatus)) return null;

  const { data, error } = await rbac().rpc("evaluate_application", {
    p_application_id: applicationId,
    p_status: normalizedStatus,
  });

  if (error) {
    console.error("[rbacService] evaluateApplication error:", error);
    return null;
  }

  return data;
}
