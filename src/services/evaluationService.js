import { supabase } from "../lib/supabase.js";

export function canUseEvaluationApi() {
  return typeof supabase !== "undefined" && supabase !== null;
}

/**
 * Criar avaliação individual
 */
export async function createIndividualEvaluation(payload) {
  if (!canUseEvaluationApi()) return null;

  const { data, error } = await supabase
    .from("evaluations")
    .insert([
      {
        ...payload,
        evaluation_type: "INDIVIDUAL",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("[evaluationService] createIndividualEvaluation error:", error);
    return null;
  }
  return data;
}

/**
 * Criar avaliação em grupo (aplica a múltiplos alunos)
 */
export async function createGroupEvaluation(groupData) {
  if (!canUseEvaluationApi()) return [];

  // Primeiro, criar avaliação pai (sem student_id)
  const { data: groupEvalData, error: groupError } = await supabase
    .from("evaluations")
    .insert([
      {
        training_area_id: groupData.trainingAreaId,
        evaluation_type: "GROUP",
        student_id: null,
        evaluator_id: groupData.evaluatorId,
        subject: groupData.subject,
        score: groupData.score,
        feedback: groupData.feedback,
        evaluation_date: groupData.evaluationDate,
        is_final: groupData.isFinal || false,
      },
    ])
    .select()
    .single();

  if (groupError) {
    console.error("[evaluationService] createGroupEvaluation group error:", groupError);
    return [];
  }

  // Depois, criar registos para cada aluno do grupo
  const studentEvaluations = groupData.studentIds.map((studentId) => ({
    training_area_id: groupData.trainingAreaId,
    evaluation_type: "INDIVIDUAL",
    group_evaluation_id: groupEvalData.id,
    student_id: studentId,
    evaluator_id: groupData.evaluatorId,
    subject: groupData.subject,
    score: groupData.score,
    feedback: groupData.feedback,
    evaluation_date: groupData.evaluationDate,
    is_final: groupData.isFinal || false,
  }));

  const { data: studentEvalList, error: studentError } = await supabase
    .from("evaluations")
    .insert(studentEvaluations)
    .select();

  if (studentError) {
    console.error("[evaluationService] createGroupEvaluation students error:", studentError);
    return [];
  }

  return studentEvalList || [];
}

/**
 * Obter avaliações de um aluno
 */
export async function getStudentEvaluations(studentId) {
  if (!canUseEvaluationApi()) return [];

  const { data, error } = await supabase
    .from("evaluations")
    .select(
      `
      id,
      subject,
      score,
      feedback,
      evaluation_date,
      evaluation_type,
      group_evaluation_id,
      training_area:training_area_id(name, color_hex),
      evaluator:evaluator_id(full_name)
    `
    )
    .eq("student_id", studentId)
    .order("evaluation_date", { ascending: false });

  if (error) {
    console.error("[evaluationService] getStudentEvaluations error:", error);
    return [];
  }
  return data || [];
}

/**
 * Calcular média de avaliações de um aluno
 */
export async function getStudentAverageGrade(studentId) {
  if (!canUseEvaluationApi()) return 0;

  const { data, error } = await supabase
    .from("evaluations")
    .select("score")
    .eq("student_id", studentId)
    .eq("is_final", true);

  if (error) {
    console.error("[evaluationService] getStudentAverageGrade error:", error);
    return 0;
  }

  if (!data || data.length === 0) return 0;

  const sum = data.reduce((acc, evaluation) => acc + evaluation.score, 0);
  return (sum / data.length).toFixed(2);
}

/**
 * Obter avaliações de uma turma
 */
export async function getClassEvaluations(trainingAreaId, courseId = null) {
  if (!canUseEvaluationApi()) return [];

  let queryBuilder = supabase
    .from("evaluations")
    .select(
      `
      id,
      student:student_id(id, full_name),
      subject,
      score,
      evaluation_date,
      evaluation_type,
      training_area:training_area_id(name)
    `
    )
    .eq("training_area_id", trainingAreaId);

  if (courseId) {
    queryBuilder = queryBuilder.eq("student_course_id", courseId);
  }

  const { data, error } = await queryBuilder.order("evaluation_date", { ascending: false });

  if (error) {
    console.error("[evaluationService] getClassEvaluations error:", error);
    return [];
  }
  return data || [];
}

/**
 * Atualizar avaliação
 */
export async function updateEvaluation(evaluationId, updateData) {
  if (!canUseEvaluationApi()) return null;

  const { data, error } = await supabase
    .from("evaluations")
    .update(updateData)
    .eq("id", evaluationId)
    .select()
    .single();

  if (error) {
    console.error("[evaluationService] updateEvaluation error:", error);
    return null;
  }
  return data;
}

/**
 * Deletar avaliação
 */
export async function deleteEvaluation(evaluationId) {
  if (!canUseEvaluationApi()) return true;

  // Se for uma avaliação de grupo (pai), também deletar filhas
  const { data: evaluation } = await supabase
    .from("evaluations")
    .select("id, evaluation_type")
    .eq("id", evaluationId)
    .single();

  if (evaluation && evaluation.evaluation_type === "GROUP") {
    // Deletar avaliações filhas
    await supabase.from("evaluations").delete().eq("group_evaluation_id", evaluationId);
  }

  const { error } = await supabase.from("evaluations").delete().eq("id", evaluationId);

  if (error) {
    console.error("[evaluationService] deleteEvaluation error:", error);
    return false;
  }
  return true;
}

/**
 * Listar avaliações por tipo (individual vs grupo)
 */
export async function listEvaluationsByType(trainingAreaId, evaluationType = "INDIVIDUAL") {
  if (!canUseEvaluationApi()) return [];

  const { data, error } = await supabase
    .from("evaluations")
    .select(
      `
      id,
      subject,
      score,
      evaluation_type,
      student:student_id(full_name),
      evaluation_date
    `
    )
    .eq("training_area_id", trainingAreaId)
    .eq("evaluation_type", evaluationType)
    .order("evaluation_date", { ascending: false });

  if (error) {
    console.error("[evaluationService] listEvaluationsByType error:", error);
    return [];
  }
  return data || [];
}

/**
 * Exportar relatório de avaliações (CSV)
 */
export async function exportEvaluationsReport(trainingAreaId, format = "csv") {
  if (!canUseEvaluationApi()) return null;

  const { data, error } = await supabase
    .from("evaluations")
    .select(
      `
      student:student_id(full_name, email),
      subject,
      score,
      feedback,
      evaluation_date,
      evaluation_type
    `
    )
    .eq("training_area_id", trainingAreaId)
    .order("evaluation_date", { ascending: false });

  if (error) {
    console.error("[evaluationService] exportEvaluationsReport error:", error);
    return null;
  }

  // Simples CSV generation
  if (format === "csv") {
    const headers = ["Nome", "Email", "Assunto", "Nota", "Data", "Tipo"];
    const rows = data.map((evaluation_item) => [
      evaluation_item.student?.full_name || "N/A",
      evaluation_item.student?.email || "N/A",
      evaluation_item.subject,
      evaluation_item.score,
      new Date(evaluation_item.evaluation_date).toLocaleDateString("pt-PT"),
      evaluation_item.evaluation_type,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    return csvContent;
  }

  return data;
}
