import { supabase } from "../lib/supabase.js";

export function canUseStatisticsApi() {
  return typeof supabase !== "undefined" && supabase !== null;
}

/**
 * Agrega métricas globais da plataforma para a página de estatísticas.
 * Retorna valores calculados a partir de internships, job_applications e evaluations.
 */
export async function fetchStatisticsMetrics() {
  if (!canUseStatisticsApi()) return null;

  const [internshipsResult, applicationsResult, evaluationsResult] = await Promise.all([
    supabase.from("internships").select("id, status"),
    supabase.from("job_applications").select("id, status"),
    supabase.from("evaluations").select("id, score, is_final"),
  ]);

  const internships = internshipsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const evaluations = evaluationsResult.data ?? [];

  const total = internships.length || 1; // evita divisão por zero

  const active = internships.filter((r) => r.status === "active").length;
  const completed = internships.filter((r) => r.status === "completed").length;
  const risk = internships.filter((r) => r.status === "risk").length;

  const accepted = applications.filter((a) => a.status === "ACCEPTED").length;
  const totalApps = applications.length || 1;

  const finalEvals = evaluations.filter((e) => e.is_final);
  const avgScore =
    finalEvals.length > 0
      ? finalEvals.reduce((sum, e) => sum + (e.score ?? 0), 0) / finalEvals.length
      : null;

  return {
    completion: Math.round(((active + completed) / total) * 100),
    employability: Math.round((accepted / totalApps) * 100),
    dropout: Math.round((risk / total) * 100),
    satisfaction: avgScore !== null ? Math.round((avgScore / 20) * 100) : null,
    counts: {
      total,
      active,
      completed,
      risk,
      totalApplications: applications.length,
      accepted,
    },
  };
}
