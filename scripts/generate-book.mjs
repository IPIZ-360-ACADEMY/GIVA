import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  convertInchesToTwip,
} from "docx";
import { writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, "../TCC - Documentos e Outros/GIVA_Livro_Tecnico_Claudio_Henriques.docx");

const phaseArgRaw = (process.argv.find((arg) => arg.startsWith("--phase=")) || "").split("=")[1];
const phaseArg = phaseArgRaw ? String(phaseArgRaw).trim().toUpperCase() : "ALL";
const VALID_PHASES = new Set(["A", "B", "C", "ALL"]);

if (!VALID_PHASES.has(phaseArg)) {
  console.error("Fase invalida. Use --phase=A | --phase=B | --phase=C | --phase=ALL");
  process.exit(1);
}

const COLORS = {
  primary: "0F6D67",
  accent: "F18F3B",
  dark: "122533",
  muted: "5F7386",
  line: "D5E0E7",
  paper: "FFFFFF",
  soft: "EEF5F8",
};

const AUTHOR = "Claudio Afonso Henriques";
const AUTHOR_SUBTITLE = "Director de Tecnologia na Softconection | Mentor Tech | Programador e COO da Agrilink | Aluno da 42 Luanda";
const BOOK_TITLE = "GIVA: Da Ideia ao Sistema";
const BOOK_SUBTITLE = "Manual Completo de Engenharia de Software do Zero ao Nivel Avancado";

function paragraphText(text, options = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: options.size || 24,
        color: options.color || COLORS.dark,
        bold: Boolean(options.bold),
        italics: Boolean(options.italics),
        underline: options.underline ? { type: UnderlineType.SINGLE } : undefined,
      }),
    ],
    heading: options.heading,
    spacing: options.spacing || { before: 80, after: 80 },
    alignment: options.alignment || AlignmentType.JUSTIFIED,
    indent: options.indent,
    pageBreakBefore: Boolean(options.pageBreakBefore),
  });
}

function h1(text, pageBreakBefore = false) {
  return paragraphText(text, {
    heading: HeadingLevel.HEADING_1,
    bold: true,
    color: COLORS.primary,
    size: 46,
    pageBreakBefore,
    spacing: { before: 300, after: 180 },
    alignment: AlignmentType.LEFT,
  });
}

function h2(text) {
  return paragraphText(text, {
    heading: HeadingLevel.HEADING_2,
    bold: true,
    color: COLORS.primary,
    size: 34,
    spacing: { before: 220, after: 120 },
    alignment: AlignmentType.LEFT,
  });
}

function h3(text) {
  return paragraphText(text, {
    heading: HeadingLevel.HEADING_3,
    bold: true,
    color: COLORS.dark,
    size: 28,
    spacing: { before: 180, after: 100 },
    alignment: AlignmentType.LEFT,
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    children: [new TextRun({ text, size: 23, color: COLORS.dark })],
    bullet: { level },
    spacing: { before: 40, after: 40 },
  });
}

function codeBlock(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: "Courier New", size: 20, color: "1E3A8A" })],
    shading: { type: ShadingType.CLEAR, fill: "F3F7FA" },
    border: {
      left: { color: COLORS.primary, style: BorderStyle.SINGLE, size: 14, space: 6 },
    },
    spacing: { before: 80, after: 80 },
    indent: { left: 320, right: 120 },
    alignment: AlignmentType.LEFT,
  });
}

function noteBox(title, text, fill = "ECFEFF", color = COLORS.primary) {
  return [
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, color, size: 22 })],
      shading: { type: ShadingType.CLEAR, fill },
      border: {
        top: { color, style: BorderStyle.SINGLE, size: 8 },
        left: { color, style: BorderStyle.SINGLE, size: 12 },
        right: { color: COLORS.line, style: BorderStyle.SINGLE, size: 6 },
      },
      indent: { left: 220, right: 220 },
      spacing: { before: 100, after: 20 },
      alignment: AlignmentType.LEFT,
    }),
    new Paragraph({
      children: [new TextRun({ text, size: 22, color: COLORS.dark, italics: true })],
      shading: { type: ShadingType.CLEAR, fill },
      border: {
        bottom: { color, style: BorderStyle.SINGLE, size: 8 },
        left: { color, style: BorderStyle.SINGLE, size: 12 },
        right: { color: COLORS.line, style: BorderStyle.SINGLE, size: 6 },
      },
      indent: { left: 220, right: 220 },
      spacing: { before: 20, after: 100 },
      alignment: AlignmentType.JUSTIFIED,
    }),
  ];
}

function chapterOpening(chapter, text) {
  return noteBox(`Abertura Editorial - ${chapter}`, text, "FFF7ED", COLORS.accent);
}

function chapterClosing(chapter, text) {
  return noteBox(`Fecho de Capitulo - ${chapter}`, text, "ECFDF5", "047857");
}

function editorialPlaybook() {
  return [
    h2("Padrao Editorial do Livro"),
    paragraphText("Para garantir consistencia de leitura, todos os capitulos seguem a mesma cadencia narrativa: abertura estrategica, explicacao tecnica, pratica aplicada e fecho orientado a acao."),
    makeSimpleTable(
      ["Bloco", "Objectivo", "Pergunta que responde"],
      [
        ["Abertura", "Criar contexto e urgencia", "Por que este capitulo importa agora?"],
        ["Nucleo tecnico", "Ensinar conceito e implementacao", "Como funciona de verdade?"],
        ["Aplicacao", "Transformar teoria em entrega", "Como eu aplico no meu projecto?"],
        ["Fecho", "Fixar decisao e proximo passo", "O que devo fazer a seguir?"],
      ],
    ),
    ...noteBox("Regra de Voz", "Escrita directa, sem jargao vazio, com profundidade tecnica e foco em decisao de engenharia.", "EFF6FF", COLORS.primary),
  ];
}

function institutionalPreface() {
  return [
    h1("Prefacio Institucional", true),
    paragraphText("Este livro representa uma proposta de excelencia para a formacao tecnica em engenharia de software em Angola. O projecto GIVA demonstra que e possivel combinar rigor academico, pratica de mercado e impacto social em uma mesma plataforma."),
    paragraphText("Ao consolidar fundamentos, arquitectura, qualidade e operacao em um unico material, esta obra serve como guia de referencia para estudantes, docentes, equipas tecnicas e liderancas institucionais que desejam elevar o nivel de entrega de software."),
    ...noteBox("Compromisso Institucional", "Formar profissionais capazes de construir sistemas robustos, eticos e orientados a resultado para o contexto local e global.", "F0FDF4", "166534"),
  ];
}

function executiveIndexByAudience() {
  return [
    h2("Indice Executivo por Perfil de Leitor"),
    paragraphText("Use esta rota de leitura para acelerar a aprendizagem de acordo com o seu nivel actual."),
    makeSimpleTable(
      ["Perfil", "Capitulos Prioritarios", "Resultado Esperado"],
      [
        ["Iniciante", "1-5, 16-17, Apendice A", "Criar e publicar o primeiro projecto com base solida"],
        ["Intermediario", "6-12, 18-22, 27-29", "Arquitectar aplicacoes com qualidade e previsibilidade"],
        ["Avancado", "13-15, 23-31, Apendice C", "Tomar decisoes de arquitectura, seguranca e operacao"],
        ["Lideranca", "32-33, Parte X", "Conectar estrategia de negocio, produto e engenharia"],
      ],
    ),
  ];
}

function spacer(lines = 1) {
  return Array.from({ length: lines }, () => new Paragraph({ text: "", spacing: { before: 0, after: 0 } }));
}

function makeSimpleTable(headers, rows) {
  return new Table({
    width: { type: WidthType.PERCENTAGE, size: 100 },
    rows: [
      new TableRow({
        children: headers.map(
          (header) =>
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill: COLORS.primary },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: header, bold: true, size: 22, color: "FFFFFF" })],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
        ),
      }),
      ...rows.map(
        (row, index) =>
          new TableRow({
            children: row.map(
              (cell) =>
                new TableCell({
                  shading: { type: ShadingType.CLEAR, fill: index % 2 === 0 ? "F8FBFD" : "FFFFFF" },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cell, size: 22, color: COLORS.dark })],
                      alignment: AlignmentType.LEFT,
                    }),
                  ],
                }),
            ),
          }),
      ),
    ],
  });
}

function coverAndPreface() {
  return [
    ...spacer(4),
    paragraphText(BOOK_TITLE, {
      size: 72,
      bold: true,
      color: COLORS.primary,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
    }),
    paragraphText(BOOK_SUBTITLE, {
      size: 28,
      color: COLORS.muted,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 260 },
    }),
    paragraphText(`Autoria: ${AUTHOR}`, {
      size: 30,
      bold: true,
      color: COLORS.dark,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
    }),
    paragraphText(AUTHOR_SUBTITLE, {
      size: 22,
      color: COLORS.muted,
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 260 },
    }),
    ...noteBox(
      "Manifesto do Livro",
      "Este livro foi desenhado para provar que um projecto de engenharia de software pode ser ensinado com rigor tecnico e linguagem humana. Aqui, o iniciante aprende sem medo, o intermediario organiza o pensamento e o avancado sobe o nivel de arquitectura, qualidade e performance.",
      "ECFEFF",
      COLORS.primary,
    ),
    paragraphText("Luanda, Angola - 2026", {
      alignment: AlignmentType.CENTER,
      color: COLORS.muted,
      size: 22,
      spacing: { before: 120, after: 80 },
    }),
    new Paragraph({ pageBreakBefore: true }),

    h1("Prefacio", false),
    paragraphText(
      h1("Prefacio", false),
    ),
    paragraphText(
      "Ao longo deste livro, cada etapa e explicada como uma estrada: fundamentos, escolhas tecnicas, implementacao por fases, testes, seguranca, deploy e evolucao. O objectivo nao e apenas replicar o GIVA; e formar a capacidade de construir qualquer plataforma profissional.",
    ),
    ...noteBox(
      "Para Iniciantes",
      "Leia com um caderno ao lado. No final de cada capitulo, reproduza os exemplos e escreva as suas duvidas. A aprendizagem real comeca quando voce explica com as suas palavras.",
      "F0FDF4",
      "15803D",
    ),

    ...editorialPlaybook(),

      h2("Prefacio Institucional"),
      paragraphText(
        "Este livro consolida uma jornada real de construcao de software aplicada ao contexto angolano. O projecto GIVA demonstra que excelencia tecnica e impacto social podem coexistir quando ha metodo, disciplina e compromisso com a formacao de pessoas.",
      ),
      paragraphText(
        "Como Director de Tecnologia da Softconection, COO da Agrilink, Mentor Tech e aluno da 42 Luanda, Claudio Afonso Henriques apresenta aqui um modelo pratico de engenharia moderna: fundamentacao solida, execucao incremental, governanca de qualidade e visao de longo prazo.",
      ),
      ...noteBox(
        "Compromisso Editorial",
        "Esta obra foi estruturada para servir tres perfis ao mesmo tempo: quem entra agora na area, quem ja construiu alguns projectos e quem precisa operar sistemas em escala profissional.",
        "E0F2FE",
        "0369A1",
      ),
    ...institutionalPreface(),

    h2("Indice Geral"),
    bullet("Parte I: Fundamentos Absolutos (Logica, Web, JavaScript, npm, Git)"),
    bullet("Parte II: Ecossistema Moderno (React, Router, CSS, Vite)"),
    bullet("Parte III: Backend com Supabase (Dados, Auth, Realtime)"),
    bullet("Parte IV: Concepcao do GIVA (Visao, Arquitectura, Modelo de dados)"),
    bullet("Parte V: Implementacao fase a fase (do primeiro npm ao estado actual)"),
    bullet("Parte VI: Funcionalidades Core (Feed, Chat, Candidaturas, Notificacoes)"),
    bullet("Parte VII: QA, Seguranca e Performance"),
    bullet("Parte VIII: Deploy e Operacao"),
    bullet("Parte IX: Futuro, Carreira e Dominio tecnico"),

      h2("Indice Executivo por Perfil de Leitor"),
      makeSimpleTable(
        ["Perfil", "Comece por", "Objectivo"],
        [
          ["Iniciante", "Parte I + Parte II", "Construir base tecnica sem lacunas"],
          ["Intermediario", "Parte III + Parte IV + Parte V", "Dominar arquitectura e implementacao orientada a produto"],
          ["Avancado", "Parte VI + Parte VII + Parte VIII", "Escalar qualidade, seguranca, performance e operacao"],
        ],
      ),
      bullet("Leitor Iniciante: siga em ordem sequencial e execute todos os exercicios basicos."),
      bullet("Leitor Intermediario: priorize estudos de caso e mapeie gaps de arquitectura."),
      bullet("Leitor Avancado: use os capitulos de QA/Seguranca/Performance como framework de decisao tecnica."),

      h2("Padrao Editorial de Capitulo"),
      paragraphText("Para garantir consistencia pedagogica, cada capitulo segue um padrao unico de escrita tecnica e mentoria:"),
      makeSimpleTable(
        ["Bloco", "Funcao", "Resultado para o leitor"],
        [
          ["Abertura Editorial", "Define contexto e importancia", "Clareza de intencao"],
          ["Corpo Tecnico", "Explica conceitos e implementacao", "Compreensao pratica"],
          ["Exemplo/Caso", "Mostra aplicacao real", "Transferencia para projectos reais"],
          ["Fecho de Capitulo", "Consolida aprendizagem", "Retencao e proximo passo"],
        ],
      ),
    bullet("Apendices: SQL, Glossario, Referencias, Cheatsheets"),

    ...executiveIndexByAudience(),
  ];
}

function phaseASections() {
  return [
    h1("PARTE I - Fundamentos Absolutos", true),
    paragraphText("Esta parte ensina os blocos que sustentam qualquer software profissional. Sem fundamentos, ferramentas modernas viram apenas moda; com fundamentos, cada ferramenta vira alavanca."),

    h2("Capitulo 1 - Logica de Programacao"),
    ...chapterOpening("Capitulo 1", "Antes de dominar frameworks, domine o pensamento. Quem controla a logica, controla a complexidade."),
    paragraphText("Programar e construir instrucoes claras para resolver problemas. A logica e o motor: entrada, processamento e saida."),
    bullet("Variaveis: guardam estado."),
    bullet("Condicoes: escolhem caminhos (if/else)."),
    bullet("Ciclos: repetem tarefas (for/while)."),
    bullet("Funcoes: encapsulam comportamento reutilizavel."),
    ...noteBox("Exercicio", "Implemente um algoritmo que recebe uma lista de notas e devolve media, maior nota, menor nota e classificacao final.", "FFF7ED", "C2410C"),
    codeBlock("function media(notas) {\n  const soma = notas.reduce((acc, n) => acc + n, 0);\n  return soma / notas.length;\n}"),
    ...chapterClosing("Capitulo 1", "Programacao nao comeca no teclado. Comeca na clareza mental de transformar problema em sequencia."),

    h2("Capitulo 2 - HTML e CSS"),
    paragraphText("HTML estrutura, CSS comunica visualmente. Uma UI legivel e uma funcionalidade de produto, nao apenas estetica."),
    bullet("Semantica: use header, nav, main, section, footer."),
    bullet("Acessibilidade: labels, aria, contraste e foco visivel."),
    bullet("Responsividade: layout adaptativo por media query."),
    codeBlock("@media (max-width: 960px) {\n  .app-shell {\n    grid-template-columns: 1fr;\n  }\n}"),

    h2("Capitulo 3 - JavaScript Moderno"),
    paragraphText("No GIVA, JavaScript e a lingua da experiencia. ES Modules, async/await e array methods aceleram desenvolvimento e reduzem complexidade."),
    bullet("Promises e async/await para chamadas a API."),
    bullet("Desestruturacao para codigo limpo."),
    bullet("Map/filter/reduce para transformar dados com clareza."),
    codeBlock("const active = internships.filter((item) => item.status === \"active\");"),

    h2("Capitulo 4 - Node.js e npm"),
    paragraphText("npm e o sistema nervoso do projecto. Scripts do package.json padronizam execucao em equipa."),
    makeSimpleTable(
      ["Script", "Comando", "Uso"],
      [
        ["Desenvolvimento", "npm run dev", "Abre Vite com hot reload"],
        ["Build", "npm run build", "Gera pacote de producao"],
        ["Preview", "npm run preview", "Testa build local"],
        ["Testes", "npm run test", "Executa vitest"],
        ["Provision", "npm run users:provision", "Cria utilizadores iniciais"],
      ],
    ),

    h2("Capitulo 5 - Git e GitHub"),
    paragraphText("Versionamento e a memoria da engenharia. O valor esta em commits pequenos, mensagens claras e revisao colaborativa."),
    bullet("Commit orientado a intencao: feat, fix, refactor, docs, test."),
    bullet("Cada bug importante vira aprendizado documentado."),
    bullet("Branching simples no inicio; estrategia formal em equipas maiores."),

    h1("PARTE II - Ecossistema React Moderno", true),
    h2("Capitulo 6 - React 18 na pratica"),
    ...chapterOpening("Capitulo 6", "React nao e sobre componentes bonitos. E sobre modelar mudanca de estado sem perder o controlo da interface."),
    paragraphText("React organiza o frontend por componentes, e cada componente encapsula estado, comportamento e apresentacao."),
    codeBlock("createRoot(document.getElementById(\"root\")).render(\n  <React.StrictMode>\n    <BrowserRouter>\n      <App />\n    </BrowserRouter>\n  </React.StrictMode>\n);") ,
    bullet("StrictMode ajuda a detectar efeitos colaterais durante desenvolvimento."),
    bullet("Componentizacao reduz duplicacao e facilita testes."),
    ...chapterClosing("Capitulo 6", "No nivel profissional, componente bom e componente previsivel, testavel e legivel."),

    h2("Capitulo 7 - React Router 6"),
    paragraphText("No GIVA, o roteamento define fronteiras funcionais: paginas publicas, privadas e redirecionamentos legados."),
    codeBlock("<Route element={<RequireAuth />}>\n  <Route element={<AppShell />}>\n    <Route path=\"/estagios\" element={<InternshipsPage />} />\n  </Route>\n</Route>"),
    bullet("RequireAuth protege area privada."),
    bullet("AppShell padroniza layout global."),

    h2("Capitulo 8 - Sistema Visual"),
    paragraphText("A camada visual usa tokens de design para previsibilidade. Uma equipa madura nao escolhe cor em cada componente."),
    codeBlock(":root {\n  --primary: #0f6d67;\n  --accent: #f18f3b;\n  --bg: #f3f6f8;\n  --text: #0f1f2d;\n}"),
    ...noteBox("Regra de Ouro", "Nao misture estilos inline sem necessidade. Construa um design system e escale com consistencia.", "FEFCE8", "A16207"),

    h2("Capitulo 9 - Vite e Build de Producao"),
    paragraphText("Vite foi escolhido pela velocidade local e build optimizada. O projecto usa chunk manual para vendor de React."),
    codeBlock("manualChunks: {\n  vendor: [\"react\", \"react-dom\", \"react-router-dom\"]\n}"),

    h1("PARTE III - Supabase e Engenharia de Dados", true),
    h2("Capitulo 10 - Supabase como backend moderno"),
    ...chapterOpening("Capitulo 10", "Backend moderno nao e sobre simplificar ate ao amadorismo; e sobre acelerar entrega sem sacrificar governanca."),
    paragraphText("Supabase permitiu foco no produto sem sacrificar robustez. O cliente e inicializado a partir de variaveis seguras de ambiente."),
    codeBlock("const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;\nconst supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;\nexport const supabase = createClient(supabaseUrl, supabaseAnonKey);") ,

    h2("Capitulo 11 - Modelo relacional no GIVA"),
    paragraphText("As entidades principais unem actores academicos e empresariais: user_profiles, students, partners, internships, job_applications, notifications."),
    makeSimpleTable(
      ["Tabela", "Responsabilidade", "Valor de negocio"],
      [
        ["user_profiles", "Identidade e papel", "Personalizacao e governanca"],
        ["internships", "Ciclo de estagio", "Controle operacional academico"],
        ["job_applications", "Candidaturas", "Funil de recrutamento"],
        ["notifications", "Eventos", "Comunicacao em tempo real"],
      ],
    ),

    h2("Capitulo 12 - Autenticacao, OAuth e RLS"),
    paragraphText("Autenticacao sem autorizacao e insegura. No GIVA, ambos trabalham juntos: auth no cliente e politicas RLS no PostgreSQL."),
    bullet("Login por email/password e OAuth social (Google, LinkedIn)."),
    bullet("Sessao reactiva via onAuthStateChange."),
    bullet("RLS limita visibilidade por utilizador e perfil."),
    ...noteBox("Para Avancados", "A maturidade de seguranca comeca no desenho de dados: negar por defeito, permitir por necessidade.", "FDF4FF", "9333EA"),
    ...chapterClosing("Capitulo 12", "Seguranca real acontece quando a regra de acesso vive no dado e nao apenas no botao."),
  ];
}

function phaseBSections() {
  return [
    h1("PARTE IV - Concepcao do GIVA", true),
    h2("Capitulo 13 - Problema, visao e execucao"),
    ...chapterOpening("Capitulo 13", "Todo software relevante nasce de uma dor real. O GIVA nasceu para resolver atrasos, ruido e invisibilidade no ciclo de estagios."),
    paragraphText("A ideia do GIVA responde a friccoes reais: informacao dispersa, processos manuais e baixa rastreabilidade de estagios."),
    paragraphText("Visao: criar uma plataforma unica para conectar alunos, coordenadores e empresas, com dados em tempo real e historico auditavel."),

    h2("Capitulo 14 - Arquitectura e papeis"),
    paragraphText("A arquitectura equilibra simplicidade de operacao com separacao de responsabilidades. O frontend e SPA React; backend e Supabase; deploy e Vercel."),
    bullet("Papeis: estudante, empresa, admin e externo."),
    bullet("Autorizacao por role e estado de moderacao."),
    bullet("Separacao por services para reduzir acoplamento da UI com dados."),

    h2("Capitulo 15 - Diagrama mental do sistema"),
    bullet("Camada 1: Interface (pages + components)."),
    bullet("Camada 2: Dominio de aplicacao (services)."),
    bullet("Camada 3: Dados e regras (Supabase + SQL + RLS)."),
    bullet("Camada 4: Operacao (Vercel + observabilidade + QA)."),

    h1("PARTE V - Implementacao fase a fase", true),
    h2("Capitulo 16 - O primeiro npm"),
    codeBlock("npm create vite@latest\ncd GIVA\nnpm install\nnpm run dev"),
    paragraphText("A primeira fase validou pipeline local: build, roteamento, pagina inicial e padrao de pastas."),

    h2("Capitulo 17 - main.jsx e App.jsx linha a linha"),
    paragraphText("main.jsx cria o root React, activa BrowserRouter e envolve tudo com ErrorBoundary. Isso protege renderizacao e estabiliza rotas."),
    codeBlock("<ErrorBoundary>\n  <BrowserRouter future={{ v7_startTransition: true }}>\n    <App />\n  </BrowserRouter>\n</ErrorBoundary>"),
    paragraphText("App.jsx concentra o mapa de rotas com lazy loading, reduzindo bundle inicial e melhorando tempo de carregamento."),

    h2("Capitulo 18 - AuthContext"),
    paragraphText("AuthContext padroniza sessao, perfil e contagem de notificacoes para toda a aplicacao."),
    bullet("Bootstrap da sessao existente."),
    bullet("Listener de mudanca de autenticacao."),
    bullet("Fetch de user_profiles com fallback seguro."),

    h2("Capitulo 19 - AppShell"),
    paragraphText("AppShell entrega layout unificado: navegacao, tema, preferencias, toast e badge de mensagens/notificacoes."),
    bullet("Sidebar para desktop/tablet."),
    bullet("Topbar e menu mobile para telas pequenas."),
    bullet("useOutletContext para transportar funcoes comuns."),
    ...chapterClosing("Capitulo 19", "Layouts maduros diminuem atrito cognitivo. Quando o utilizador para de pensar na interface, ele foca no objectivo."),

    h2("Capitulo 20 - Paginas e responsabilidades"),
    makeSimpleTable(
      ["Pagina", "Responsabilidade", "Nivel"],
      [
        ["DashboardPage", "KPIs e resumo geral", "Essencial"],
        ["InternshipsPage", "Gestao de estagios", "Essencial"],
        ["PartnersPage", "Empresas e candidaturas", "Essencial"],
        ["ChatPage", "Mensagens realtime", "Avancado"],
        ["AdminPage", "Moderacao e governanca", "Avancado"],
      ],
    ),

    h2("Capitulo 21 - Camada de services"),
    paragraphText("Os services encapsulam acesso a dados e regras de negocio. A pagina orquestra, o service executa."),
    bullet("authService, notificationsService, chatService, internshipsService, postsService."),
    bullet("Padrao: funcoes pequenas, nomes claros, retorno previsivel."),

    h2("Capitulo 22 - Componentes reutilizaveis"),
    paragraphText("Componentes como DataTable, PageHeader, PanelSection e modais reduzem duplicacao e tornam a interface mais coerente."),
    ...noteBox("Mentoria", "Para crescer rapido: construa bibliotecas internas de componentes antes de multiplicar paginas.", "ECFCCB", "4D7C0F"),

    h1("PARTE VI - Funcionalidades Core", true),
    h2("Capitulo 23 - Feed social"),
    bullet("Publicacao, reacao, partilha e bookmarks."),
    bullet("Moderacao para evitar ruido e abuso."),
    h2("Capitulo 24 - Chat realtime"),
    bullet("Conversations + messages + read receipts."),
    bullet("Subscricoes em tempo real para UX instantanea."),
    h2("Capitulo 25 - Candidaturas"),
    bullet("Fluxo aluno -> empresa -> aceite/rejeite -> notificacao."),
    bullet("RPC para consistencia de vagas e integridade transacional."),
    h2("Capitulo 26 - Notificacoes"),
    bullet("Contador global no contexto."),
    bullet("Centro historico de notificacoes por utilizador."),

    h2("Dossie Especial - Estudos de Caso End-to-End"),
    paragraphText("Esta secao converte teoria em estrategia de entrega. Cada estudo de caso mostra fluxo funcional, decisao tecnica, risco e resultado operacional."),

    h3("Caso 1 - Feed Social do GIVA"),
    makeSimpleTable(
      ["Dimensao", "Implementacao", "Impacto"],
      [
        ["Problema", "Baixa interaccao entre comunidade academica", "Pouca partilha de oportunidades"],
        ["Solucao", "Posts + reaccoes + bookmarks + moderacao", "Aumento de comunicacao interna"],
        ["Tecnica", "postsService + subscribeToFeed", "Actualizacao em tempo real"],
      ],
    ),
    codeBlock("const { data } = await supabase\n  .from(\"posts\")\n  .select(\"*\")\n  .order(\"created_at\", { ascending: false });"),
    ...noteBox("Licao do Caso", "Um feed sem moderacao vira ruido. Produto social exige regra, ranking e contexto.", "FFF7ED", "C2410C"),

    h3("Caso 2 - Chat em Tempo Real"),
    makeSimpleTable(
      ["Dimensao", "Implementacao", "Impacto"],
      [
        ["Problema", "Comunicao lenta entre actores", "Atraso de decisoes"],
        ["Solucao", "Conversations + messages + read receipts", "Resposta mais rapida"],
        ["Tecnica", "Subscricoes websocket do Supabase", "UX instantanea"],
      ],
    ),
    codeBlock("const channel = supabase\n  .channel(\"messages\")\n  .on(\"postgres_changes\", { event: \"INSERT\", schema: \"public\", table: \"messages\" }, callback)\n  .subscribe();"),
    ...noteBox("Licao do Caso", "Realtime sem estrategia de cleanup cria leaks e custos invisiveis. Assinar e tao importante quanto desassinar.", "FEF2F2", "B91C1C"),

    h3("Caso 3 - Candidaturas a Estagio"),
    makeSimpleTable(
      ["Dimensao", "Implementacao", "Impacto"],
      [
        ["Problema", "Candidaturas sem rastreio", "Incerteza no processo"],
        ["Solucao", "JobApplicationModal + dashboard de empresa", "Pipeline transparente"],
        ["Tecnica", "jobApplicationService + RPC", "Integridade de vagas"],
      ],
    ),
    codeBlock("await supabase.rpc(\"accept_job_application\", {\n  p_application_id: applicationId,\n  p_notes: notes\n});"),
    ...noteBox("Licao do Caso", "Quando uma regra afecta estado critico (vagas), prefira transacao no banco em vez de logica espalhada no frontend.", "EFF6FF", COLORS.primary),

    h3("Caso 4 - Painel Administrativo"),
    makeSimpleTable(
      ["Dimensao", "Implementacao", "Impacto"],
      [
        ["Problema", "Falta de governanca de conteudo", "Risco reputacional"],
        ["Solucao", "Fila de aprovacao de posts", "Qualidade de informacao"],
        ["Tecnica", "moderatePost + trilho de auditoria", "Decisao rastreavel"],
      ],
    ),
    codeBlock("await supabase\n  .from(\"posts\")\n  .update({ approved: true, approved_by: adminId })\n  .eq(\"id\", postId);"),
    ...chapterClosing("Dossie de Casos", "Engenharia de alto nivel nao e apenas escrever codigo certo. E desenhar consequencias certas."),
  ];
}

function phaseCSections() {
  return [
    h1("PARTE VII - QA, Seguranca e Performance", true),
    h2("Capitulo 27 - QA por viewport"),
    ...chapterOpening("Capitulo 27", "Qualidade e o contrato silencioso entre quem constroi e quem confia no sistema."),
    paragraphText("A qualidade nao termina no build sem erros. O GIVA usa checklist por viewport e regressao funcional por fluxo critico."),
    bullet("Breakpoints validados: mobile, tablet e desktop."),
    bullet("Classificacao de risco por severidade P0, P1, P2."),

    h2("Capitulo 28 - Seguranca aplicada"),
    paragraphText("Seguranca e design, nao acessorio. A superficie de ataque inclui autenticacao, permissao, input e dependencia."),
    bullet("RLS no banco para reforcar autorizacao."),
    bullet("Validacao de input no frontend e no backend."),
    bullet("Segregacao de dados por perfil e necessidade."),

    h2("Capitulo 29 - Performance"),
    bullet("Lazy loading de paginas para reduzir bundle inicial."),
    bullet("Memoizacao selectiva para evitar re-render desnecessario."),
    bullet("Chunks de vendor no build para melhor cache."),
    ...chapterClosing("Capitulo 29", "Performance e respeito pelo tempo do utilizador. Cada milissegundo poupado e credibilidade ganha."),

    h1("PARTE VIII - Deploy e Operacao", true),
    h2("Capitulo 30 - Vercel em producao"),
    paragraphText("Deploy continuo transforma cada push em release rastreavel. O vercel.json garante fallback SPA para todas as rotas."),
    codeBlock("{\n  \"rewrites\": [{ \"source\": \"/(.*)\", \"destination\": \"/index.html\" }]\n}"),
    h2("Capitulo 31 - Rotina DevOps"),
    bullet("Checklist pre-merge: build, teste, leitura de diff."),
    bullet("Mensagens de commit orientadas a valor."),

    h1("PARTE IX - Futuro e Dominio", true),
    h2("Capitulo 32 - Roadmap"),
    bullet("Melhorar responsividade extrema e navegacao mobile-first."),
    bullet("Observabilidade com metricas de negocio e tecnicas."),
    bullet("Evolucao de testes para cobertura de regressao critica."),

    h2("Capitulo 33 - Carta aos engenheiros"),
    paragraphText("Construir software em Angola e acto tecnico e social. Exige rigor, paciencia e visao de longo prazo. O GIVA mostra que e possivel entregar padrao global com contexto local e lideranca disciplinada."),
    ...noteBox("Mensagem Final", "Nao espere condicoes perfeitas para comecar. Comece com clareza, execute com consistencia e evolua com metodo.", "E0F2FE", "0369A1"),

    h1("PARTE X - Mentoria de Carreira Tecnica", true),
    h2("Trilha 1 - Iniciante (0 a 6 meses)"),
    ...chapterOpening("Trilha Iniciante", "A fase iniciante nao e sobre velocidade; e sobre construir base para nao quebrar no primeiro projecto real."),
    bullet("Domine logica, JavaScript, HTML, CSS e Git basico antes de perseguir stacks complexas."),
    bullet("Crie 3 projectos pequenos com deploy publico e README claro."),
    bullet("Aprenda a pedir feedback tecnico sem ego e a documentar duvidas."),
    makeSimpleTable(
      ["Semana", "Foco", "Entrega"],
      [
        ["1-4", "Fundamentos JS e logica", "Exercicios diarios"],
        ["5-8", "React basico", "App de tarefas"],
        ["9-12", "API + deploy", "Projeto completo online"],
      ],
    ),

    h2("Trilha 2 - Intermediario (6 a 18 meses)"),
    bullet("Adote arquitectura por camadas e separacao de responsabilidades."),
    bullet("Aprenda testes automatizados, seguranca basica e performance."),
    bullet("Contribua em produto real com backlog e revisao de codigo."),
    ...noteBox("Meta Intermediaria", "Parar de codar por tentativa e erro. Comecar a codar por desenho e hipoteses validadas.", "FEF9C3", "A16207"),

    h2("Trilha 3 - Avancado (18 a 36 meses)"),
    bullet("Tomar decisoes de arquitectura com base em trade-offs claros."),
    bullet("Instrumentar observabilidade: logs, metricas e alertas."),
    bullet("Mentorar pessoas juniores e elevar cultura de engenharia."),
    codeBlock("Regra pratica: para cada decisao tecnica importante, documente contexto, opcoes, risco, custo e criterio de sucesso."),

    h2("Trilha 4 - Expert e Lideranca Tecnica"),
    bullet("Conectar estrategia de negocio com arquitectura tecnica."),
    bullet("Definir standards de qualidade, seguranca e operacao."),
    bullet("Construir times que entregam com autonomia e previsibilidade."),
    ...chapterClosing("Mentoria de Carreira", "Nao existe atalho para senioridade. Existe intencao, repeticao e responsabilidade crescente por pessoas e sistemas."),

    h1("Apendice A - Comandos Essenciais", true),
    codeBlock("npm run dev\nnpm run build\nnpm run preview\nnpm run test\nnode scripts/generate-book.mjs --phase=ALL"),

    h1("Apendice B - Referencias Bibliograficas", true),
    bullet("Martin, Robert C. Clean Code. Prentice Hall, 2008."),
    bullet("Fowler, Martin. Refactoring. Addison-Wesley, 1999."),
    bullet("Evans, Eric. Domain-Driven Design. Addison-Wesley, 2003."),
    bullet("Beck, Kent. Test Driven Development. Addison-Wesley, 2002."),
    bullet("McConnell, Steve. Code Complete. Microsoft Press, 2004."),
    bullet("Hunt, Andrew; Thomas, David. The Pragmatic Programmer. Addison-Wesley, 1999."),
    bullet("Simpson, Kyle. You Don\"t Know JS Yet. O\"Reilly, 2020."),
    bullet("Cormen, Thomas et al. Introduction to Algorithms. MIT Press, 2009."),

    h1("Apendice C - Leitura Linha a Linha", true),
    paragraphText("Nesta edicao, a leitura e feita por blocos de codigo reais. Em vez de apenas resumir, analisamos a intencao de cada trecho, risco tecnico e impacto na manutencao.", { italics: true }),

    h3("src/main.jsx - bootstrap da aplicacao"),
    codeBlock("import React from \"react\";\nimport { createRoot } from \"react-dom/client\";\nimport { BrowserRouter } from \"react-router-dom\";\nimport App from \"./App.jsx\";\nimport ErrorBoundary from \"./components/ErrorBoundary.jsx\";\nimport \"../style-modern.css\";"),
    paragraphText("Este bloco define as dependencias de arranque. O import do CSS global cedo garante que tokens e resets existem antes de qualquer componente montar."),
    codeBlock("createRoot(document.getElementById(\"root\")).render(\n  <React.StrictMode>\n    <ErrorBoundary>\n      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>\n        <App />\n      </BrowserRouter>\n    </ErrorBoundary>\n  </React.StrictMode>\n);") ,
    bullet("createRoot: activa pipeline React 18 para render concorrente."),
    bullet("StrictMode: revela efeitos colaterais e anti-padroes durante desenvolvimento."),
    bullet("ErrorBoundary: evita crash total de UI quando um subtree quebra."),
    bullet("BrowserRouter future: prepara compatibilidade para comportamentos do Router v7."),

    h3("src/App.jsx - mapa de rotas e fronteiras de acesso"),
    codeBlock("import { lazy, Suspense } from \"react\";\nimport { Navigate, Route, Routes } from \"react-router-dom\";\nimport AppShell from \"./components/AppShell.jsx\";\nimport RequireAuth from \"./components/RequireAuth.jsx\";\nimport { AuthProvider } from \"./contexts/AuthContext.jsx\";"),
    paragraphText("A cabeca do ficheiro evidencia a arquitectura de composicao: Provider global -> controlo de acesso -> shell de layout -> paginas lazy."),
    codeBlock("const DashboardPage = lazy(() => import(\"./pages/DashboardPage.jsx\"));\nconst InternshipsPage = lazy(() => import(\"./pages/InternshipsPage.jsx\"));\nconst PartnersPage = lazy(() => import(\"./pages/PartnersPage.jsx\"));"),
    bullet("lazy import: evita enviar todas as paginas no primeiro carregamento."),
    bullet("Estrutura por arrays APP_ROUTES: facilita evolucao sem duplicar Route manual."),
    codeBlock("<AuthProvider>\n  <Routes>\n    <Route element={<RequireAuth />}>\n      <Route element={<AppShell />}>\n        {APP_ROUTES.map((route) => (\n          <Route key={route.path} path={route.path} element={route.element} />\n        ))}\n      </Route>\n    </Route>\n  </Routes>\n</AuthProvider>"),
    paragraphText("Este bloco define as fronteiras de seguranca e consistencia visual. Nada entra na area privada sem passar por RequireAuth."),

    h3("src/contexts/AuthContext.jsx - estado global de autenticacao"),
    codeBlock("const [session, setSession] = useState(null);\nconst [loading, setLoading] = useState(true);\nconst [userProfile, setUserProfile] = useState(null);\nconst [notifCount, setNotifCount] = useState(0);"),
    paragraphText("O estado base cobre identidade (session), UX de bootstrap (loading), perfil de negocio (userProfile) e sinal operacional (notifCount)."),
    codeBlock("const fetchUserProfile = useCallback(async (userId) => {\n  if (!userId || !authEnabled) return;\n  const { data } = await supabase\n    .from(\"user_profiles\")\n    .select(\"id, type, display_name, avatar_url, bio, moderation\")\n    .eq(\"id\", userId)\n    .maybeSingle();\n  setUserProfile(data ?? null);\n}, [authEnabled]);"),
    bullet("useCallback evita recriar fetchUserProfile em cada render sem necessidade."),
    bullet("maybeSingle reduz erro quando perfil ainda nao existe na tabela."),
    codeBlock("const { data } = onAuthStateChange((_event, nextSession) => {\n  setSession(nextSession);\n  setLoading(false);\n  if (nextSession?.user?.id) fetchUserProfile(nextSession.user.id);\n  else setUserProfile(null);\n});"),
    paragraphText("Este listener e o coracao reactivo da autenticacao. Qualquer login/logout actualiza o estado global e evita incoerencia entre header, paginas e permissoes."),

    h3("src/lib/supabase.js - configuracao segura e previsivel"),
    codeBlock("const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;\nconst supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;\nconst isTestMode = import.meta.env.MODE === \"test\";"),
    bullet("Credenciais vindas de env: nenhuma chave sensivel no codigo fonte."),
    bullet("Flag de teste explicita: permite suites previsiveis sem chamada externa."),
    codeBlock("export const isSupabaseConfigured = !isTestMode && Boolean(supabaseUrl) && Boolean(supabaseAnonKey);\n\nexport const supabase = isSupabaseConfigured\n  ? createClient(supabaseUrl, supabaseAnonKey)\n  : null;"),
    paragraphText("Padrao de fallback seguro: se configuracao faltar, o cliente fica nulo em vez de quebrar runtime em cascata."),

    h3("Checklist de leitura de qualquer ficheiro React"),
    makeSimpleTable(
      ["Pergunta", "O que validar", "Sinal de maturidade"],
      [
        ["Responsabilidade", "Ficheiro faz uma coisa principal?", "Baixo acoplamento"],
        ["Estado", "Estado e minimo e previsivel?", "Menos bugs de sincronizacao"],
        ["Efeitos", "useEffect tem cleanup e dependencias correctas?", "Sem memory leaks"],
        ["Acesso", "Permissoes e guardas estao no lugar certo?", "Seguranca por desenho"],
        ["Performance", "Ha lazy loading e memoizacao onde importa?", "UX estavel"],
      ],
    ),
  ];
}

function pickSectionsByPhase() {
  if (phaseArg === "A") {
    return [...coverAndPreface(), ...phaseASections()];
  }
  if (phaseArg === "B") {
    return [h1("Fase B - Continuidade do Livro", false), ...phaseBSections()];
  }
  if (phaseArg === "C") {
    return [h1("Fase C - Fecho Editorial", false), ...phaseCSections()];
  }
  return [...coverAndPreface(), ...phaseASections(), ...phaseBSections(), ...phaseCSections()];
}

function createBookDocument(children) {
  return new Document({
    creator: AUTHOR,
    title: BOOK_TITLE,
    description: "Livro tecnico completo sobre a concepcao e evolucao do projecto GIVA.",
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.9),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.9),
              right: convertInchesToTwip(0.9),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [new TextRun({ text: `${BOOK_TITLE} | ${AUTHOR}`, color: COLORS.muted, size: 18 })],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Pagina ", color: COLORS.muted, size: 18 }),
                  PageNumber.CURRENT,
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

async function run() {
  const sections = pickSectionsByPhase();
  const doc = createBookDocument(sections);
  const buffer = await Packer.toBuffer(doc);
  writeFileSync(OUTPUT_PATH, buffer);

  if (phaseArg === "ALL") {
    console.log(`Livro completo gerado em: ${OUTPUT_PATH}`);
  } else {
    console.log(`Fase ${phaseArg} gerada em: ${OUTPUT_PATH}`);
  }
}

run().catch((error) => {
  console.error("Falha ao gerar livro:", error);
  process.exit(1);
});
