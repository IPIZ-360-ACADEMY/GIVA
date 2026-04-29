import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

const INTERNSHIPS_TABLE = "internships";
const isTestMode = import.meta.env.MODE === "test";

const TEST_INTERNSHIPS = [
  {
    id: "test-1",
    aluno: "Ana Melo",
    turma: "11-TI-A",
    ano_letivo: "2025/2026",
    curso: "TI",
    empresa: "NovaSoft",
    inicio: "12 Fev 2026",
    nota: 17,
    status: "active",
    supervisor: "Carlos Pires",
    ultima_atualizacao: "20 Mar 2026",
    photo: "/images/students/ana-melo.jpg",
    email: "ana.melo@giva.ao",
    telefone: "+244 923 000 111",
  },
  {
    id: "test-2",
    aluno: "Bruno Silva",
    turma: "11-TI-A",
    ano_letivo: "2025/2026",
    curso: "TI",
    empresa: "NovaSoft",
    inicio: "10 Fev 2026",
    nota: 15,
    status: "monitoring",
    supervisor: "Carlos Pires",
    ultima_atualizacao: "18 Mar 2026",
    photo: "/images/students/bruno-silva.jpg",
    email: "bruno.silva@giva.ao",
    telefone: "+244 923 000 222",
  },
  {
    id: "test-3",
    aluno: "Marta Costa",
    turma: "12-EIE-B",
    ano_letivo: "2025/2026",
    curso: "EIE",
    empresa: "ElectroAngola",
    inicio: "03 Fev 2026",
    nota: 18,
    status: "risk",
    supervisor: "Helena Gomes",
    ultima_atualizacao: "14 Mar 2026",
    photo: "/images/students/marta-costa.jpg",
    email: "marta.costa@giva.ao",
    telefone: "+244 923 000 333",
  },
];

function normalizeRow(row) {
  return {
    id: row.id,
    aluno: row.aluno ?? "",
    processo: row.processo ?? row.process_number ?? "",
    turma: row.turma ?? "",
    anoLetivo: row.ano_letivo ?? "",
    curso: row.curso ?? "",
    empresa: row.empresa ?? "",
    inicio: row.inicio ?? "",
    nota: String(row.nota ?? ""),
    status: row.status ?? "active",
    supervisor: row.supervisor ?? "",
    ultimaAtualizacao: row.ultima_atualizacao ?? "",
    photo: row.photo ?? "",
    email: row.email ?? "",
    telefone: row.telefone ?? "",
    areaId: row.area_id ?? null,
  };
}

export function canUseInternshipsApi() {
  return isTestMode || (isSupabaseConfigured && Boolean(supabase));
}

export async function listInternships() {
  if (isTestMode) {
    return TEST_INTERNSHIPS.map(normalizeRow);
  }

  if (!canUseInternshipsApi()) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from(INTERNSHIPS_TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(normalizeRow);
}
