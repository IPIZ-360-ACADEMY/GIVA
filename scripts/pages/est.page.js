(() => {
  const currentRoute = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (currentRoute !== "est.html") return;

  const boot = () => {
    const stageSystem = window.GIVA?.domains?.internship?.stageSystem;
    const showToast = window.GIVA?.domains?.ux?.showToast || ((message) => console.log(message));
    if (!stageSystem) return;

    const systemData = stageSystem.getSystemData();
    let allStudents = stageSystem.getAllStudents();

    const initDashboard = () => {
      populateFilters();
      renderMetrics();
      renderClassDashboard();
      renderStudentsTable();
      renderPerformanceAnalysis();
    };

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
        opt.textContent = `${course?.short} - Turma ${cl.section} (${cl.supervisor})`;
        classSelect.appendChild(opt);
      });

      const companySelect = document.getElementById("filter-company");
      systemData.companies.forEach((co) => {
        const opt = document.createElement("option");
        opt.value = co.id;
        opt.textContent = co.name;
        companySelect.appendChild(opt);
      });

      const phaseSelect = document.getElementById("filter-phase");
      systemData.stagePhases.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        phaseSelect.appendChild(opt);
      });

      const statusSelect = document.getElementById("filter-status");
      systemData.stageStatus.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st.id;
        opt.textContent = st.name;
        statusSelect.appendChild(opt);
      });
    };

    const renderMetrics = () => {
      const phases = systemData.stagePhases;
      document.getElementById("total-students").textContent = allStudents.length;
      document.getElementById("active-stages").textContent = allStudents.filter((s) => s.stage.statusId === "inprogress").length;
      document.getElementById("active-companies").textContent = new Set(allStudents.map((s) => s.stage.companyId)).size;

      phases.forEach((p) => {
        const count = allStudents.filter((s) => s.stage.phaseId === p.id).length;
        const el = document.getElementById(`metric-${p.id}`);
        if (el) el.textContent = count;
      });
    };

    const getCourseColorClass = (courseId) => `internship-course-${courseId || "default"}`;
    const getStatusClass = (statusId) => `internship-status-${statusId || "default"}`;
    const getPerfClass = (avgPerf) => {
      if (avgPerf >= 4.5) return "internship-perf-excellent";
      if (avgPerf >= 3.5) return "internship-perf-good";
      if (avgPerf >= 2.5) return "internship-perf-regular";
      return "internship-perf-weak";
    };
    const getEvaluationClass = (evalCount) => (evalCount > 0 ? "internship-eval-ok" : "internship-eval-empty");

    const renderClassDashboard = () => {
      const classDashDiv = document.getElementById("class-dashboard");
      const courses = systemData.courses;

      classDashDiv.innerHTML = courses.map((course) => {
        const classes = systemData.classes.filter((cl) => cl.courseId === course.id);
        const courseStudents = allStudents.filter((s) => s.courseId === course.id);
        const activeCount = courseStudents.filter((s) => s.stage.statusId === "inprogress").length;
        const completedCount = courseStudents.filter((s) => s.stage.statusId === "completed").length;

        const courseColorClass = getCourseColorClass(course.id);
        return `
            <div class="internship-course-card ${courseColorClass}">
              <div class="internship-course-header">
                <div>
                  <strong class="internship-course-title">${course.name}</strong>
                  <p class="internship-course-summary">${courseStudents.length} alunos  ${activeCount} ativos  ${completedCount} concluidos</p>
                </div>
                <div class="internship-course-badges">
                  ${classes.map((cl) => {
                    const classStudents = courseStudents.filter((s) => s.classId === cl.id);
                    return `<span class="badge internship-course-badge ${courseColorClass}">${cl.section} (${classStudents.length})</span>`;
                  }).join("")}
                </div>
              </div>
              <div class="internship-class-grid">
                ${classes.map((cl) => {
                  const classStudents = courseStudents.filter((s) => s.classId === cl.id);
                  return `
                    <div class="internship-class-card">
                      <p class="internship-class-label">Turma ${cl.section}</p>
                      <p class="internship-class-total">${classStudents.length} alunos</p>
                      <p class="internship-class-supervisor">Supervisor: ${cl.supervisor}</p>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `;
      }).join("");
    };

    const renderStudentsTable = (filtered = allStudents) => {
      const tbody = document.getElementById("students-table");

      if (filtered.length === 0) {
        tbody.innerHTML = "<tr><td colspan=\"10\" class=\"internship-empty-state\">Nenhum aluno encontrado com os filtros aplicados.<\/td><\/tr>";
        return;
      }

      tbody.innerHTML = filtered.map((s) => {
        const course = systemData.courses.find((c) => c.id === s.courseId);
        const company = systemData.companies.find((c) => c.id === s.stage.companyId);
        const phase = systemData.stagePhases.find((p) => p.id === s.stage.phaseId);
        const status = systemData.stageStatus.find((st) => st.id === s.stage.statusId);
        const avgPerf = ((s.performance.attendance / 100) * 2 + s.performance.engagement * 1.5 + s.performance.compliance * 1.5) / 5;
        const evalCount = (s.evaluations || []).length;
        const statusClass = getStatusClass(status?.id);
        const perfClass = getPerfClass(avgPerf);
        const evalClass = getEvaluationClass(evalCount);

        return `
            <tr data-search="${s.name.toLowerCase()} ${course?.short} ${company?.name}">
              <td>
                <strong>${s.name}</strong>
                <br><small class="internship-muted-small">${course?.short}<\/small>
              <\/td>
              <td><code class="internship-code">${s.matricula}<\/code><\/td>
              <td>${s.classId}<\/td>
              <td><strong>${company?.name || "--"}<\/strong><\/td>
              <td>${company?.areas[s.stage.areaId] || "--"}<\/td>
              <td>
                <span class="phase-badge phase-${s.stage.phaseId}">
                  <span class="material-icons-sharp internship-phase-icon">${phase?.icon || "info"}<\/span>
                  ${phase?.name?.substring(0, 12) || "--"}
                <\/span>
              <\/td>
              <td><span class="badge internship-status-badge ${statusClass}">${status?.name || "--"}<\/span><\/td>
              <td>
                <div class="internship-perf-value ${perfClass}">●<\/div>
                <small class="internship-muted-small">${avgPerf.toFixed(1)}\/5<\/small>
              <\/td>
              <td>
                <span class="badge internship-eval-badge ${evalClass}">
                  <span class="material-icons-sharp internship-eval-icon">${evalCount > 0 ? "check_circle" : "radio_button_unchecked"}<\/span>
                  ${evalCount}
                <\/span>
              <\/td>
              <td class="internship-actions-cell">
                <a href="alumno.html?id=${s.id}" class="btn ghost internship-row-link">
                  <span class="material-icons-sharp">person<\/span> Ver
                <\/a>
              <\/td>
            <\/tr>
          `;
      }).join("");
    };

    document.getElementById("btn-apply-filters")?.addEventListener("click", () => {
      const courseFilter = document.getElementById("filter-course").value;
      const classFilter = document.getElementById("filter-class").value;
      const companyFilter = document.getElementById("filter-company").value;
      const phaseFilter = document.getElementById("filter-phase").value;
      const statusFilter = document.getElementById("filter-status").value;
      const perfFilter = document.getElementById("filter-performance").value;

      let filtered = allStudents;
      if (courseFilter) filtered = filtered.filter((s) => s.courseId === courseFilter);
      if (classFilter) filtered = filtered.filter((s) => s.classId === classFilter);
      if (companyFilter) filtered = filtered.filter((s) => s.stage.companyId === companyFilter);
      if (phaseFilter) filtered = filtered.filter((s) => s.stage.phaseId === phaseFilter);
      if (statusFilter) filtered = filtered.filter((s) => s.stage.statusId === statusFilter);
      if (perfFilter) {
        filtered = filtered.filter((s) => {
          const avgPerf = ((s.performance.attendance / 100) * 2 + s.performance.engagement * 1.5 + s.performance.compliance * 1.5) / 5;
          if (perfFilter === "excellent") return avgPerf >= 4.5;
          if (perfFilter === "good") return avgPerf >= 3.5 && avgPerf < 4.5;
          if (perfFilter === "satisfactory") return avgPerf >= 2.5 && avgPerf < 3.5;
          if (perfFilter === "weak") return avgPerf < 2.5;
          return true;
        });
      }

      renderStudentsTable(filtered);
      showToast(`${filtered.length} alunos encontrados`, "info", "done");
    });

    document.getElementById("btn-clear-filters")?.addEventListener("click", () => {
      document.getElementById("filter-course").value = "";
      document.getElementById("filter-class").value = "";
      document.getElementById("filter-company").value = "";
      document.getElementById("filter-phase").value = "";
      document.getElementById("filter-status").value = "";
      document.getElementById("filter-performance").value = "";
      renderStudentsTable();
      showToast("Filtros limpos", "info", "done");
    });

    document.getElementById("btn-export-report")?.addEventListener("click", () => {
      showToast("Relatorio em preparacao para download", "info", "download");
    });

    const renderPerformanceAnalysis = () => {
      const total = allStudents.length;
      if (total === 0) return;

      const avgAttendance = Math.round(allStudents.reduce((sum, s) => sum + s.performance.attendance, 0) / total);
      const avgEngagement = (allStudents.reduce((sum, s) => sum + s.performance.engagement, 0) / total).toFixed(1);
      const avgCompliance = (allStudents.reduce((sum, s) => sum + s.performance.compliance, 0) / total).toFixed(1);
      const completionRate = Math.round((allStudents.filter((s) => s.stage.statusId === "completed").length / total) * 100);

      document.getElementById("avg-attendance").textContent = `${avgAttendance}%`;
      document.getElementById("avg-engagement").textContent = `${avgEngagement}/5`;
      document.getElementById("avg-compliance").textContent = `${avgCompliance}/5`;
      document.getElementById("completion-rate").textContent = `${completionRate}%`;
    };

    initDashboard();
  };

  if (window.GIVA?.domains?.internship?.stageSystem) {
    boot();
  } else {
    window.addEventListener("giva:ready", boot, { once: true });
  }
})();
