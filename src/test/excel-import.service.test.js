import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  sheetRows: [],
  registerStudentUnifiedMock: vi.fn(),
  createManualClassMock: vi.fn(),
  createTrainingAreaMock: vi.fn(),
  createCourseMock: vi.fn(),
}));

vi.mock("xlsx", () => ({
  read: vi.fn(() => ({
    SheetNames: ["Alunos"],
    Sheets: { Alunos: {} },
  })),
  utils: {
    sheet_to_json: vi.fn(() => hoisted.sheetRows),
  },
}));

vi.mock("../services/studentRegistryService.js", () => ({
  registerStudentUnified: hoisted.registerStudentUnifiedMock,
}));

vi.mock("../services/classesService.js", () => ({
  createManualClass: hoisted.createManualClassMock,
}));

vi.mock("../services/trainingAreaService.js", () => ({
  createTrainingArea: hoisted.createTrainingAreaMock,
  createCourse: hoisted.createCourseMock,
}));

function resolveSelectData(tableName) {
  if (tableName === "training_area") {
    return [{ id: "area-1" }];
  }
  if (tableName === "courses") {
    return [{ id: "course-1" }];
  }
  if (tableName === "manual_classes") {
    return [{ id: "class-1" }];
  }
  return [];
}

function createSupabaseQuery(tableName) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: resolveSelectData(tableName), error: null })),
  };
  return query;
}

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    from: vi.fn((tableName) => createSupabaseQuery(tableName)),
  },
}));

import { importExcelData } from "../services/excelImportService.js";

function buildFakeFile() {
  return {
    arrayBuffer: async () => new ArrayBuffer(8),
  };
}

describe("excelImportService.importExcelData", () => {
  beforeEach(() => {
    hoisted.sheetRows = [];
    hoisted.registerStudentUnifiedMock.mockReset();
    hoisted.createManualClassMock.mockReset();
    hoisted.createTrainingAreaMock.mockReset();
    hoisted.createCourseMock.mockReset();

    hoisted.registerStudentUnifiedMock.mockResolvedValue({
      studentAlreadyExists: false,
      authCreated: true,
      authAlreadyExists: false,
      loginEmail: "aluno.a123@giva.ao",
    });
  });

  it("falha quando falta cabecalho obrigatorio", async () => {
    hoisted.sheetRows = [
      [
        "area_codigo",
        "curso_codigo",
        "curso_nome",
        "turma_nome",
        "processo",
        "nome_completo",
        "email",
        "telefone",
        "data_nascimento",
        "bi",
        "morada",
      ],
      ["INFO", "GDES", "Design", "T01", "A123", "Aluno Teste", "a@test.com", "923", "2000-01-01", "BI", "Rua 1"],
    ];

    await expect(importExcelData(buildFakeFile())).rejects.toThrow(/Cabecalho obrigatorio nao encontrado|Cabeçalho obrigatório não encontrado/i);
  });

  it("ignora processo duplicado no mesmo ficheiro e regista aviso", async () => {
    hoisted.sheetRows = [
      [
        "area_codigo",
        "area_nome",
        "curso_codigo",
        "curso_nome",
        "turma_nome",
        "processo",
        "nome_completo",
        "email",
        "telefone",
        "data_nascimento",
        "bi",
        "morada",
      ],
      ["INFO", "Informatica", "GDES", "Design", "T01", "A123", "Aluno Um", "um@test.com", "923", "2000-01-01", "BI1", "Rua 1"],
      ["INFO", "Informatica", "GDES", "Design", "T01", "A123", "Aluno Dois", "dois@test.com", "924", "2000-02-02", "BI2", "Rua 2"],
    ];

    const result = await importExcelData(buildFakeFile());

    expect(hoisted.registerStudentUnifiedMock).toHaveBeenCalledTimes(1);
    expect(result.studentsRegistered).toBe(1);
    expect(result.warnings.some((entry) => String(entry).includes("duplicado"))).toBe(true);
  });

  it("gera credencial temporaria quando a password nao e fornecida", async () => {
    hoisted.sheetRows = [
      [
        "area_codigo",
        "area_nome",
        "curso_codigo",
        "curso_nome",
        "turma_nome",
        "processo",
        "nome_completo",
        "email",
        "telefone",
        "data_nascimento",
        "bi",
        "morada",
      ],
      ["INFO", "Informatica", "GDES", "Design", "T01", "A123", "Aluno Um", "um@test.com", "923", "2000-01-01", "BI1", "Rua 1"],
    ];

    const result = await importExcelData(buildFakeFile());

    expect(result.generatedCredentials).toHaveLength(1);
    expect(result.generatedCredentials[0].password).toMatch(/^Giva!/);
    expect(hoisted.registerStudentUnifiedMock).toHaveBeenCalledWith(
      expect.objectContaining({ requirePasswordChange: true })
    );
  });

  it("marca aluno como atualizado quando o registo ja existe", async () => {
    hoisted.sheetRows = [
      [
        "area_codigo",
        "area_nome",
        "curso_codigo",
        "curso_nome",
        "turma_nome",
        "processo",
        "nome_completo",
        "email",
        "telefone",
        "data_nascimento",
        "bi",
        "morada",
        "password",
      ],
      ["INFO", "Informatica", "GDES", "Design", "T01", "A123", "Aluno Um", "um@test.com", "923", "2000-01-01", "BI1", "Rua 1", "Senha@123"],
    ];

    hoisted.registerStudentUnifiedMock.mockResolvedValueOnce({
      studentAlreadyExists: true,
      authCreated: false,
      authAlreadyExists: true,
      loginEmail: "aluno.a123@giva.ao",
    });

    const result = await importExcelData(buildFakeFile());

    expect(result.studentsRegistered).toBe(1);
    expect(result.studentsUpdated).toBe(1);
  });

  it("regista erro e nao cria aluno quando email e invalido", async () => {
    hoisted.sheetRows = [
      [
        "area_codigo",
        "area_nome",
        "curso_codigo",
        "curso_nome",
        "turma_nome",
        "processo",
        "nome_completo",
        "email",
        "telefone",
        "data_nascimento",
        "bi",
        "morada",
      ],
      ["INFO", "Informatica", "GDES", "Design", "T01", "A123", "Aluno Um", "email-invalido", "923", "2000-01-01", "BI1", "Rua 1"],
    ];

    const result = await importExcelData(buildFakeFile());

    expect(result.errors.some((entry) => String(entry).includes("Email inválido"))).toBe(true);
    expect(hoisted.registerStudentUnifiedMock).not.toHaveBeenCalled();
  });

  it("regista erro quando password fornecida e curta", async () => {
    hoisted.sheetRows = [
      [
        "area_codigo",
        "area_nome",
        "curso_codigo",
        "curso_nome",
        "turma_nome",
        "processo",
        "nome_completo",
        "email",
        "telefone",
        "data_nascimento",
        "bi",
        "morada",
        "password",
      ],
      ["INFO", "Informatica", "GDES", "Design", "T01", "A123", "Aluno Um", "um@test.com", "923", "2000-01-01", "BI1", "Rua 1", "123"],
    ];

    const result = await importExcelData(buildFakeFile());

    expect(result.errors.some((entry) => String(entry).includes("pelo menos 8 caracteres"))).toBe(true);
    expect(hoisted.registerStudentUnifiedMock).not.toHaveBeenCalled();
  });

  it("falha quando excede o limite maximo de linhas", async () => {
    const header = [
      "area_codigo",
      "area_nome",
      "curso_codigo",
      "curso_nome",
      "turma_nome",
      "processo",
      "nome_completo",
      "email",
      "telefone",
      "data_nascimento",
      "bi",
      "morada",
    ];

    const bigRows = Array.from({ length: 5001 }, (_, index) => [
      "INFO",
      "Informatica",
      "GDES",
      "Design",
      "T01",
      `A${1000 + index}`,
      `Aluno ${index + 1}`,
      `aluno${index + 1}@test.com`,
      "923",
      "2000-01-01",
      "BI1",
      "Rua 1",
    ]);

    hoisted.sheetRows = [header, ...bigRows];

    await expect(importExcelData(buildFakeFile())).rejects.toThrow(/limite máximo de 5000 linhas/i);
    expect(hoisted.registerStudentUnifiedMock).not.toHaveBeenCalled();
  });
});
