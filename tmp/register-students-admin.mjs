/**
 * Script para registar alunos usando a Admin API do Supabase
 * (sem auto-login, preserva sessão do utilizador admin no browser)
 * 
 * Execução: node tmp/register-students-admin.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carregar .env manualmente
const envPath = resolve(__dirname, "../.env");
const envContent = readFileSync(envPath, "utf-8");
const envVars = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
  envVars[key] = value;
}

const supabaseUrl = envVars["VITE_SUPABASE_URL"];
const serviceRoleKey = envVars["SUPABASE_SERVICE_ROLE_KEY"];
const emailDomain = envVars["VITE_AUTH_EMAIL_DOMAIN"] || "giva.ao";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrado no .env");
  process.exit(1);
}

// Cliente admin (sem auto-confirm, sem persistência de sessão)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const AREA_INFORMATICA_ID = "8f449459-046c-4b9d-b0b3-b505c2f7f88b";
const DEFAULT_PASSWORD = "ipiz2026";
const SCHOOL_YEAR = "2026/2027";

function normalizeProcessNumber(raw) {
  const cleaned = String(raw ?? "").trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const match = cleaned.match(/^I(\d+)$/i);
  if (!match) return null;
  return `I${match[1]}`;
}

function syntheticLoginEmail(processNumber) {
  const normalized = normalizeProcessNumber(processNumber);
  if (!normalized) return null;
  return `aluno.${normalized.toLowerCase()}@${emailDomain}`;
}

const STUDENTS = [
  {
    nome: "Yuta Okotsu",
    processo: "I422",
    email: "yuta.okotsu@giva.ao", // sem email real
    telefone: "935358496",
    turma: "13TIA",
    curso: "TI",
  },
  {
    nome: "Edson Mizalaque",
    processo: "I776",
    email: "mizalaqueedson@gmail.com",
    telefone: "936031181",
    turma: "13TIA",
    curso: "TI",
  },
  {
    nome: "Baptista L T Chuma",
    processo: "I299304",
    email: "baptista@giva.ao",
    telefone: "933433423",
    turma: "TI13ADTT",
    curso: "GERAL",
  },
];

async function registerStudent(student) {
  const processNumber = normalizeProcessNumber(student.processo);
  if (!processNumber) {
    console.error(`❌ Processo inválido: ${student.processo}`);
    return;
  }

  const loginEmail = syntheticLoginEmail(processNumber);
  console.log(`\n📝 Registar: ${student.nome} (${processNumber}) → ${loginEmail}`);

  // 1. Criar/actualizar registo em students
  const { data: studentRow, error: studentErr } = await supabaseAdmin
    .from("students")
    .upsert({
      full_name: student.nome,
      process_number: processNumber,
      email: student.email,
      phone_number: student.telefone,
      training_area_id: AREA_INFORMATICA_ID,
      status: "ACTIVE",
    }, { onConflict: "process_number" })
    .select("id, process_number, full_name")
    .single();

  if (studentErr) {
    console.error(`  ❌ Erro em students: ${studentErr.message}`);
    return;
  }
  console.log(`  ✅ students: id=${studentRow.id}`);

  // 2. Criar/actualizar em internships
  const today = new Date();
  const currentMonthYear = today.toLocaleDateString("pt-PT", { month: "short", year: "numeric" });
  const currentDate = today.toLocaleDateString("pt-PT");

  const { data: existingInternship } = await supabaseAdmin
    .from("internships")
    .select("id")
    .eq("processo", processNumber)
    .limit(1);

  const internshipPayload = {
    aluno: student.nome,
    processo: processNumber,
    email: student.email,
    telefone: student.telefone,
    turma: student.turma,
    curso: student.curso,
    ano_letivo: SCHOOL_YEAR,
    empresa: "Não definida",
    inicio: currentMonthYear,
    ultima_atualizacao: currentDate,
    photo: "",
    nota: 0,
    status: "active",
    area_id: AREA_INFORMATICA_ID,
  };

  if (existingInternship?.length) {
    const { error: updErr } = await supabaseAdmin
      .from("internships")
      .update(internshipPayload)
      .eq("id", existingInternship[0].id);
    if (updErr) {
      console.error(`  ❌ Erro ao actualizar internship: ${updErr.message}`);
      return;
    }
    console.log(`  ✅ internships: actualizado`);
  } else {
    const { error: insErr } = await supabaseAdmin
      .from("internships")
      .insert(internshipPayload);
    if (insErr) {
      console.error(`  ❌ Erro ao inserir internship: ${insErr.message}`);
      return;
    }
    console.log(`  ✅ internships: inserido`);
  }

  // 3. Criar utilizador auth via Admin API (sem auto-login!)
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: loginEmail,
    password: DEFAULT_PASSWORD,
    email_confirm: true, // confirmar automaticamente
    user_metadata: {
      display_name: student.nome,
      full_name: student.nome,
    },
  });

  let userId;
  let authCreated = false;

  if (authErr) {
    if (authErr.message?.toLowerCase().includes("already")) {
      console.log(`  ⚠️  Auth já existe para ${loginEmail}. A usar utilizador existente...`);
      // Buscar o utilizador existente
      const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) {
        console.error(`  ❌ Erro ao listar utilizadores: ${listErr.message}`);
        return;
      }
      const existingUser = listData.users.find(u => u.email === loginEmail);
      if (!existingUser) {
        console.error(`  ❌ Não foi possível encontrar utilizador existente para ${loginEmail}`);
        return;
      }
      userId = existingUser.id;
    } else {
      console.error(`  ❌ Erro ao criar auth user: ${authErr.message}`);
      return;
    }
  } else {
    userId = authData.user.id;
    authCreated = true;
    console.log(`  ✅ Auth user criado: ${userId}`);
  }

  // 4. Criar/actualizar user_profiles
  const { error: profileErr } = await supabaseAdmin
    .from("user_profiles")
    .upsert({
      id: userId,
      type: "student",
      display_name: student.nome,
    }, { onConflict: "id" });

  if (profileErr) {
    console.error(`  ❌ Erro em user_profiles: ${profileErr.message}`);
    return;
  }
  console.log(`  ✅ user_profiles: ok`);

  // 5. Criar/actualizar student_accounts
  const studentAccountPayload = { id: userId, process_number: processNumber };
  
  const { error: saErr } = await supabaseAdmin
    .from("student_accounts")
    .upsert(studentAccountPayload, { onConflict: "id" });

  if (saErr) {
    // Tentar sem conflito
    const { error: saInsErr } = await supabaseAdmin
      .from("student_accounts")
      .insert(studentAccountPayload);
    if (saInsErr && !saInsErr.message?.includes("duplicate")) {
      console.error(`  ❌ Erro em student_accounts: ${saInsErr.message}`);
      return;
    }
  }
  console.log(`  ✅ student_accounts: ok`);

  // 6. Criar login_aliases
  const aliases = [
    {
      user_id: userId,
      alias: processNumber,
      login_email: loginEmail,
      account_type: "student",
    },
    {
      user_id: userId,
      alias: loginEmail,
      login_email: loginEmail,
      account_type: "student",
    },
  ];

  for (const alias of aliases) {
    const { error: aliasErr } = await supabaseAdmin
      .from("auth_login_aliases")
      .upsert(alias, { onConflict: "alias" });
    if (aliasErr) {
      console.error(`  ⚠️  Erro em auth_login_aliases (${alias.alias}): ${aliasErr.message}`);
    }
  }
  console.log(`  ✅ auth_login_aliases: ok`);

  console.log(`\n  🎉 Aluno ${student.nome} registado!`);
  console.log(`     Login: ${loginEmail}`);
  console.log(`     Password: ${DEFAULT_PASSWORD}`);
  console.log(`     Auth criada: ${authCreated}`);
}

async function main() {
  console.log("=== Registo de Alunos (Admin API) ===\n");
  
  for (const student of STUDENTS) {
    await registerStudent(student);
  }

  console.log("\n=== Feito! ===");
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
