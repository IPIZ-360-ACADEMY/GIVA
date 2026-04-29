// scripts/generate-report.mjs
// Gera o relatório técnico GIVA IPIZ em formato .docx
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, Header, Footer,
  PageNumber, convertInchesToTwip,
  UnderlineType
} from "docx";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../TCC - Documentos e Outros/GIVA_IPIZ_Relatorio_Tecnico.docx");

// ── Helpers de estilo ──────────────────────────────────────────────────────────
const PRIMARY = "1D4ED8";   // azul
const ACCENT  = "7C3AED";   // roxo
const DARK    = "1E293B";
const MUTED   = "64748B";
const GREEN   = "059669";
const RED     = "DC2626";
const YELLOW  = "D97706";
const BORDER_COLOR = "CBD5E1";

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 480, after: 200 },
    border: { bottom: { color: PRIMARY, size: 8, style: BorderStyle.SINGLE, space: 6 } },
    run: { bold: true, color: PRIMARY, size: 56, font: "Calibri" },
    thematicBreak: false,
  });
}

function h2(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: PRIMARY, size: 40, font: "Calibri" })],
    spacing: { before: 360, after: 120 },
  });
}

function h3(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, color: DARK, size: 28, font: "Calibri" })],
    spacing: { before: 280, after: 100 },
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 24, font: "Calibri", color: DARK, ...opts })],
    spacing: { before: 80, after: 80 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 24, font: "Calibri", color: DARK })],
    bullet: { level },
    spacing: { before: 60, after: 60 },
  });
}

function bold(text) { return new TextRun({ text, bold: true, size: 24, font: "Calibri", color: PRIMARY }); }

function code(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Courier New", size: 20, color: "1E40AF" })],
    shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
    spacing: { before: 100, after: 100 },
    indent: { left: 360 },
    border: {
      left: { color: PRIMARY, size: 12, style: BorderStyle.SINGLE, space: 8 }
    },
  });
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () =>
    new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 0, after: 0 } })
  );
}

function divider() {
  return new Paragraph({
    text: "",
    border: { bottom: { color: BORDER_COLOR, size: 4, style: BorderStyle.SINGLE, space: 4 } },
    spacing: { before: 200, after: 200 },
  });
}

function infoBox(text, color = "EFF6FF", borderColor = PRIMARY) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Calibri", color: DARK, italics: true })],
    shading: { type: ShadingType.CLEAR, fill: color },
    spacing: { before: 120, after: 120 },
    indent: { left: 360, right: 360 },
    border: {
      left: { color: borderColor, size: 16, style: BorderStyle.SINGLE, space: 8 },
      top: { color: borderColor, size: 4, style: BorderStyle.SINGLE },
      bottom: { color: borderColor, size: 4, style: BorderStyle.SINGLE },
      right: { color: BORDER_COLOR, size: 4, style: BorderStyle.SINGLE },
    },
  });
}

// Tabela simples com cabeçalho
function makeTable(headers, rows) {
  const headerCells = headers.map(h =>
    new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 22, font: "Calibri" })],
        alignment: AlignmentType.CENTER,
      })],
      shading: { type: ShadingType.CLEAR, fill: PRIMARY },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
    })
  );

  const dataRows = rows.map((row, ri) =>
    new TableRow({
      children: row.map(cell =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: cell, size: 22, font: "Calibri", color: DARK })],
            alignment: AlignmentType.LEFT,
          })],
          shading: { type: ShadingType.CLEAR, fill: ri % 2 === 0 ? "F8FAFC" : "FFFFFF" },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
        })
      ),
    })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: headerCells, tableHeader: true }),
      ...dataRows,
    ],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });
}

// ── Cover section ──────────────────────────────────────────────────────────────
function coverSection() {
  return [
    ...spacer(4),
    new Paragraph({
      children: [new TextRun({ text: "GIVA IPIZ", bold: true, size: 96, font: "Calibri", color: PRIMARY })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 160 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Relatório Técnico de Desenvolvimento", size: 44, font: "Calibri", color: MUTED })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Plataforma de Gestão Integrada de Vagas e Alunos", size: 28, font: "Calibri", color: DARK, italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 480 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "─────────────────────────────────────────", color: BORDER_COLOR, size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 480 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "IPIZ — Instituto Pré-Universitário Industrial do Zango", bold: true, size: 28, font: "Calibri", color: DARK })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "Luanda, Angola  ·  Abril de 2026", size: 24, font: "Calibri", color: MUTED })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: "givasistem.vercel.app", size: 24, font: "Calibri", color: PRIMARY, underline: { type: UnderlineType.SINGLE } })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 0 },
    }),
    ...spacer(2),
    divider(),
    infoBox("Este documento foi preparado para pessoas que estão a iniciar a sua jornada técnica em Engenharia de Software. Cada conceito é explicado de forma acessível, com exemplos reais do código produzido.", "EFF6FF", PRIMARY),
    divider(),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 1 — Ferramentas ─────────────────────────────────────────────────────
function parte1() {
  return [
    h1("Parte 1 — As Ferramentas e Tecnologias Usadas"),
    p("Antes de falar do projecto em si, é essencial entender cada ferramenta utilizada e a razão pela qual foi escolhida. Cada ferramenta resolve um problema específico, e a combinação delas forma o que chamamos de stack tecnológica."),
    ...spacer(1),

    h2("React 18"),
    infoBox("Conceito fundamental: Uma biblioteca para construir interfaces de utilizador de forma declarativa e baseada em componentes.", "EFF6FF", PRIMARY),
    p("React é uma biblioteca JavaScript criada pelo Facebook (Meta) que revolucionou a forma como se constroem interfaces web. A ideia central é simples: em vez de manipular o HTML directamente, descreve-se como a interface deve parecer em cada estado, e o React trata de actualizar apenas o que mudou."),
    p("O conceito chave é o de Componente — um pedaço reutilizável de interface. Por exemplo, o botão que aparece em todas as páginas é escrito uma única vez e reutilizado em todo o lado. Se o design do botão precisar de ser alterado, altera-se num único ficheiro e muda em todo o sistema."),
    bullet("Versão usada: React 18"),
    bullet("Característica principal usada: Hooks (useState, useEffect, useMemo, useCallback)"),
    bullet("useEffect: executa código quando o componente aparece ou quando dados mudam"),
    bullet("useState: guarda e actualiza dados que mudam ao longo do tempo"),
    bullet("useMemo: calcula valores complexos apenas quando necessário, optimizando performance"),
    ...spacer(1),

    h2("Vite 5"),
    infoBox("Conceito fundamental: Ferramenta de build — transforma código moderno em algo que o browser consegue executar.", "EFF6FF", PRIMARY),
    p("Quando se escreve código React, usa-se sintaxe JSX (HTML dentro de JavaScript) e módulos ES moderns. O browser não consegue executar isto directamente — precisa de ser transformado. O Vite é a ferramenta que faz esta transformação, e faz-o de forma extremamente rápida."),
    p("Em desenvolvimento, o Vite usa o servidor de desenvolvimento com Hot Module Replacement (HMR) — quando se guarda um ficheiro, a alteração aparece no browser em milissegundos sem recarregar a página."),
    bullet("Build de produção: 142 módulos transformados em 20.65 segundos"),
    bullet("Output: ficheiros optimizados e comprimidos (gzip) para carregamento rápido"),
    ...spacer(1),

    h2("Supabase"),
    infoBox("Conceito fundamental: Backend como Serviço (BaaS) — fornece base de dados, autenticação e mais, sem precisar de construir um servidor.", "EFF6FF", PRIMARY),
    p("Supabase é uma plataforma open-source que fornece toda a infraestrutura de backend necessária. Em vez de construir um servidor Node.js, uma API REST, e gerir uma base de dados do zero, o Supabase oferece tudo pronto a usar."),
    p("Componentes do Supabase usados no GIVA:"),
    bullet("PostgreSQL: base de dados relacional com mais de 20 tabelas. Relacional significa que os dados estão organizados em tabelas com relações entre elas — por exemplo, um aluno tem muitas candidaturas."),
    bullet("Auth: sistema completo de autenticação. Suporta email/password, Google OAuth e LinkedIn OAuth."),
    bullet("Storage: armazenamento de ficheiros (fotos de perfil, documentos). Funciona como um Google Drive programático."),
    bullet("Realtime: comunicação em tempo real via WebSockets. Usado no chat — quando alguém envia uma mensagem, aparece instantaneamente sem precisar de recarregar a página."),
    bullet("Row Level Security (RLS): sistema de permissões ao nível da base de dados. Cada utilizador só consegue ver os seus próprios dados, mesmo que tente aceder directamente à API."),
    ...spacer(1),

    h2("Vercel"),
    infoBox("Conceito fundamental: Plataforma de Deploy — coloca a aplicação online automaticamente a cada push no GitHub.", "EFF6FF", PRIMARY),
    p("Vercel é a plataforma de hospedagem que serve a aplicação GIVA para o mundo. O processo é totalmente automático: quando se faz git push para o GitHub, o Vercel detecta a alteração, compila o código e coloca o novo código online em menos de 2 minutos."),
    bullet("URL de produção: https://givasistem.vercel.app"),
    bullet("CDN global: o código é distribuído por servidores em todo o mundo para carregamento rápido"),
    bullet("Variáveis de ambiente: credenciais sensíveis são guardadas no Vercel e não no código"),
    ...spacer(1),

    h2("Git e GitHub"),
    infoBox("Conceito fundamental: Controlo de versões — guarda o histórico completo de todas as alterações ao código.", "EFF6FF", PRIMARY),
    p("Git é o sistema de controlo de versões mais usado no mundo. Imagine que é um sistema de guardar que regista não apenas o estado actual dos ficheiros, mas toda a história de como chegaram ao estado actual — quem alterou, quando, e porquê."),
    p("Cada conjunto de alterações é guardado com um commit, que tem uma mensagem descritiva. Alguns commits do projecto GIVA:"),
    code("f4cf81c  Feat: ToolsPage (sistema RH), TopProgressBar, feed moderno, fotos de perfil"),
    code("14b50e8  Fix: OAuth redirectTo usa VITE_APP_URL para evitar redirect para localhost"),
    code("bcc7674  Feat: notificacao de audio ao receber mensagem"),
    ...spacer(1),

    h2("CSS Custom Properties e Design System"),
    infoBox("Conceito fundamental: Variáveis CSS — definem o 'tema' visual do sistema num único lugar.", "EFF6FF", PRIMARY),
    p("Em vez de escrever a mesma cor (#1D4ED8) em 500 sítios diferentes no CSS, define-se uma variável e usa-se em todo o lado. Mudar o tema inteiro passa a ser alterar poucas linhas."),
    code("--primary: #1D4ED8;    /* Azul principal */"),
    code("--bg-elevated: #FFFFFF; /* Fundo de cards */"),
    code("--border: #E2E8F0;     /* Bordas */"),
    code("--shadow-md: 0 4px 12px rgba(0,0,0,0.08); /* Sombra */"),
    p("O GIVA tem um sistema de cores completo com modo escuro. Quando o utilizador activa o dark mode, apenas o atributo data-theme no HTML muda de 'light' para 'dark', e as variáveis CSS assumem automaticamente os valores escuros."),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 2 — Arquitectura ────────────────────────────────────────────────────
function parte2() {
  return [
    h1("Parte 2 — Arquitectura do Sistema"),
    infoBox("A arquitectura é o 'plano da casa' antes de construir. Define como os diferentes componentes se relacionam e quais são as suas responsabilidades.", "FFFBEB", YELLOW),
    ...spacer(1),

    h2("Domain-Driven Design (DDD)"),
    p("DDD é uma abordagem de design de software onde se organiza o código em torno dos domínios de negócio — as áreas principais do problema que se está a resolver. Para o GIVA, os domínios são:"),
    bullet("Identidade e Acesso — quem pode fazer o quê"),
    bullet("Estrutura Académica — áreas, cursos, turmas"),
    bullet("Ciclo de Vida do Aluno — matrícula, estágio, contrato"),
    bullet("Gestão de Estágios — candidaturas, vagas, empresas"),
    bullet("Documentos — upload, download, aprovação"),
    bullet("Notificações — sistema de avisos em tempo real"),
    bullet("Auditoria — registo imutável de todas as acções"),
    ...spacer(1),

    h2("Multi-Tenant Lógico por Área Académica"),
    p("O IPIZ tem 4 áreas académicas: TI (Tecnologia de Informação), EIE (Electrónica e Instrumentação), MECA (Mecânica) e TLQB (Tecnologia de Laboratório Químico e Biológico)."),
    p("Multi-tenant significa que o mesmo sistema serve múltiplos 'inquilinos' (neste caso, áreas académicas) sem que os dados se misturem. Cada registo na base de dados tem um campo area_id que indica a que área pertence."),
    infoBox("Analogia: Imagine um prédio de apartamentos (o GIVA) onde cada apartamento (área académica) tem a sua própria chave. Os moradores só acedem ao seu apartamento.", "EFF6FF", PRIMARY),
    ...spacer(1),

    h2("Sistema de Papéis (RBAC)"),
    p("RBAC significa Role-Based Access Control — Controlo de Acesso Baseado em Papéis. Em vez de definir permissões para cada utilizador individualmente, define-se permissões por papel (role) e atribui-se o papel ao utilizador."),
    makeTable(
      ["Papel", "Descrição", "Exemplos de Acesso"],
      [
        ["SUPER_ADMIN", "Acesso total a tudo no sistema", "Ver todos os dados, gerir utilizadores"],
        ["ADMIN_1", "Gatekeeper de acções sensíveis", "Página de Ferramentas, aprovar empresas"],
        ["ADMIN_2", "Coordenador por área académica", "Gerir alunos da sua área"],
        ["STUDENT", "Aluno da instituição", "Ver e editar o seu próprio perfil"],
        ["COMPANY", "Empresa parceira", "Gerir candidaturas recebidas"],
      ]
    ),
    ...spacer(1),

    h2("Approval Flow — Fluxo de Aprovação"),
    p("Para operações críticas (ex: eliminar um aluno do sistema), existe um fluxo de aprovação que previne erros graves:"),
    bullet("1. Admin2 solicita a acção"),
    bullet("2. O sistema cria um registo approval_request com snapshot do estado antes da alteração"),
    bullet("3. Admin1 (ou SUPER_ADMIN) aprova ou rejeita"),
    bullet("4. Só após aprovação a acção é executada"),
    infoBox("Porquê isto é importante: Previne que um erro de um administrador júnior seja irreversível. Há sempre um segundo par de olhos.", "FFF7ED", YELLOW),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 3 — Base de Dados ───────────────────────────────────────────────────
function parte3() {
  return [
    h1("Parte 3 — Fase 0: A Fundação da Base de Dados"),
    p("A primeira fase foi puramente de base de dados — sem código React ainda. Foi escrito SQL (Structured Query Language) para criar as tabelas, relações e regras de segurança."),
    infoBox("SQL é a linguagem universal para comunicar com bases de dados relacionais. É usada há mais de 40 anos e continua a ser uma das competências mais valorizadas em Engenharia de Software.", "EFF6FF", PRIMARY),
    ...spacer(1),

    h2("Criação de Tabelas"),
    p("Cada tabela representa uma entidade do sistema. Exemplo da tabela de alunos:"),
    code("CREATE TABLE public.students ("),
    code("  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),"),
    code("  full_name        text NOT NULL,"),
    code("  email            text,"),
    code("  process_number   varchar(32) UNIQUE,"),
    code("  training_area_id uuid REFERENCES public.training_area(id),"),
    code("  status           text DEFAULT 'ACTIVE',"),
    code("  created_at       timestamptz DEFAULT now()"),
    code(");"),
    p("Conceitos presentes neste exemplo:"),
    bullet("PRIMARY KEY: identificador único de cada registo (como o BI de uma pessoa)"),
    bullet("gen_random_uuid(): função que gera um ID único automaticamente"),
    bullet("NOT NULL: este campo é obrigatório"),
    bullet("UNIQUE: dois registos não podem ter o mesmo valor neste campo"),
    bullet("REFERENCES: cria uma relação com outra tabela (Foreign Key)"),
    bullet("DEFAULT: valor automático quando não se especifica"),
    ...spacer(1),

    h2("Tabelas Criadas no Sistema"),
    makeTable(
      ["Tabela", "O que guarda"],
      [
        ["training_area", "Áreas académicas: TI, EIE, MECA, TLQB"],
        ["courses", "Cursos dentro de cada área"],
        ["students", "Dados administrativos dos alunos"],
        ["student_portfolio", "Projectos, certificações e prémios dos alunos"],
        ["internships", "Registos de estágios"],
        ["internship_vacancies", "Vagas abertas em empresas"],
        ["internship_assignments", "Atribuição de alunos a vagas"],
        ["job_applications", "Candidaturas de alunos a empresas"],
        ["company_progress", "Progresso do aluno em cada empresa (6 fases)"],
        ["evaluations", "Avaliações individuais e de grupo"],
        ["partners", "Empresas parceiras do IPIZ"],
        ["classes", "Turmas (ex: 11-TI-A)"],
        ["user_profiles", "Perfis de todos os utilizadores"],
        ["messages", "Mensagens do chat"],
        ["notifications", "Notificações do sistema"],
        ["read_receipts", "Confirmações de leitura de mensagens"],
      ]
    ),
    ...spacer(1),

    h2("Triggers SQL — Automação na Base de Dados"),
    p("Um trigger é uma função que corre automaticamente quando um evento ocorre na base de dados. Exemplo: quando um utilizador faz login com Google pela primeira vez, é necessário criar o seu perfil na tabela user_profiles. Em vez de fazer isto no código JavaScript, um trigger faz-o automaticamente:"),
    code("CREATE OR REPLACE FUNCTION public.handle_new_user_oauth()"),
    code("RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$"),
    code("BEGIN"),
    code("  -- Verifica se perfil já existe"),
    code("  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN"),
    code("    RETURN NEW;"),
    code("  END IF;"),
    code("  -- Cria perfil automaticamente"),
    code("  INSERT INTO public.user_profiles (id, display_name, avatar_url)"),
    code("  VALUES (NEW.id,"),
    code("     COALESCE(NEW.raw_user_meta_data->>'full_name', 'Utilizador'),"),
    code("     NEW.raw_user_meta_data->>'avatar_url');"),
    code("  RETURN NEW;"),
    code("END; $$;"),
    ...spacer(1),

    h2("Row Level Security (RLS) — Segurança ao Nível dos Dados"),
    p("RLS é um mecanismo do PostgreSQL que garante que cada utilizador só vê e altera os seus próprios dados, independentemente de como a query foi feita. Mesmo que um programador esqueça de filtrar os dados no código, o RLS garante que os dados errados nunca chegam ao utilizador."),
    code("-- Política: aluno só vê as suas próprias candidaturas"),
    code("CREATE POLICY \"student_own_applications\""),
    code("ON public.job_applications FOR SELECT"),
    code("USING (student_id = auth.uid());"),
    code("-- auth.uid() é o ID do utilizador autenticado"),
    infoBox("Segurança em profundidade: Esta é uma prática fundamental de segurança — ter múltiplas camadas de protecção. O código React faz validações, a API do Supabase verifica autenticação, e o RLS garante isolamento de dados.", "FEF2F2", RED),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 4 — Fase 1 ─────────────────────────────────────────────────────────
function parte4() {
  return [
    h1("Parte 4 — Fase 1: Os Primeiros Componentes React"),
    p("Com a base de dados preparada, começou a construção da interface. A primeira decisão foi criar uma camada de serviços — uma separação clara entre o código que comunica com o Supabase e o código que desenha a interface."),
    ...spacer(1),

    h2("Padrão de Serviços — Separação de Responsabilidades"),
    p("Em vez de ter código de base de dados misturado com código de interface, criou-se uma pasta services com ficheiros dedicados a cada domínio. Este padrão chama-se Separation of Concerns (Separação de Responsabilidades)."),
    code("// Exemplo: trainingAreaService.js"),
    code("import { supabase } from '../lib/supabase.js';"),
    code(""),
    code("export async function listTrainingAreas() {"),
    code("  const { data, error } = await supabase"),
    code("    .from('training_area')"),
    code("    .select('*')"),
    code("    .order('name');"),
    code("  if (error) throw error;"),
    code("  return data;"),
    code("}"),
    p("Este padrão traz vantagens:"),
    bullet("Testabilidade: é fácil testar a lógica de dados sem precisar de renderizar componentes"),
    bullet("Reutilização: qualquer página pode usar listTrainingAreas() sem duplicar código"),
    bullet("Manutenção: se o Supabase mudar de nome de tabela, altera-se apenas num ficheiro"),
    ...spacer(1),

    h2("Serviços Criados"),
    makeTable(
      ["Ficheiro", "Responsabilidade"],
      [
        ["trainingAreaService.js", "CRUD de áreas de formação e cursos"],
        ["jobApplicationService.js", "Candidaturas: criar, aceitar, rejeitar, retirar"],
        ["companyProgressService.js", "Rastreamento das 6 fases de progresso na empresa"],
        ["studentProfileService.js", "Perfil completo do aluno + upload de fotos"],
        ["evaluationService.js", "Avaliações individuais e de grupo + exportação CSV"],
        ["postsService.js", "Feed de publicações: criar, reagir, comentar"],
        ["chatService.js", "Mensagens em tempo real + read receipts"],
        ["notificationsService.js", "Criar e marcar notificações como lidas"],
        ["classesService.js", "Gestão de turmas"],
        ["internshipsService.js", "Registos de estágios e normalização de dados"],
      ]
    ),
    ...spacer(1),

    h2("Bug #1 — Palavra Reservada `eval`"),
    infoBox("Bug: Erro de compilação — o código recusava-se a ser transformado pelo Vite.", "FEF2F2", RED),
    p("Num dos serviços de avaliações, foi usada uma variável chamada eval. Em JavaScript moderno com strict mode activado, eval é uma palavra reservada do sistema — é uma função nativa que executa código JavaScript em tempo de execução. Usá-la como nome de variável causa um erro de sintaxe."),
    code("// ERRADO — causa SyntaxError:"),
    code("const eval = await supabase.from('evaluations').select('*');"),
    code(""),
    code("// CORRECTO:"),
    code("const evaluation_item = await supabase.from('evaluations').select('*');"),
    infoBox("Lição aprendida: Nunca usar como nomes de variáveis palavras reservadas do JavaScript: eval, arguments, class, return, function, new, this, super, etc.", "FFFBEB", YELLOW),
    ...spacer(1),

    h2("Bug #2 — Import Errado do AuthContext"),
    infoBox("Bug: Componentes não detectavam mudanças no estado de autenticação.", "FEF2F2", RED),
    p("O AuthContext era importado e usado directamente em vários componentes, em vez de usar o hook useAuth() que encapsula a lógica. A diferença é subtil mas importante:"),
    code("// ERRADO: importar Context directamente"),
    code("import AuthContext from '../contexts/AuthContext.jsx';"),
    code("const { user } = useContext(AuthContext);"),
    code(""),
    code("// CORRECTO: usar o hook encapsulado"),
    code("import { useAuth } from '../contexts/AuthContext.jsx';"),
    code("const { user, authProfile } = useAuth();"),
    p("O hook useAuth() trata internamente da subscrição a mudanças de autenticação. Quando o utilizador faz login ou logout, qualquer componente que use useAuth() é automaticamente notificado e re-renderizado."),
    ...spacer(1),

    h2("Componentes Avançados Criados"),
    h3("CompanyProgressTimeline.jsx — Timeline de Progresso"),
    p("Uma linha do tempo visual de 5 fases do processo de estágio. Cada fase tem um 'ponto' (dot) que pode estar em 3 estados:"),
    bullet("Cinzento: fase não iniciada"),
    bullet("Amarelo: fase em curso"),
    bullet("Verde: fase concluída"),
    p("A timeline tem 5 fases: Candidatura → Entrevista → Admissão → Estágio → Contrato. Ao clicar em qualquer fase, abre um painel lateral para editar datas, notas e resultados."),
    ...spacer(1),
    h3("ExpandedStudentProfile.jsx — Perfil Completo do Aluno"),
    p("Perfil completo com 4 tabs navegáveis:"),
    bullet("Pessoal: nome, email, telefone, endereço, foto de perfil"),
    bullet("Académico: área de formação, curso, status de matrícula"),
    bullet("Profissional: resumo, competências, idiomas, links LinkedIn/portfolio"),
    bullet("Portfolio: cards de projectos, certificações e prémios com tags coloridas"),
    p("A foto de perfil suporta upload por clique ou drag-and-drop — o ficheiro é enviado para o Supabase Storage e o URL público é guardado no perfil."),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 5 — Fase 2 ─────────────────────────────────────────────────────────
function parte5() {
  return [
    h1("Parte 5 — Fase 2.1: Sistema de Candidaturas"),
    p("Com os componentes base criados, foi implementado o fluxo central do sistema: candidaturas de alunos a estágios em empresas parceiras, e o painel de gestão para que as empresas possam rever essas candidaturas."),
    makeTable(
      ["Métricas desta fase", "Valor"],
      [
        ["Data de conclusão", "3 de Abril de 2026"],
        ["Duração", "~45 minutos"],
        ["Linhas de código adicionadas", "~220"],
        ["Ficheiros modificados", "1 (PartnersPage.jsx)"],
        ["Novos estados React", "7"],
        ["Novos hooks useEffect", "2"],
        ["Build final", "125 módulos, 0 erros"],
      ]
    ),
    ...spacer(1),

    h2("Fluxo do Aluno — Candidatura"),
    p("O aluno acede à página de Parceiros, vê as empresas disponíveis com vagas abertas e clica em 'Candidatar-se'. Abre um modal de confirmação. Após confirmar, o estado da candidatura muda para PENDING e o botão reflecte esse estado."),
    p("Sistema anti-duplicação:"),
    code("// Verifica se já existe candidatura antes de mostrar botão"),
    code("const existingApp = studentApplications.find("),
    code("  app => app.partner_id === partner.id"),
    code(");"),
    code("const canApply = !existingApp &&"),
    code("                 partner.vagas_abertas > 0;"),
    ...spacer(1),

    h2("Fluxo da Empresa — Revisão de Candidaturas"),
    p("O ADMIN_1 vê um painel com todas as candidaturas recebidas, filtráveis por estado (Pendente, Aceite, Rejeitada, Retirada). Ao clicar em Rever, abre um modal com os dados do aluno e botões de Aceitar/Rejeitar."),
    p("Estados das candidaturas:"),
    bullet("PENDING: aguarda revisão da empresa"),
    bullet("ACCEPTED: candidatura aceite — aluno inicia estágio"),
    bullet("REJECTED: candidatura recusada — empresa fornece motivo"),
    bullet("WITHDRAWN: aluno retirou a candidatura"),
    ...spacer(1),

    h2("RPC — Remote Procedure Call"),
    p("Quando uma candidatura é aceite, o contador de vagas preenchidas precisa de decrementar. Em vez de fazer um UPDATE directo do browser (inseguro e sujeito a race conditions), usa-se uma função SQL no servidor:"),
    code("-- Função no Supabase (corre no servidor com permissões elevadas)"),
    code("CREATE FUNCTION increment_vagas_preenchidas(partner_id uuid)"),
    code("RETURNS void AS $$"),
    code("BEGIN"),
    code("  UPDATE public.partners"),
    code("  SET vagas_preenchidas = vagas_preenchidas + 1"),
    code("  WHERE id = partner_id;"),
    code("END; $$ LANGUAGE plpgsql SECURITY DEFINER;"),
    code(""),
    code("-- Chamada do JavaScript (browser)"),
    code("await supabase.rpc('increment_vagas_preenchidas', { partner_id: id });"),
    infoBox("Race condition: Quando dois eventos ocorrem simultaneamente e o resultado depende da ordem. Exemplo: dois alunos candidatam-se à última vaga ao mesmo tempo. A RPC usa transacções atómicas do PostgreSQL para garantir consistência.", "FFFBEB", YELLOW),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 6 — QA ─────────────────────────────────────────────────────────────
function parte6() {
  return [
    h1("Parte 6 — QA: Garantia de Qualidade"),
    p("Antes de considerar qualquer fase concluída, foi feita uma revisão de qualidade formal. QA (Quality Assurance) é o processo de verificar se o software funciona correctamente em todos os cenários esperados."),
    ...spacer(1),

    h2("Testes por Viewport"),
    p("Viewport é o tamanho visível do browser. O mesmo website precisa de funcionar bem em telemóveis de 320px de largura e em monitores de 1440px. Testaram-se 6 tamanhos:"),
    makeTable(
      ["Dispositivo", "Tamanho", "Resultado", "Observações"],
      [
        ["iPhone SE (mais antigo)", "320×568 px", "✅ Aprovado", "2 refinamentos P2 menores"],
        ["iPhone 12", "390×844 px", "✅ Aprovado", "1 refinamento P2"],
        ["iPhone XR", "414×896 px", "✅ Aprovado", "1 refinamento P2"],
        ["iPad", "768×1024 px", "✅ Aprovado", "1 refinamento P2"],
        ["Laptop", "1280×800 px", "✅ Aprovado", "1 refinamento P2"],
        ["Desktop HD", "1440×900 px", "✅ Aprovado", "1 refinamento P2"],
      ]
    ),
    ...spacer(1),

    h2("Classificação de Defeitos"),
    makeTable(
      ["Classificação", "Definição", "Exemplo", "Acção"],
      [
        ["P0 — Bloqueante", "Utilizador não consegue usar a funcionalidade", "Botão invisível, texto cortado, página em branco", "Corrigir imediatamente"],
        ["P1 — Visível", "Defeito visual notável mas não bloqueante", "Espaçamento errado, alinhamento desviado", "Corrigir antes do deploy"],
        ["P2 — Refinamento", "Pequena diferença estética", "Padding 8px em vez de 10px", "Corrigir na mesma sessão se possível"],
      ]
    ),
    p("Resultado final do QA: Zero P0, Zero P1. Apenas 6 refinamentos P2, todos corrigidos."),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 7 — Bugs de Produção ────────────────────────────────────────────────
function parte7() {
  return [
    h1("Parte 7 — Bugs de Produção"),
    infoBox("Importante: Bugs que não aparecem em desenvolvimento local frequentemente surgem em produção. O ambiente de desenvolvimento tem mais tolerância a erros. Isto é normal e esperado.", "FFFBEB", YELLOW),
    ...spacer(1),

    h2("Bug #3 — Ausência de ErrorBoundary"),
    new Paragraph({
      children: [
        new TextRun({ text: "Sintoma: ", bold: true, color: RED, size: 24, font: "Calibri" }),
        new TextRun({ text: "Página em branco completa quando ocorria qualquer erro num componente.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Causa: ", bold: true, color: YELLOW, size: 24, font: "Calibri" }),
        new TextRun({ text: "React desmonta toda a árvore de componentes quando ocorre um erro não tratado.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Solução: ", bold: true, color: GREEN, size: 24, font: "Calibri" }),
        new TextRun({ text: "Criar um componente ErrorBoundary que captura erros e mostra mensagem amigável.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    code("class ErrorBoundary extends React.Component {"),
    code("  state = { hasError: false, error: null };"),
    code(""),
    code("  static getDerivedStateFromError(error) {"),
    code("    return { hasError: true, error };"),
    code("  }"),
    code(""),
    code("  render() {"),
    code("    if (this.state.hasError) {"),
    code("      return <div>Algo correu mal. Tenta recarregar a página.</div>;"),
    code("    }"),
    code("    return this.props.children;"),
    code("  }"),
    code("}"),
    ...spacer(1),

    h2("Bug #4 — Canais Realtime Duplicados no Chat"),
    new Paragraph({
      children: [
        new TextRun({ text: "Sintoma: ", bold: true, color: RED, size: 24, font: "Calibri" }),
        new TextRun({ text: "Cada mensagem no chat aparecia 3 a 4 vezes.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Causa: ", bold: true, color: YELLOW, size: 24, font: "Calibri" }),
        new TextRun({ text: "O useEffect que cria a subscrição WebSocket era chamado múltiplas vezes sem fechar a subscrição anterior.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    code("// ERRADO: sem cleanup"),
    code("useEffect(() => {"),
    code("  const unsub = subscribeToMessages(channel, onMessage);"),
    code("  // ← Falta retornar função de cleanup!"),
    code("}, [channel]);"),
    code(""),
    code("// CORRECTO: com cleanup"),
    code("useEffect(() => {"),
    code("  const unsub = subscribeToMessages(channel, onMessage);"),
    code("  return () => unsub(); // ← Fecha conexão quando componente desmonta"),
    code("}, [channel]);"),
    infoBox("Conceito: O useEffect aceita opcionalmente uma função de retorno (cleanup function). Esta função é chamada quando o componente é desmontado ou quando as dependências do useEffect mudam. É aqui que se devem fechar conexões, cancelar timers e limpar subscrições.", "EFF6FF", PRIMARY),
    ...spacer(1),

    h2("Bug #5 — Race Condition no Login"),
    new Paragraph({
      children: [
        new TextRun({ text: "Sintoma: ", bold: true, color: RED, size: 24, font: "Calibri" }),
        new TextRun({ text: "Após login, o utilizador era redirecionado para a página errada ou tratado como sem permissões.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Causa: ", bold: true, color: YELLOW, size: 24, font: "Calibri" }),
        new TextRun({ text: "O código lia o authProfile (papel do utilizador) antes do Supabase terminar de o carregar da base de dados.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    code("// ERRADO: usa profile antes de ter certeza que carregou"),
    code("if (authProfile.role === 'ADMIN_1') navigate('/admin');"),
    code(""),
    code("// CORRECTO: aguardar loading antes de decisões"),
    code("if (authLoading) return <Spinner />;"),
    code("if (authProfile?.role === 'ADMIN_1') navigate('/admin');"),
    ...spacer(1),

    h2("Bug #6 — AudioContext e Política de Autoplay do Browser"),
    new Paragraph({
      children: [
        new TextRun({ text: "Sintoma: ", bold: true, color: RED, size: 24, font: "Calibri" }),
        new TextRun({ text: "Notificação de som no chat não funcionava, dava erro silencioso na consola.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Causa: ", bold: true, color: YELLOW, size: 24, font: "Calibri" }),
        new TextRun({ text: "Browsers modernos bloqueiam som automático antes de o utilizador interagir com a página (política anti-spam de autoplay).", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Solução: ", bold: true, color: GREEN, size: 24, font: "Calibri" }),
        new TextRun({ text: "Padrão Singleton — criar o AudioContext apenas após o primeiro click do utilizador, e reutilizá-lo.", size: 24, font: "Calibri", color: DARK }),
      ],
      spacing: { before: 80, after: 80 },
    }),
    code("let _audioCtx = null; // Singleton"),
    code(""),
    code("function getAudioContext() {"),
    code("  // Cria apenas uma vez, na primeira chamada"),
    code("  if (!_audioCtx) {"),
    code("    _audioCtx = new AudioContext();"),
    code("  }"),
    code("  return _audioCtx;"),
    code("}"),
    infoBox("Padrão Singleton: Garante que existe apenas uma instância de um objecto em todo o programa. Aqui garante que o AudioContext é criado apenas uma vez (economizando recursos) e apenas após interacção do utilizador (respeitando a política do browser).", "EFF6FF", PRIMARY),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 8 — OAuth ───────────────────────────────────────────────────────────
function parte8() {
  return [
    h1("Parte 8 — OAuth: Login com Google e LinkedIn"),
    p("OAuth (Open Authorization) é um protocolo que permite que o utilizador se autentique numa aplicação usando a conta de outro serviço (Google, LinkedIn, GitHub, etc.) sem partilhar a sua password."),
    infoBox("Analogia: É como um porteiro de hotel que verifica a tua identificação. O Google confirma quem és, e o GIVA confia no Google. A tua password fica sempre em segurança no Google — o GIVA nunca a vê.", "EFF6FF", PRIMARY),
    ...spacer(1),

    h2("O Problema — Loop de Redirect"),
    p("O login com Google funcionava perfeitamente em desenvolvimento local (localhost:5173), mas em produção (givasistem.vercel.app) criava um loop infinito: após autenticação no Google, o utilizador era redirecionado de volta para localhost:5173 em vez do site de produção."),
    p("O fluxo OAuth completo:"),
    bullet("1. Utilizador clica 'Entrar com Google'"),
    bullet("2. Browser redireciona para o Google (página de login)"),
    bullet("3. Utilizador aprova a autenticação"),
    bullet("4. Google redireciona para o URL de callback do Supabase"),
    bullet("5. Supabase processa o token e redireciona para o GIVA"),
    bullet("6. Bug: o redirect em passo 5 apontava para localhost"),
    ...spacer(1),

    h2("A Causa — Código Hardcoded"),
    code("// ERRADO: usa window.location.origin dinamicamente"),
    code("await supabase.auth.signInWithOAuth({"),
    code("  provider: 'google',"),
    code("  options: {"),
    code("    redirectTo: window.location.origin + '/auth/callback'"),
    code("    // Em produção, Vercel proxy fazia retornar valor errado"),
    code("  }"),
    code("});"),
    ...spacer(1),

    h2("A Solução — Em 3 Passos"),
    h3("Passo 1: Google Cloud Console"),
    p("Adicionar o URL de callback do Supabase como URI de redirect autorizado nas configurações OAuth do Google:"),
    code("https://pniwewlldopizfwrvneo.supabase.co/auth/v1/callback"),
    ...spacer(1),
    h3("Passo 2: Supabase Dashboard"),
    p("Declarar o URL de produção como autorizado no Supabase:"),
    code("Site URL: https://givasistem.vercel.app"),
    code("Redirect URLs: https://givasistem.vercel.app/**"),
    ...spacer(1),
    h3("Passo 3: Variável de Ambiente + Código"),
    code("// CORRECTO: usa variável de ambiente"),
    code("await supabase.auth.signInWithOAuth({"),
    code("  provider: 'google',"),
    code("  options: {"),
    code("    redirectTo: (import.meta.env.VITE_APP_URL"),
    code("                || window.location.origin) + '/auth/callback'"),
    code("  }"),
    code("});"),
    p("No Vercel, foi adicionada a variável de ambiente:"),
    code("VITE_APP_URL = https://givasistem.vercel.app"),
    infoBox("Variáveis de Ambiente: Valores de configuração que mudam entre ambientes (desenvolvimento vs produção). Nunca se hardcodes URLs ou credenciais no código — usa variáveis de ambiente. Em Vite, as variáveis começam com VITE_ para ficarem disponíveis no browser.", "FFFBEB", YELLOW),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 9 — Features actuais ────────────────────────────────────────────────
function parte9() {
  return [
    h1("Parte 9 — Features da Sessão Actual (Abril 2026)"),
    p("Com a base sólida estabelecida, foram implementadas funcionalidades de maior impacto visual e operacional."),
    ...spacer(1),

    h2("Página de Ferramentas — Sistema de RH"),
    p("A página /ferramentas é um sistema de gestão de Recursos Humanos interno, acessível apenas a utilizadores com o papel ADMIN_1. Tem 5 tabs funcionais:"),
    makeTable(
      ["Tab", "Funcionalidade"],
      [
        ["Alunos", "Tabela com todos os alunos. Pesquisa em tempo real por nome, turma ou número de processo."],
        ["Registar", "Formulário completo para novo aluno com upload de foto para o Supabase Storage."],
        ["Vagas", "CRUD de vagas de estágio: criar, listar e eliminar vagas em empresas."],
        ["Atribuição", "Ligar um aluno específico a uma vaga específica — sistema de match RH."],
        ["Pautas", "Pauta tradicional digital por turma: foto, nome, processo, nota colorida, estado."],
      ]
    ),
    ...spacer(1),

    h2("Tab Pautas — Pauta Digital Tradicional"),
    p("A pauta substitui as folhas de papel tradicionais. Para cada turma seleccionada, mostra:"),
    bullet("Número de ordem"),
    bullet("Foto de perfil do aluno"),
    bullet("Nome completo e número de processo"),
    bullet("Empresa de estágio e data de início"),
    bullet("Nota numérica com cor: verde ≥ 14, amarelo ≥ 10, vermelho < 10"),
    bullet("Estado do estágio: Em andamento, Concluído, Reprovado"),
    bullet("Média da turma calculada automaticamente"),
    ...spacer(1),

    h2("Barra de Progresso Global"),
    p("A barra colorida fina que aparece no topo da página durante a navegação (estilo GitHub/LinkedIn). Dá feedback visual imediato ao utilizador de que algo está a acontecer."),
    p("Decisão técnica importante: A biblioteca padrão para isto (NProgress) não estava instalada. Em vez de adicionar uma dependência apenas para esta funcionalidade, implementou-se do zero em ~75 linhas — princípio de não sobre-engenheirar."),
    code("/* CSS: variável --prog controla a largura */"),
    code(".top-progress-bar::after {"),
    code("  content: '';"),
    code("  position: fixed;"),
    code("  top: 0; left: 0; height: 3px;"),
    code("  width: var(--prog, 0%);"),
    code("  background: linear-gradient(90deg, var(--primary), var(--accent));"),
    code("  transition: width 0.12s linear;"),
    code("}"),
    ...spacer(1),

    h2("requestAnimationFrame — Animações Suaves"),
    p("Para animar a barra de progresso sem usar CSS transitions, usou-se requestAnimationFrame — uma API do browser que sincroniza animações com a taxa de refresh do ecrã (60 fps). Isto garante animações fluidas sem desperdiçar CPU:"),
    code("function animateTo(target) {"),
    code("  let current = getCurrentProgress();"),
    code("  function step() {"),
    code("    // Interpolação suave: mover 15% da distância restante por frame"),
    code("    current += (target - current) * 0.15;"),
    code("    setProgress(current);"),
    code("    if (Math.abs(target - current) > 0.5) {"),
    code("      requestAnimationFrame(step); // Agendar próximo frame"),
    code("    }"),
    code("  }"),
    code("  requestAnimationFrame(step);"),
    code("}"),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 10 — Responsividade ─────────────────────────────────────────────────
function parte10() {
  return [
    h1("Parte 10 — Responsividade Mobile e Desktop"),
    p("Responsividade é a capacidade de um website se adaptar a qualquer tamanho de ecrã. Um site responsivo funciona bem num iPhone de 320px e num monitor 4K de 3840px."),
    ...spacer(1),

    h2("Media Queries — A Ferramenta Principal"),
    p("Media queries são condições em CSS que aplicam estilos apenas quando determinadas condições são verdadeiras (ex: largura do ecrã menor que X pixels):"),
    code("/* Estilos base: para todos os tamanhos */"),
    code(".sidebar { width: 260px; }"),
    code(""),
    code("/* Tablet (< 980px): sidebar ligeiramente mais estreita */"),
    code("@media (max-width: 980px) {"),
    code("  :root { --sidebar-collapsed: 4rem; }"),
    code("}"),
    code(""),
    code("/* Mobile (< 640px): sidebar esconde-se completamente */"),
    code("@media (max-width: 640px) {"),
    code("  .sidebar {"),
    code("    position: fixed;"),
    code("    transform: translateX(-100%); /* Fora do ecrã */"),
    code("  }"),
    code("  .sidebar.mobile-open {"),
    code("    transform: translateX(0); /* Visível */"),
    code("  }"),
    code("  .mobile-topbar {"),
    code("    display: flex; /* Barra com logo + botão hamburger */"),
    code("  }"),
    code("}"),
    ...spacer(1),

    h2("Estratégia Mobile-First"),
    p("O design foi implementado com a estratégia mobile-first: primeiro define-se o layout para ecrãs pequenos, depois adiciona-se complexidade para ecrãs maiores com min-width queries. Isto garante que o site funciona bem nos dispositivos mais limitados por omissão."),
    ...spacer(1),

    h2("Sidebar — Comportamento por Tamanho de Ecrã"),
    makeTable(
      ["Tamanho de Ecrã", "Comportamento do Sidebar"],
      [
        ["Desktop (> 980px)", "Sempre visível, colapsado (só ícones), expande ao hover"],
        ["Tablet (640-980px)", "Sempre visível, ícones ligeiramente mais pequenos"],
        ["Mobile (< 640px)", "Esconde-se. Botão hamburger no topo abre/fecha com animação slide"],
      ]
    ),
    ...spacer(1),

    h2("Navegação por Gesto (Swipe)"),
    p("Em dispositivos móveis, é possível abrir o sidebar deslizando o dedo da borda esquerda para a direita — comportamento familiar de apps como Gmail e YouTube. A lógica detecta touchstart perto da borda esquerda, rastreia o movimento com touchmove, e ao soltar (touchend) decide abrir ou fechar com base na distância percorrida."),
    infoBox("UX (User Experience): A navegação por gesto é um exemplo de design centrado no utilizador — não obriga o utilizador a aprender um novo padrão, usa um gesto que já conhece de outras apps.", "EFF6FF", PRIMARY),
    ...spacer(1),
    new Paragraph({ pageBreakBefore: true }),
  ];
}

// ── PARTE 11 — Resumo Final ───────────────────────────────────────────────────
function parte11() {
  return [
    h1("Parte 11 — Estado Actual e Resumo do Projecto"),
    ...spacer(1),

    h2("Números do Projecto"),
    makeTable(
      ["Métrica", "Valor"],
      [
        ["Módulos JavaScript compilados", "142"],
        ["Páginas (rotas da aplicação)", "22+"],
        ["Componentes React", "20+"],
        ["Tabelas na base de dados", "20+"],
        ["Serviços de dados", "10+"],
        ["Linhas de CSS", "5.500+"],
        ["Commits no GitHub", "10+"],
        ["Bugs documentados e resolvidos", "6"],
        ["Viewports testados em QA formal", "6"],
        ["Testes automatizados", "18/18 OK"],
        ["URL de produção", "https://givasistem.vercel.app"],
      ]
    ),
    ...spacer(1),

    h2("Estado das Funcionalidades"),
    makeTable(
      ["Funcionalidade", "Estado"],
      [
        ["Autenticação email/password", "✅ Produção"],
        ["Login com Google OAuth", "✅ Produção"],
        ["Login com LinkedIn OAuth", "✅ Produção"],
        ["Dashboard com KPIs", "✅ Produção"],
        ["Gestão de turmas", "✅ Produção"],
        ["Gestão de estágios", "✅ Produção"],
        ["Avaliações e notas", "✅ Produção"],
        ["Documentos oficiais", "✅ Produção"],
        ["Empresas parceiras", "✅ Produção"],
        ["Chat com Realtime", "✅ Produção"],
        ["Notificações de áudio", "✅ Produção"],
        ["Perfil expandido do aluno + portfolio", "✅ Produção"],
        ["Sistema de candidaturas bidirecional", "✅ Produção"],
        ["Página de Ferramentas (sistema RH)", "✅ Produção"],
        ["Barra de progresso global", "✅ Produção"],
        ["Feed social moderno", "✅ Produção"],
        ["Fotos de perfil consistentes", "✅ Produção"],
        ["Responsividade mobile/tablet/desktop", "⏳ Em curso"],
      ]
    ),
    ...spacer(1),

    h2("Lições para Engenheiros Iniciantes"),
    p("As lições mais importantes aprendidas ao longo deste projecto:"),
    bullet("1. Planear antes de codificar: A arquitectura DDD e o design da base de dados vieram antes de qualquer linha React. Um bom plano poupa semanas de trabalho."),
    bullet("2. Separação de responsabilidades: Serviços separados dos componentes, componentes separados das páginas. Cada ficheiro tem uma única responsabilidade clara."),
    bullet("3. Segurança em camadas: Validação no frontend + RLS no banco de dados + políticas Supabase. Nunca confiar apenas numa camada de segurança."),
    bullet("4. Erros de produção são normais: Os 6 bugs documentados foram todos resolvidos. Bugs em produção são oportunidades de aprendizagem, não fracassos."),
    bullet("5. Não sobre-engenheirar: A barra de progresso foi implementada sem biblioteca externa porque 75 linhas resolviam o problema. Mais dependências = mais complexidade = mais problemas."),
    bullet("6. Cleanup no useEffect: Sempre retornar função de cleanup quando se cria subscrições, timers ou event listeners num useEffect."),
    bullet("7. Variáveis de ambiente: Nunca hardcodes URLs, chaves de API ou credenciais no código. Usa variáveis de ambiente."),
    bullet("8. QA formal: Testar em múltiplos viewports e dispositivos antes de considerar uma feature concluída."),
    ...spacer(2),
    divider(),
    new Paragraph({
      children: [
        new TextRun({ text: "GIVA IPIZ", bold: true, size: 24, font: "Calibri", color: PRIMARY }),
        new TextRun({ text: "  ·  Relatório Técnico  ·  Abril de 2026  ·  ", size: 22, font: "Calibri", color: MUTED }),
        new TextRun({ text: "givasistem.vercel.app", size: 22, font: "Calibri", color: PRIMARY }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 0 },
    }),
  ];
}

// ── Assemblagem do documento ───────────────────────────────────────────────────
const doc = new Document({
  creator: "GitHub Copilot — GIVA IPIZ",
  title: "GIVA IPIZ — Relatório Técnico de Desenvolvimento",
  description: "Relatório completo das fases de construção da plataforma GIVA IPIZ",
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 24, color: DARK },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1.2),
          },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: "GIVA IPIZ  ·  Relatório Técnico  ·  ", size: 18, font: "Calibri", color: MUTED }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Calibri", color: MUTED }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: [
        ...coverSection(),
        ...parte1(),
        ...parte2(),
        ...parte3(),
        ...parte4(),
        ...parte5(),
        ...parte6(),
        ...parte7(),
        ...parte8(),
        ...parte9(),
        ...parte10(),
        ...parte11(),
      ],
    },
  ],
});

// Gerar e guardar ficheiro
Packer.toBuffer(doc).then((buffer) => {
  writeFileSync(OUT, buffer);
  console.log(`✅ Documento gerado: ${OUT}`);
}).catch((err) => {
  console.error("❌ Erro ao gerar documento:", err);
  process.exit(1);
});
