(() => {
  const currentRoute = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (currentRoute !== "avaliacoes.html") return;

  const boot = () => {
    const stageSystem = window.GIVA?.domains?.internship?.stageSystem;
    const showToast = window.GIVA?.domains?.ux?.showToast || ((message) => console.log(message));
    if (!stageSystem) return;

    const systemData = stageSystem.getSystemData();
    const allStudents = stageSystem.getAllStudents();

    const populateFilters = () => {
      const courseSelect = document.getElementById("filter-course");
      systemData.courses.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        courseSelect.appendChild(opt);
      });

      const classSelect = document.getElementById("filter-class");
      systemData.classes.forEach((cl) => {
        const course = systemData.courses.find((c) => c.id === cl.courseId);
        const opt = document.createElement("option");
        opt.value = cl.id;
        opt.textContent = `${course?.short || "?"} - Turma ${cl.section}`;
        classSelect.appendChild(opt);
      });

      const companySelect = document.getElementById("filter-company");
      systemData.companies.forEach((co) => {
        const opt = document.createElement("option");
        opt.value = co.id;
        opt.textContent = co.name;
        companySelect.appendChild(opt);
      });

      const statusSelect = document.getElementById("filter-status");
      systemData.stageStatus.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st.id;
        opt.textContent = st.name;
        statusSelect.appendChild(opt);
      });

      const evalStudentSelect = document.getElementById("eval-student");
      allStudents.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.matricula})`;
        evalStudentSelect.appendChild(opt);
      });
    };

    const renderEvaluationsTable = (filtered = allStudents) => {
      const tbody = document.getElementById("evaluations-table");
      if (filtered.length === 0) {
        tbody.innerHTML = "<tr><td colspan=\"8\" class=\"eval-empty-cell\">Nenhum aluno encontrado com os filtros aplicados.</td></tr>";
        return;
      }

      tbody.innerHTML = filtered
        .map((s) => {
          const course = systemData.courses.find((c) => c.id === s.courseId);
          const company = systemData.companies.find((c) => c.id === s.stage.companyId);
          const phase = systemData.stagePhases.find((p) => p.id === s.stage.phaseId);
          const tutor = systemData.tutors.find((t) => t.id === s.stage.tutorId);
          const evalCount = (s.evaluations || []).length;

          return `
            <tr data-search="${s.name.toLowerCase()} ${course?.short || ""} ${company?.name || ""}">
              <td><strong>${s.name}</strong></td>
              <td>${s.matricula}</td>
              <td>${s.classId}</td>
              <td>${company?.name || "--"}</td>
              <td><span class="material-icons-sharp eval-phase-icon">${phase?.icon || "info"}</span> ${phase?.name || "--"}</td>
              <td>${tutor?.name.split(" ")[0] || "--"}</td>
              <td>
                <span class="badge eval-count-badge ${evalCount > 0 ? "eval-count-ok" : ""}">
                  <span class="material-icons-sharp eval-count-icon">${evalCount > 0 ? "check_circle" : "radio_button_unchecked"}</span>
                  ${evalCount} ${evalCount === 1 ? "avaliacao" : "avaliacoes"}
                </span>
              </td>
              <td>
                <button class="btn ghost eval-view-student-btn" type="button" data-student-id="${s.id}">
                  <span class="material-icons-sharp">person</span> Ver
                </button>
              </td>
            </tr>
          `;
        })
        .join("");
    };

    document.getElementById("evaluations-table")?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest(".eval-view-student-btn");
      if (!button) return;
      const studentId = button.getAttribute("data-student-id");
      if (studentId) {
        document.location.href = `alumno.html?id=${studentId}`;
      }
    });

    document.getElementById("btn-apply-filters")?.addEventListener("click", () => {
      const courseFilter = document.getElementById("filter-course").value;
      const classFilter = document.getElementById("filter-class").value;
      const companyFilter = document.getElementById("filter-company").value;
      const statusFilter = document.getElementById("filter-status").value;

      let filtered = allStudents;
      if (courseFilter) filtered = filtered.filter((s) => s.courseId === courseFilter);
      if (classFilter) filtered = filtered.filter((s) => s.classId === classFilter);
      if (companyFilter) filtered = filtered.filter((s) => s.stage.companyId === companyFilter);
      if (statusFilter) filtered = filtered.filter((s) => s.stage.statusId === statusFilter);

      renderEvaluationsTable(filtered);
      showToast(`${filtered.length} alunos encontrados`, "info", "done");
    });

    document.getElementById("btn-add-evaluation")?.addEventListener("click", () => {
      document.getElementById("evaluation-form-section").classList.remove("is-hidden");
      document.querySelector("form")?.scrollIntoView({ behavior: "smooth" });
    });

    document.getElementById("btn-cancel-form")?.addEventListener("click", () => {
      document.getElementById("evaluation-form-section").classList.add("is-hidden");
      document.getElementById("evaluation-form").reset();
    });

    document.getElementById("evaluation-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const studentId = document.getElementById("eval-student").value;
      const evaluation = {
        tutorId: document.getElementById("eval-evaluator-type").value === "tutor" ? "auto" : null,
        companySupervisor: document.getElementById("eval-evaluator-type").value === "company" ? "Supervisor Empresa" : null,
        score: parseFloat(document.getElementById("eval-score").value),
        feedback: document.getElementById("eval-feedback").value,
        behaviors: {
          commitment: document.getElementById("eval-commitment").checked,
          teamwork: document.getElementById("eval-teamwork").checked,
          punctuality: document.getElementById("eval-punctuality").checked,
          proactivity: document.getElementById("eval-proactivity").checked,
          communication: document.getElementById("eval-communication").checked,
        },
      };

      stageSystem.addEvaluation(studentId, evaluation);
      showToast("Avaliacao registada com sucesso", "success", "check_circle");
      document.getElementById("evaluation-form-section").classList.add("is-hidden");
      document.getElementById("evaluation-form").reset();
      renderEvaluationsTable();
      renderEvaluationHistory();
    });

    const renderEvaluationHistory = () => {
      const historyDiv = document.getElementById("evaluation-history");
      const allEvals = [];

      allStudents.forEach((s) => {
        (s.evaluations || []).forEach((e) => {
          allEvals.push({ student: s, evaluation: e });
        });
      });

      allEvals.sort((a, b) => new Date(b.evaluation.date) - new Date(a.evaluation.date));

      if (allEvals.length === 0) {
        historyDiv.innerHTML = "<p class=\"eval-history-empty\">Nenhuma avaliacao registada.</p>";
        return;
      }

      historyDiv.innerHTML = allEvals
        .slice(0, 20)
        .map((item) => {
          const { student, evaluation } = item;
          const stars = "★".repeat(Math.round(evaluation.score)) + "☆".repeat(5 - Math.round(evaluation.score));
          return `
            <div class="eval-history-card">
              <div class="eval-history-card-header">
                <div>
                  <strong>${student.name}</strong>
                  <small class="eval-history-sub">${student.matricula}</small>
                </div>
                <span class="eval-history-stars">${stars}</span>
              </div>
              <p>${evaluation.feedback}</p>
              <small class="eval-history-date">${new Date(evaluation.date).toLocaleDateString("pt-BR")} • ${evaluation.tutorId ? "Tutor" : "Supervisor Empresa"}</small>
            </div>
          `;
        })
        .join("");
    };

    populateFilters();
    renderEvaluationsTable();
    renderEvaluationHistory();
  };

  if (window.GIVA?.domains?.internship?.stageSystem) {
    boot();
  } else {
    window.addEventListener("giva:ready", boot, { once: true });
  }
})();
