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

function parsePaginationOptions(options) {
  const page = Number(options?.page);
  const limit = Number(options?.limit);
  if (!Number.isFinite(page) || !Number.isFinite(limit) || page < 1 || limit < 1) {
    return null;
  }

  return {
    page,
    limit,
    from: (page - 1) * limit,
    to: page * limit - 1,
  };
}

export function canUseInternshipsApi() {
  return isTestMode || (isSupabaseConfigured && Boolean(supabase));
}

export async function listInternships(options = undefined) {
  const pagination = parsePaginationOptions(options);

  if (isTestMode) {
    const rows = TEST_INTERNSHIPS.map(normalizeRow);
    if (!pagination) {
      return rows;
    }

    const items = rows.slice(pagination.from, pagination.to + 1);
    return {
      items,
      total: rows.length,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(rows.length / pagination.limit)),
    };
  }

  if (!canUseInternshipsApi()) {
    throw new Error("Supabase is not configured");
  }

  let query = supabase
    .from(INTERNSHIPS_TABLE)
    .select(pagination ? "*" : "*", pagination ? { count: "exact" } : undefined)
    .order("created_at", { ascending: false });

  if (pagination) {
    query = query.range(pagination.from, pagination.to);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const rows = data.map(normalizeRow);
  if (!pagination) {
    return rows;
  }

  const total = Number.isFinite(count) ? count : rows.length;
  return {
    items: rows,
    total,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
  };
}
