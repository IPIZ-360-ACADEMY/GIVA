(() => {
  const currentRoute = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (currentRoute !== "alumno.html") return;

  const boot = () => {
    const stageSystem = window.GIVA?.domains?.internship?.stageSystem;
    const showModal = window.GIVA?.domains?.ux?.showModal || ((title, message) => alert(`${title}: ${message}`));
    if (!stageSystem) return;

    const getStudentId = () => {
      const url = new URL(window.location.href);
      return url.searchParams.get("id");
    };

    const renderStudentDetails = () => {
      const studentId = getStudentId();
      if (!studentId) {
        window.location.href = "est.html";
        return;
      }

      const student = stageSystem.getStudentById(studentId);
      if (!student) {
        showModal("Aluno nao encontrado", "O ID do aluno nao foi localizado no sistema.", "danger", "error");
        setTimeout(() => {
          window.location.href = "est.html";
        }, 2500);
        return;
      }

      const course = stageSystem.getCourseById(student.courseId);
      const company = stageSystem.getCompanyById(student.stage.companyId);
      const phase = stageSystem.getPhaseById(student.stage.phaseId);
      const status = stageSystem.getStatusById(student.stage.statusId);
      const tutor = stageSystem.getTutorById(student.stage.tutorId);

      document.getElementById("student-name").textContent = student.name;
      document.getElementById("student-subtitle").textContent = `${course?.name || "--"} • ${student.matricula}`;
      document.getElementById("student-id").textContent = student.matricula;
      document.getElementById("student-email").textContent = student.email;
      document.getElementById("student-phone").textContent = student.phone;
      document.getElementById("student-course").textContent = course?.name || "--";
      document.getElementById("student-class").textContent = student.classId;
      document.getElementById("student-supervisor").textContent = student.stage.supervisor;

      const perf = student.performance;
      document.getElementById("attend-value").textContent = `${perf.attendance}%`;
      document.getElementById("attend-bar").style.width = `${perf.attendance}%`;
      document.getElementById("engage-value").textContent = `${perf.engagement.toFixed(1)}/5`;
      document.getElementById("engage-bar").style.width = `${(perf.engagement / 5) * 100}%`;
      document.getElementById("comply-value").textContent = `${perf.compliance.toFixed(1)}/5`;
      document.getElementById("comply-bar").style.width = `${(perf.compliance / 5) * 100}%`;

      document.getElementById("stage-company").textContent = company?.name || "--";
      document.getElementById("stage-area").textContent = company?.areas[student.stage.areaId] || "--";
      document.getElementById("stage-start").textContent = new Date(student.stage.startDate).toLocaleDateString("pt-BR");
      document.getElementById("stage-end").textContent = new Date(student.stage.expectedEndDate).toLocaleDateString("pt-BR");
      const statusBadge = document.getElementById("stage-status");
      statusBadge.textContent = status?.name || "--";
      statusBadge.className = `badge internship-status-badge internship-status-${status?.id || "default"}`;
      document.getElementById("stage-phase").innerHTML = `<span class=\"material-icons-sharp alumno-phase-icon\">${phase?.icon || "info"}</span> ${phase?.name || "--"}`;

      const knowledgeContainer = document.getElementById("knowledge-tags");
      knowledgeContainer.innerHTML = student.stage.knowledgeFocus
        .map((k) => `<span class=\"tag\"><span class=\"material-icons-sharp\">check_circle</span>${k}</span>`)
        .join("");

      document.getElementById("tutor-name").textContent = tutor?.name || "--";
      document.getElementById("tutor-email").textContent = tutor?.email || "--";
      document.getElementById("tutor-expertise").textContent = (tutor?.expertise || []).join(", ") || "--";

      const evals = student.evaluations || [];
      const evalsContainer = document.getElementById("evaluations-container");
      if (evals.length === 0) {
        evalsContainer.innerHTML = "<p class=\"alumno-eval-empty\">Nenhuma avaliacao registada ainda.</p>";
      } else {
        evalsContainer.innerHTML = evals
          .map((e) => `
              <div class=\"alumno-eval-card\">
                <div class=\"alumno-eval-card-header\">
                  <strong>${e.tutorId ? "Avaliacao do Tutor" : e.companySupervisor ? "Feedback do Supervisor da Empresa" : "Avaliacao"}</strong>
                  <span class=\"badge alumno-eval-score\">${e.score}/5</span>
                </div>
                <p>${e.feedback}</p>
                <small class=\"alumno-eval-date\">${new Date(e.date).toLocaleDateString("pt-BR")}</small>
              </div>
            `)
          .join("");
      }

      const timelineContainer = document.getElementById("timeline");
      const phases = stageSystem.getSystemData().stagePhases;
      timelineContainer.innerHTML = phases
        .map((p) => {
          const isActive = p.id === student.stage.phaseId;
          const isCompleted = phases.findIndex((x) => x.id === student.stage.phaseId) > phases.findIndex((x) => x.id === p.id);
          return `
              <div class=\"alumno-timeline-item ${isActive ? "is-active" : isCompleted ? "is-done" : "is-pending"}\">
                <div class=\"alumno-timeline-dot ${isActive ? "is-active" : isCompleted ? "is-done" : ""}\">
                  <span class=\"material-icons-sharp\">${isCompleted || isActive ? p.icon : "schedule"}</span>
                </div>
                <div>
                  <p class=\"alumno-timeline-phase\">${p.name}</p>
                  <p class=\"alumno-timeline-status\">${isActive ? "Fase atual" : isCompleted ? "Concluida" : "Aguardando"}</p>
                </div>
              </div>
            `;
        })
        .join("");
    };

    document.getElementById("add-evaluation-btn")?.addEventListener("click", () => {
      showModal(
        "Nova Avaliacao",
        "Esta funcionalidade sera ativada quando a pagina de avaliacoes for integrada. Acesse 'Avaliacoes' no menu principal.",
        "info",
        "assessment"
      );
    });

    renderStudentDetails();
  };

  if (window.GIVA?.domains?.internship?.stageSystem) {
    boot();
  } else {
    window.addEventListener("giva:ready", boot, { once: true });
  }
})();
