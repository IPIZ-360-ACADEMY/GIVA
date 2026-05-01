import { supabase } from "../lib/supabase.js";
import { normalizeAuthIdentifier, signUpStudent } from "./authService.js";
import { normalizeStudentProcessNumber } from "../utils/processNumber.js";

function nullableTrim(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function currentSchoolYear() {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function currentMonthYearLabel() {
  return new Date().toLocaleDateString("pt-PT", { month: "short", year: "numeric" });
}

function currentDateLabel() {
  return new Date().toLocaleDateString("pt-PT");
}

export async function registerStudentUnified(input) {
  const processNumber = normalizeStudentProcessNumber(input?.processNumber);
  const fullName = String(input?.fullName ?? "").trim();
  const loginPassword = typeof input?.loginPassword === "string" ? input.loginPassword : "";

  if (!fullName) throw new Error("Nome completo é obrigatório.");
  if (!processNumber) throw new Error("Número de processo é obrigatório.");

  const studentPayload = {
    full_name: fullName,
    process_number: processNumber,
    email: nullableTrim(input?.email),
    phone_number: nullableTrim(input?.phoneNumber),
    date_of_birth: input?.dateOfBirth || null,
    training_area_id: input?.trainingAreaId || null,
    course_id: input?.courseId || null,
    address: nullableTrim(input?.address),
    profile_photo_url: nullableTrim(input?.profilePhotoUrl),
    guardian_name: nullableTrim(input?.guardianName),
    guardian_phone: nullableTrim(input?.guardianPhone),
    guardian_relation: nullableTrim(input?.guardianRelation),
    status: "ACTIVE",
  };

  const { data: studentRow, error: studentError } = await supabase
    .from("students")
    .upsert(studentPayload, { onConflict: "process_number" })
    .select("id, process_number, full_name")
    .single();

  if (studentError) throw studentError;

  const internshipPayload = {
    aluno: fullName,
    processo: processNumber,
    email: nullableTrim(input?.email),
    telefone: nullableTrim(input?.phoneNumber),
    turma: nullableTrim(input?.className),
    curso: nullableTrim(input?.courseCode) || "GERAL",
    ano_letivo: nullableTrim(input?.schoolYear) || currentSchoolYear(),
    empresa: nullableTrim(input?.company) || "Não definida",
    inicio: currentMonthYearLabel(),
    supervisor: nullableTrim(input?.supervisor) || "",
    ultima_atualizacao: currentDateLabel(),
    photo: nullableTrim(input?.profilePhotoUrl) || "",
    nota: Number(input?.grade ?? 0),
    status: nullableTrim(input?.internshipStatus) || "active",
    area_id: input?.trainingAreaId || null,
    bi: nullableTrim(input?.bi),
    morada: nullableTrim(input?.address),
    data_nasc: input?.dateOfBirth || null,
  };

  const { data: existingInternshipRows, error: existingInternshipError } = await supabase
    .from("internships")
    .select("id")
    .eq("processo", processNumber)
    .limit(1);

  if (existingInternshipError) throw existingInternshipError;

  if (existingInternshipRows?.length) {
    const internshipId = existingInternshipRows[0].id;
    const { error: updateInternshipError } = await supabase
      .from("internships")
      .update(internshipPayload)
      .eq("id", internshipId);

    if (updateInternshipError) throw updateInternshipError;
  } else {
    const { error: insertInternshipError } = await supabase
      .from("internships")
      .insert(internshipPayload);

    if (insertInternshipError) throw insertInternshipError;
  }

  // Se o aluno já tiver conta de utilizador, propagar a foto para user_profiles
  if (nullableTrim(input?.profilePhotoUrl)) {
    const { data: saRows } = await supabase
      .from("student_accounts")
      .select("id")
      .eq("process_number", processNumber)
      .limit(1);

    if (saRows?.length) {
      await supabase
        .from("user_profiles")
        .update({ avatar_url: input.profilePhotoUrl })
        .eq("id", saRows[0].id);
    }
  }

  const loginEmail = normalizeAuthIdentifier(processNumber);
  let authCreated = false;
  let authAlreadyExists = false;

  if (loginPassword) {
    const { error: signUpError } = await signUpStudent(processNumber, loginPassword, fullName, studentRow.id);
    if (signUpError) {
      const signUpMessage = String(signUpError.message ?? "");
      authAlreadyExists = /already/i.test(signUpMessage) || /registered/i.test(signUpMessage);
      if (!authAlreadyExists) {
        throw new Error(`Aluno registado, mas não foi possível criar a conta de acesso: ${signUpMessage || "erro desconhecido"}`);
      }
    } else {
      authCreated = true;
    }
  }

  return {
    studentId: studentRow.id,
    processNumber,
    fullName: studentRow.full_name,
    loginEmail,
    authCreated,
    authAlreadyExists,
  };
}
