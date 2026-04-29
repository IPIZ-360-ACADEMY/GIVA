import { supabase } from "../lib/supabase.js";

export function canUseStudentProfileApi() {
  return typeof supabase !== "undefined" && supabase !== null;
}

/**
 * Obter perfil completo de um aluno
 */
export async function getStudentProfile(studentId) {
  if (!canUseStudentProfileApi()) return null;

  const { data, error } = await supabase
    .from("students")
    .select(
      `
      id,
      full_name,
      email,
      phone_number,
      address,
      city,
      postal_code,
      profile_photo_url,
      professional_summary,
      bio,
      skills,
      languages,
      portfolio_url,
      linkedin_url,
      cv_url,
      cover_letter_url,
      internship_letter_url,
      training_area:training_area_id(id, code, name, color_hex),
      course:course_id(id, name),
      academic_year,
      status,
      created_at,
      updated_at
    `
    )
    .eq("id", studentId)
    .single();

  if (error) {
    console.error("[studentProfileService] getStudentProfile error:", error);
    return null;
  }
  return data;
}

/**
 * Atualizar perfil do aluno
 */
export async function updateStudentProfile(studentId, updateData) {
  if (!canUseStudentProfileApi()) return null;

  const { data, error } = await supabase
    .from("students")
    .update(updateData)
    .eq("id", studentId)
    .select()
    .single();

  if (error) {
    console.error("[studentProfileService] updateStudentProfile error:", error);
    return null;
  }
  return data;
}

/**
 * Upload foto de perfil
 */
export async function uploadProfilePhoto(studentId, file) {
  if (!canUseStudentProfileApi()) return null;

  const bucketName = "student-profiles";
  const fileName = `${studentId}/${Date.now()}-${file.name}`;

  // Upload file
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file, { upsert: false });

  if (uploadError) {
    console.error("[studentProfileService] uploadProfilePhoto upload error:", uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(uploadData.path);

  // Update student record
  const { data, error } = await supabase
    .from("students")
    .update({ profile_photo_url: urlData.publicUrl })
    .eq("id", studentId)
    .select()
    .single();

  if (error) {
    console.error("[studentProfileService] uploadProfilePhoto update error:", error);
    return null;
  }
  return data;
}

/**
 * Listar portfólio do aluno
 */
export async function getStudentPortfolio(studentId) {
  if (!canUseStudentProfileApi()) return [];

  const { data, error } = await supabase
    .from("student_portfolio")
    .select("*")
    .eq("student_id", studentId)
    .order("start_date", { ascending: false });

  if (error) {
    console.error("[studentProfileService] getStudentPortfolio error:", error);
    return [];
  }
  return data || [];
}

/**
 * Adicionar item ao portfólio
 */
export async function addPortfolioItem(studentId, itemData) {
  if (!canUseStudentProfileApi()) return null;

  const { data, error } = await supabase
    .from("student_portfolio")
    .insert([{ ...itemData, student_id: studentId }])
    .select()
    .single();

  if (error) {
    console.error("[studentProfileService] addPortfolioItem error:", error);
    return null;
  }
  return data;
}

/**
 * Atualizar item do portfólio
 */
export async function updatePortfolioItem(portfolioId, updateData) {
  if (!canUseStudentProfileApi()) return null;

  const { data, error } = await supabase
    .from("student_portfolio")
    .update(updateData)
    .eq("id", portfolioId)
    .select()
    .single();

  if (error) {
    console.error("[studentProfileService] updatePortfolioItem error:", error);
    return null;
  }
  return data;
}

/**
 * Deletar item do portfólio
 */
export async function deletePortfolioItem(portfolioId) {
  if (!canUseStudentProfileApi()) return true;

  const { error } = await supabase
    .from("student_portfolio")
    .delete()
    .eq("id", portfolioId);

  if (error) {
    console.error("[studentProfileService] deletePortfolioItem error:", error);
    return false;
  }
  return true;
}

/**
 * Pesquisar alunos por nome, email ou skill
 */
export async function searchStudents(query, trainingAreaId = null) {
  if (!canUseStudentProfileApi()) return [];

  let queryBuilder = supabase
    .from("students")
    .select(
      `
      id,
      full_name,
      email,
      profile_photo_url,
      skills,
      training_area:training_area_id(name, color_hex)
    `
    );

  if (trainingAreaId) {
    queryBuilder = queryBuilder.eq("training_area_id", trainingAreaId);
  }

  const { data, error } = await queryBuilder
    .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(20);

  if (error) {
    console.error("[studentProfileService] searchStudents error:", error);
    return [];
  }
  return data || [];
}

/**
 * Listar alunos por área de formação
 */
export async function listStudentsByTrainingArea(trainingAreaId) {
  if (!canUseStudentProfileApi()) return [];

  const { data, error } = await supabase
    .from("students")
    .select(
      `
      id,
      full_name,
      email,
      profile_photo_url,
      course:course_id(name),
      status
    `
    )
    .eq("training_area_id", trainingAreaId)
    .eq("status", "ACTIVE");

  if (error) {
    console.error("[studentProfileService] listStudentsByTrainingArea error:", error);
    return [];
  }
  return data || [];
}
