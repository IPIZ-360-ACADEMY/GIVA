import { readFileSync, writeFileSync } from "fs";

const FILE = "src/utils/i18n.js";
const lines = readFileSync(FILE, "utf8").split("\n");

// Locale last-key positions (1-indexed → 0-indexed)
// ptBR: line 375, ptPT: line 750, en: line 1125
// We insert AFTER each of these (0-based: 374, 749, 1124)

const BLOCKS = {
  "pt-BR": `    "common.close": "Fechar",
    "common.completed": "Concluido",
    "common.noData": "Sem dados",
    "common.reject": "Rejeitar",
    "common.review": "Rever",
    "common.save": "Guardar",
    "classModal.title": "Registar turma",
    "classModal.close": "Fechar",
    "classModal.cancel": "Cancelar",
    "classModal.save": "Guardar turma",
    "classModal.section.data": "Dados da turma",
    "classModal.label.schoolYear": "Ano letivo",
    "classModal.label.course": "Curso",
    "classModal.label.class": "Turma",
    "classModal.label.supervisor": "Supervisor",
    "classModal.label.total": "Total de alunos",
    "classModal.label.avgGrade": "Media da nota",
    "classModal.label.active": "Ativos",
    "classModal.label.monitoring": "Em monitoramento",
    "classModal.label.risk": "Em risco",
    "classModal.toast.required": "Preencha ano letivo, curso e turma.",
    "classModal.toast.stateOverflow": "A soma dos estados nao pode exceder o total.",
    "docModal.titleCreate": "Submeter documento",
    "docModal.titleEdit": "Editar documento",
    "docModal.close": "Fechar",
    "docModal.cancel": "Cancelar",
    "docModal.submit": "Submeter",
    "docModal.update": "Actualizar",
    "docModal.processing": "A processar...",
    "docModal.section.data": "Dados do documento",
    "docModal.label.title": "Titulo",
    "docModal.label.type": "Tipo",
    "docModal.label.version": "Versao",
    "docModal.label.category": "Categoria",
    "docModal.label.fileUrl": "URL do ficheiro",
    "docModal.label.upload": "Carregar ficheiro",
    "docModal.label.description": "Descricao",
    "docModal.fileSelected": "Ficheiro: {name}",
    "studentProfile.personal.title": "Informacao pessoal",
    "studentProfile.personal.email": "Email",
    "studentProfile.personal.phone": "Telefone",
    "studentProfile.personal.address": "Endereco",
    "studentProfile.personal.city": "Cidade",
    "studentProfile.personal.postalCode": "Codigo postal",
    "studentProfile.personal.bio": "Biografia",
    "studentProfile.academic.title": "Informacao academica",
    "studentProfile.academic.trainingArea": "Area de formacao",
    "studentProfile.academic.course": "Curso",
    "studentProfile.academic.status": "Estado",
    "studentProfile.academic.enrolled": "Data de inscricao",
    "studentProfile.professional.title": "Informacao profissional",
    "studentProfile.professional.summary": "Resumo profissional",
    "studentProfile.professional.skills": "Competencias",
    "studentProfile.professional.languages": "Idiomas",
    "studentProfile.professional.portfolioUrl": "Portfolio URL",
    "studentProfile.professional.linkedinUrl": "LinkedIn URL",
    "studentProfile.portfolio.title": "Portfolio",
    "studentProfile.portfolio.type": "Tipo",
    "studentProfile.portfolio.description": "Descricao",
    "studentProfile.portfolio.organization": "Organizacao",
    "studentProfile.portfolio.tags": "Tags",
    "evaluation.export": "Exportar CSV",
    "partners.manageApplications": "Gerir candidaturas",
    "partners.myApplications": "Minhas candidaturas"`,

  "pt-PT": `    "common.close": "Fechar",
    "common.completed": "Concluido",
    "common.noData": "Sem dados",
    "common.reject": "Rejeitar",
    "common.review": "Rever",
    "common.save": "Guardar",
    "classModal.title": "Registar turma",
    "classModal.close": "Fechar",
    "classModal.cancel": "Cancelar",
    "classModal.save": "Guardar turma",
    "classModal.section.data": "Dados da turma",
    "classModal.label.schoolYear": "Ano lectivo",
    "classModal.label.course": "Curso",
    "classModal.label.class": "Turma",
    "classModal.label.supervisor": "Supervisor",
    "classModal.label.total": "Total de alunos",
    "classModal.label.avgGrade": "Media da nota",
    "classModal.label.active": "Activos",
    "classModal.label.monitoring": "Em monitorizacao",
    "classModal.label.risk": "Em risco",
    "classModal.toast.required": "Preencha ano lectivo, curso e turma.",
    "classModal.toast.stateOverflow": "A soma dos estados nao pode exceder o total.",
    "docModal.titleCreate": "Submeter documento",
    "docModal.titleEdit": "Editar documento",
    "docModal.close": "Fechar",
    "docModal.cancel": "Cancelar",
    "docModal.submit": "Submeter",
    "docModal.update": "Actualizar",
    "docModal.processing": "A processar...",
    "docModal.section.data": "Dados do documento",
    "docModal.label.title": "Titulo",
    "docModal.label.type": "Tipo",
    "docModal.label.version": "Versao",
    "docModal.label.category": "Categoria",
    "docModal.label.fileUrl": "URL do ficheiro",
    "docModal.label.upload": "Carregar ficheiro",
    "docModal.label.description": "Descricao",
    "docModal.fileSelected": "Ficheiro: {name}",
    "studentProfile.personal.title": "Informacao pessoal",
    "studentProfile.personal.email": "Email",
    "studentProfile.personal.phone": "Telefone",
    "studentProfile.personal.address": "Endereco",
    "studentProfile.personal.city": "Cidade",
    "studentProfile.personal.postalCode": "Codigo postal",
    "studentProfile.personal.bio": "Biografia",
    "studentProfile.academic.title": "Informacao academica",
    "studentProfile.academic.trainingArea": "Area de formacao",
    "studentProfile.academic.course": "Curso",
    "studentProfile.academic.status": "Estado",
    "studentProfile.academic.enrolled": "Data de inscricao",
    "studentProfile.professional.title": "Informacao profissional",
    "studentProfile.professional.summary": "Resumo profissional",
    "studentProfile.professional.skills": "Competencias",
    "studentProfile.professional.languages": "Idiomas",
    "studentProfile.professional.portfolioUrl": "Portfolio URL",
    "studentProfile.professional.linkedinUrl": "LinkedIn URL",
    "studentProfile.portfolio.title": "Portfolio",
    "studentProfile.portfolio.type": "Tipo",
    "studentProfile.portfolio.description": "Descricao",
    "studentProfile.portfolio.organization": "Organizacao",
    "studentProfile.portfolio.tags": "Tags",
    "evaluation.export": "Exportar CSV",
    "partners.manageApplications": "Gerir candidaturas",
    "partners.myApplications": "As minhas candidaturas"`,

  "en": `    "common.close": "Close",
    "common.completed": "Completed",
    "common.noData": "No data",
    "common.reject": "Reject",
    "common.review": "Review",
    "common.save": "Save",
    "classModal.title": "Register class",
    "classModal.close": "Close",
    "classModal.cancel": "Cancel",
    "classModal.save": "Save class",
    "classModal.section.data": "Class data",
    "classModal.label.schoolYear": "School year",
    "classModal.label.course": "Course",
    "classModal.label.class": "Class",
    "classModal.label.supervisor": "Supervisor",
    "classModal.label.total": "Total students",
    "classModal.label.avgGrade": "Average grade",
    "classModal.label.active": "Active",
    "classModal.label.monitoring": "Monitoring",
    "classModal.label.risk": "At risk",
    "classModal.toast.required": "Fill in school year, course and class.",
    "classModal.toast.stateOverflow": "State totals cannot exceed the total.",
    "docModal.titleCreate": "Submit document",
    "docModal.titleEdit": "Edit document",
    "docModal.close": "Close",
    "docModal.cancel": "Cancel",
    "docModal.submit": "Submit",
    "docModal.update": "Update",
    "docModal.processing": "Processing...",
    "docModal.section.data": "Document data",
    "docModal.label.title": "Title",
    "docModal.label.type": "Type",
    "docModal.label.version": "Version",
    "docModal.label.category": "Category",
    "docModal.label.fileUrl": "File URL",
    "docModal.label.upload": "Upload file",
    "docModal.label.description": "Description",
    "docModal.fileSelected": "File: {name}",
    "studentProfile.personal.title": "Personal information",
    "studentProfile.personal.email": "Email",
    "studentProfile.personal.phone": "Phone",
    "studentProfile.personal.address": "Address",
    "studentProfile.personal.city": "City",
    "studentProfile.personal.postalCode": "Postal code",
    "studentProfile.personal.bio": "Bio",
    "studentProfile.academic.title": "Academic information",
    "studentProfile.academic.trainingArea": "Training area",
    "studentProfile.academic.course": "Course",
    "studentProfile.academic.status": "Status",
    "studentProfile.academic.enrolled": "Enrollment date",
    "studentProfile.professional.title": "Professional information",
    "studentProfile.professional.summary": "Professional summary",
    "studentProfile.professional.skills": "Skills",
    "studentProfile.professional.languages": "Languages",
    "studentProfile.professional.portfolioUrl": "Portfolio URL",
    "studentProfile.professional.linkedinUrl": "LinkedIn URL",
    "studentProfile.portfolio.title": "Portfolio",
    "studentProfile.portfolio.type": "Type",
    "studentProfile.portfolio.description": "Description",
    "studentProfile.portfolio.organization": "Organization",
    "studentProfile.portfolio.tags": "Tags",
    "evaluation.export": "Export CSV",
    "partners.manageApplications": "Manage applications",
    "partners.myApplications": "My applications"`,
};

// Find the last-key line for each locale by searching for "statistics.kpi.accepted"
// (confirmed to be the last key in each locale)
const anchor = '"statistics.kpi.accepted"';
const positions = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes(anchor)) positions.push(i);
}

if (positions.length !== 3) {
  console.error(`Expected 3 anchor positions for '${anchor}', found ${positions.length}`);
  process.exit(1);
}

const [ptBRpos, ptPTpos, enPos] = positions;
const localePositions = [
  { name: "en",    idx: enPos,    block: BLOCKS["en"] },
  { name: "pt-PT", idx: ptPTpos,  block: BLOCKS["pt-PT"] },
  { name: "pt-BR", idx: ptBRpos,  block: BLOCKS["pt-BR"] },
];

// Fix the anchor line to have a trailing comma (if missing), then insert after it
// Process from last to first to keep indices valid
let result = [...lines];

for (const { name, idx, block } of localePositions) {
  // Ensure trailing comma on anchor line
  if (!result[idx].trimEnd().endsWith(",")) {
    result[idx] = result[idx].trimEnd() + ",";
  }
  // Split block into individual lines and insert after anchor
  const newLines = block.split("\n");
  result.splice(idx + 1, 0, ...newLines);
  console.log(`✓ Inserted ${newLines.length} lines after ${name} anchor (0-based line ${idx})`);
}

writeFileSync(FILE, result.join("\n"), "utf8");
console.log(`\nDone. Total lines: ${result.length}`);
