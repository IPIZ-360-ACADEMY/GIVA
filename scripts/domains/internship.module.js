(() => {
  const root = (window.GIVA = window.GIVA || {});
  root.domains = root.domains || {};

const stageSystem = (() => {
  const stageKey = "ipiz-stages";
  
  // Dados padrão de estrutura do sistema de estágio
  const defaultStages = {
    courses: [
      { id: "ti", name: "Tecnologia da Informacao", short: "TI", color: "#0a6c85" },
      { id: "eie", name: "Engenharia Industrial e Electronica", short: "EIE", color: "#1e90ff" },
      { id: "tlqb", name: "Tecnico de Laboratorio de Qualidade", short: "TLQB", color: "#0f8f57" },
      { id: "mecanica", name: "Mecanica", short: "Mecanica", color: "#b26b00" }
    ],
    classes: [
      { id: "ti-a", courseId: "ti", year: 3, section: "A", supervisor: "Eng. Castro" },
      { id: "ti-b", courseId: "ti", year: 3, section: "B", supervisor: "Eng. Paulino" },
      { id: "eie-a", courseId: "eie", year: 3, section: "A", supervisor: "Eng. Zé" },
      { id: "eie-b", courseId: "eie", year: 3, section: "B", supervisor: "Eng. Silva" },
      { id: "tlqb-a", courseId: "tlqb", year: 3, section: "A", supervisor: "Dr. Carvalho" },
      { id: "mecanica-a", courseId: "mecanica", year: 3, section: "A", supervisor: "Eng. Neves" }
    ],
    companies: [
      { id: "tecangola", name: "TecAngola", sector: "Tecnologia", areas: ["Desenvolvimento", "Infraestrutura", "Seguranca"] },
      { id: "naio", name: "NAIO", sector: "Consultoria", areas: ["Gestao", "RH", "Operacional"] },
      { id: "nexcore", name: "Nexcore", sector: "Telecomunicacoes", areas: ["Rede", "Suporte", "Projetos"] },
      { id: "impacta", name: "Impacta Lab", sector: "Laboratorio", areas: ["Analise", "Qualidade", "Inovacao"] },
      { id: "sinerpro", name: "SinerPro", sector: "Energia", areas: ["Manutencao", "Supervisao", "Seguranca"] }
    ],
    stagePhases: [
      { id: "initial", name: "Triagem Inicial", order: 1, icon: "assignment" },
      { id: "interview", name: "Entrevista Tecnica", order: 2, icon: "assignment_turned_in" },
      { id: "onboarding", name: "Onboarding Parceiro", order: 3, icon: "how_to_reg" },
      { id: "active", name: "Estagio Ativo", order: 4, icon: "work" },
      { id: "evaluation", name: "Avaliacao Final", order: 5, icon: "assessment" },
      { id: "completed", name: "Concluido", order: 6, icon: "check_circle" }
    ],
    stageStatus: [
      { id: "pending", name: "Pendente", color: "#d0d5dd" },
      { id: "approved", name: "Aprovado", color: "#0f8f57" },
      { id: "inprogress", name: "Em Progresso", color: "#0a6c85" },
      { id: "paused", name: "Suspenso", color: "#b26b00" },
      { id: "completed", name: "Concluido", color: "#667085" },
      { id: "rejected", name: "Rejeitado", color: "#c23854" }
    ],
    knowledge: [
      "Programacao", "Gestao de Projectos", "Seguranca Informatica",
      "Analise de Dados", "Atendimento", "Lideranca",
      "Comunicacao", "Resolucao de Problemas", "Trabalho em Equipa",
      "Qualidade", "Infraestrutura", "Suporte Tecnico",
      "Manutencao", "Electrical Work", "Design", "Development"
    ],
    tutors: [
      { id: "t1", name: "Eng. Carlos Neves", email: "carlos.neves@example.com", expertise: ["TI", "Seguranca"] },
      { id: "t2", name: "Dr. Maria Santos", email: "maria.santos@example.com", expertise: ["EIE", "Projetos"] },
      { id: "t3", name: "Eng. Joao Pereira", email: "joao.pereira@example.com", expertise: ["Qualidade", "Laboratorio"] },
      { id: "t4", name: "Msc. Ana Dias", email: "ana.dias@example.com", expertise: ["Gestao", "RH"] }
    ]
  };

  // Dados de alunos com estágios
  const defaultStudents = [
    {
      id: "alu-001",
      name: "Ana Domingo",
      email: "ana.domingo@ipiz.ao",
      phone: "+244 923 456 789",
      classId: "ti-a",
      courseId: "ti",
      matricula: "2023-TI-001",
      stage: {
        id: "est-001",
        companyId: "tecangola",
        areaId: 0,
        phaseId: "initial",
        statusId: "pending",
        startDate: new Date(2026, 2, 15),
        expectedEndDate: new Date(2026, 8, 15),
        knowledgeFocus: ["Programacao", "Seguranca Informatica"],
        tutorId: "t1",
        supervisor: "Eng. Castro"
      },
      performance: { attendance: 95, engagement: 4.5, compliance: 4.8 },
      evaluations: []
    },
    {
      id: "alu-002",
      name: "Rui Nicolau",
      email: "rui.nicolau@ipiz.ao",
      phone: "+244 923 456 790",
      classId: "eie-a",
      courseId: "eie",
      matricula: "2023-EIE-001",
      stage: {
        id: "est-002",
        companyId: "naio",
        areaId: 1,
        phaseId: "interview",
        statusId: "inprogress",
        startDate: new Date(2026, 1, 20),
        expectedEndDate: new Date(2026, 7, 20),
        knowledgeFocus: ["Gestao de Projectos", "Lideranca"],
        tutorId: "t2",
        supervisor: "Eng. Zé"
      },
      performance: { attendance: 89, engagement: 4.2, compliance: 4.5 },
      evaluations: []
    },
    {
      id: "alu-003",
      name: "Joao Gilberto",
      email: "joao.gilberto@ipiz.ao",
      phone: "+244 923 456 791",
      classId: "tlqb-a",
      courseId: "tlqb",
      matricula: "2023-TLQB-001",
      stage: {
        id: "est-003",
        companyId: "impacta",
        areaId: 1,
        phaseId: "onboarding",
        statusId: "approved",
        startDate: new Date(2026, 2, 1),
        expectedEndDate: new Date(2026, 8, 1),
        knowledgeFocus: ["Qualidade", "Analise de Dados"],
        tutorId: "t3",
        supervisor: "Dr. Carvalho"
      },
      performance: { attendance: 100, engagement: 5.0, compliance: 5.0 },
      evaluations: []
    },
    {
      id: "alu-004",
      name: "Marta Josefa",
      email: "marta.josefa@ipiz.ao",
      phone: "+244 923 456 792",
      classId: "ti-a",
      courseId: "ti",
      matricula: "2023-TI-002",
      stage: {
        id: "est-004",
        companyId: "tecangola",
        areaId: 0,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 9, 15),
        expectedEndDate: new Date(2026, 3, 15),
        knowledgeFocus: ["Programacao", "Development"],
        tutorId: "t1",
        supervisor: "Eng. Castro"
      },
      performance: { attendance: 98, engagement: 4.7, compliance: 4.9 },
      evaluations: []
    },
    {
      id: "alu-005",
      name: "Sandra Gomes",
      email: "sandra.gomes@ipiz.ao",
      phone: "+244 923 456 793",
      classId: "eie-b",
      courseId: "eie",
      matricula: "2023-EIE-002",
      stage: {
        id: "est-005",
        companyId: "nexcore",
        areaId: 0,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 8, 29),
        expectedEndDate: new Date(2026, 2, 29),
        knowledgeFocus: ["Infraestrutura", "Suporte Tecnico"],
        tutorId: "t2",
        supervisor: "Eng. Silva"
      },
      performance: { attendance: 94, engagement: 4.4, compliance: 4.6 },
      evaluations: []
    },
    {
      id: "alu-006",
      name: "Israel Mendes",
      email: "israel.mendes@ipiz.ao",
      phone: "+244 923 456 794",
      classId: "mecanica-a",
      courseId: "mecanica",
      matricula: "2023-MECANICA-001",
      stage: {
        id: "est-006",
        companyId: "impacta",
        areaId: 2,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 10, 15),
        expectedEndDate: new Date(2026, 4, 15),
        knowledgeFocus: ["Manutencao", "Seguranca"],
        tutorId: "t3",
        supervisor: "Eng. Neves"
      },
      performance: { attendance: 96, engagement: 4.6, compliance: 4.7 },
      evaluations: []
    },
    {
      id: "alu-007",
      name: "Elisa Costa",
      email: "elisa.costa@ipiz.ao",
      phone: "+244 923 456 795",
      classId: "ti-b",
      courseId: "ti",
      matricula: "2023-TI-003",
      stage: {
        id: "est-007",
        companyId: "nexcore",
        areaId: 1,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 10, 1),
        expectedEndDate: new Date(2026, 4, 1),
        knowledgeFocus: ["Suporte Tecnico", "Atendimento"],
        tutorId: "t1",
        supervisor: "Eng. Paulino"
      },
      performance: { attendance: 91, engagement: 4.1, compliance: 4.3 },
      evaluations: []
    },
    {
      id: "alu-008",
      name: "Jose Pinto",
      email: "jose.pinto@ipiz.ao",
      phone: "+244 923 456 796",
      classId: "ti-b",
      courseId: "ti",
      matricula: "2023-TI-004",
      stage: {
        id: "est-008",
        companyId: "sinerpro",
        areaId: 1,
        phaseId: "evaluation",
        statusId: "completed",
        startDate: new Date(2025, 6, 1),
        expectedEndDate: new Date(2025, 12, 1),
        knowledgeFocus: ["Manutencao", "Supervisao"],
        tutorId: "t1",
        supervisor: "Eng. Paulino"
      },
      performance: { attendance: 99, engagement: 4.9, compliance: 5.0 },
      evaluations: [
        { tutorId: "t1", date: new Date(2025, 11, 20), score: 4.8, feedback: "Excelente desempenho e dedicacao" },
        { companySupervisor: "Supervisor Empresa", date: new Date(2025, 11, 21), score: 4.7, feedback: "Muito bom trabalho em equipa" }
      ]
    },
    {
      id: "alu-009",
      name: "Aline de Jesus",
      email: "aline.jesus@ipiz.ao",
      phone: "+244 923 456 797",
      classId: "eie-a",
      courseId: "eie",
      matricula: "2023-EIE-003",
      stage: {
        id: "est-009",
        companyId: "tecangola",
        areaId: 2,
        phaseId: "active",
        statusId: "inprogress",
        startDate: new Date(2025, 11, 1),
        expectedEndDate: new Date(2026, 5, 1),
        knowledgeFocus: ["Desenvolvimento", "Design"],
        tutorId: "t2",
        supervisor: "Eng. Zé"
      },
      performance: { attendance: 97, engagement: 4.8, compliance: 4.9 },
      evaluations: []
    },
    {
      id: "alu-010",
      name: "Humberto Pires",
      email: "humberto.pires@ipiz.ao",
      phone: "+244 923 456 798",
      classId: "tlqb-a",
      courseId: "tlqb",
      matricula: "2023-TLQB-002",
      stage: {
        id: "est-010",
        companyId: "naio",
        areaId: 0,
        phaseId: "interview",
        statusId: "pending",
        startDate: new Date(2026, 2, 20),
        expectedEndDate: new Date(2026, 8, 20),
        knowledgeFocus: ["Analise de Dados", "Qualidade"],
        tutorId: "t3",
        supervisor: "Dr. Carvalho"
      },
      performance: { attendance: 85, engagement: 3.9, compliance: 4.0 },
      evaluations: []
    }
  ];

  const loadStages = () => {
    const raw = localStorage.getItem(stageKey);
    if (!raw) {
      const initial = { stages: defaultStudents, system: defaultStages };
      localStorage.setItem(stageKey, JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return { stages: defaultStudents, system: defaultStages };
    }
  };

  const saveStages = (data) => {
    localStorage.setItem(stageKey, JSON.stringify(data));
  };

  const getStudentById = (studentId) => {
    const data = loadStages();
    return data.stages.find(s => s.id === studentId) || null;
  };

  const getStudentsByClass = (classId) => {
    const data = loadStages();
    return data.stages.filter(s => s.classId === classId);
  };

  const getStudentsByCourse = (courseId) => {
    const data = loadStages();
    return data.stages.filter(s => s.courseId === courseId);
  };

  const getStudentsByCompany = (companyId) => {
    const data = loadStages();
    return data.stages.filter(s => s.stage.companyId === companyId);
  };

  const getStudentsByPhase = (phaseId) => {
    const data = loadStages();
    return data.stages.filter(s => s.stage.phaseId === phaseId);
  };

  const updateStudentStage = (studentId, stageUpdates) => {
    const data = loadStages();
    const student = data.stages.find(s => s.id === studentId);
    if (student) {
      Object.assign(student.stage, stageUpdates);
      saveStages(data);
      return student;
    }
    return null;
  };

  const addEvaluation = (studentId, evaluation) => {
    const data = loadStages();
    const student = data.stages.find(s => s.id === studentId);
    if (student) {
      student.evaluations.push({ ...evaluation, date: new Date() });
      saveStages(data);
      return student;
    }
    return null;
  };

  const getCourseById = (courseId) => {
    const data = loadStages();
    return data.system.courses.find(c => c.id === courseId);
  };

  const getCompanyById = (companyId) => {
    const data = loadStages();
    return data.system.companies.find(c => c.id === companyId);
  };

  const getPhaseById = (phaseId) => {
    const data = loadStages();
    return data.system.stagePhases.find(p => p.id === phaseId);
  };

  const getStatusById = (statusId) => {
    const data = loadStages();
    return data.system.stageStatus.find(s => s.id === statusId);
  };

  const getTutorById = (tutorId) => {
    const data = loadStages();
    return data.system.tutors.find(t => t.id === tutorId);
  };

  const getSystemData = () => {
    const data = loadStages();
    return data.system;
  };

  const getAllStudents = () => {
    const data = loadStages();
    return data.stages;
  };

  return {
    loadStages,
    saveStages,
    getStudentById,
    getStudentsByClass,
    getStudentsByCourse,
    getStudentsByCompany,
    getStudentsByPhase,
    updateStudentStage,
    addEvaluation,
    getCourseById,
    getCompanyById,
    getPhaseById,
    getStatusById,
    getTutorById,
    getSystemData,
    getAllStudents
  };
})();

  root.domains.internship = { stageSystem };
})();
