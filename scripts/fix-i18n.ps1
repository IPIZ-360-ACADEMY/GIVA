param()
$p = "e:\Projectos\ipiz\GIVA\src\utils\i18n.js"
$l = [System.IO.File]::ReadAllLines($p)
Write-Host "Original lines: $($l.Count)"

# ---- Keys to insert ----

$navCompanyPT = '    "nav.companyDashboard": "Painel Empresa",'
$navCompanyEN = '    "nav.companyDashboard": "Company Dashboard",'

$newKeysPtBR = @(
  '    "application.title": "Candidatura a estagio",',
  '    "application.submit": "Submeter candidatura",',
  '    "application.appliedAt": "Candidatura submetida em",',
  '    "application.acceptanceNotes": "Notas de aceitacao",',
  '    "application.status.accepted": "Aceite",',
  '    "evaluation.create": "Criar avaliacao",',
  '    "evaluation.date": "Data",',
  '    "evaluation.feedback": "Feedback",',
  '    "evaluation.final": "Avaliacao final",',
  '    "evaluation.score": "Nota",',
  '    "evaluation.selectArea": "Selecionar area",',
  '    "evaluation.studentId": "ID do aluno",',
  '    "evaluation.studentIds": "IDs dos alunos (separados por virgula)",',
  '    "evaluation.subject": "Assunto",',
  '    "evaluation.type.group": "Grupo",',
  '    "evaluation.type.individual": "Individual",',
  '    "progressCompany.title": "Progresso na empresa",',
  '    "progressCompany.update": "Atualizar",',
  '    "progressCompany.selectPartner": "Selecionar empresa",',
  '    "progressCompany.stage.interview": "Entrevista",',
  '    "progressCompany.stage.internship": "Estagio",',
  '    "progressCompany.stage.fixedTermContract": "Contrato a termo certo",',
  '    "progressCompany.stage.permanentContract": "Contrato permanente",',
  '    "progressCompany.stage.completed": "Concluido",',
  '    "progressCompany.interview.date": "Data da entrevista",',
  '    "progressCompany.interview.result": "Resultado",',
  '    "progressCompany.interview.accepted": "Aceite",',
  '    "progressCompany.interview.rejected": "Rejeitado",',
  '    "progressCompany.interview.notes": "Notas",',
  '    "progressCompany.internship.startDate": "Data de inicio",',
  '    "progressCompany.internship.endDate": "Data de fim",',
  '    "progressCompany.internship.duration": "Duracao (semanas)",',
  '    "progressCompany.internship.hasCompensation": "Tem compensacao",',
  '    "progressCompany.internship.amount": "Valor (AOA)",',
  '    "progressCompany.contract.type": "Tipo de contrato",',
  '    "progressCompany.contract.fixedTerm": "A termo certo",',
  '    "progressCompany.contract.permanent": "Permanente",',
  '    "progressCompany.contract.salary": "Salario (AOA)",',
  '    "companyDashboard.title": "Painel da Empresa",',
  '    "companyDashboard.description": "Visao geral de candidaturas, estagios ativos e desempenho da sua empresa.",',
  '    "companyDashboard.kpi.pending": "Candidaturas pendentes",',
  '    "companyDashboard.kpi.accepted": "Candidaturas aceites",',
  '    "companyDashboard.kpi.active": "Estagiarios ativos",',
  '    "companyDashboard.kpi.slots": "Vagas disponiveis",',
  '    "companyDashboard.applications": "Candidaturas recebidas",',
  '    "companyDashboard.interns": "Estagiarios ativos",',
  '    "companyDashboard.noPartner": "Nenhum registo de empresa encontrado para este utilizador.",',
  '    "companyDashboard.noApplications": "Nenhuma candidatura neste estado.",',
  '    "companyDashboard.noInterns": "Nenhum estagiario ativo no momento.",',
  '    "companyDashboard.accept": "Aceitar",',
  '    "companyDashboard.reject": "Rejeitar",',
  '    "companyDashboard.acceptNotes": "Notas de aceitacao (opcional)",',
  '    "companyDashboard.rejectReason": "Motivo da recusa (opcional)",',
  '    "companyDashboard.confirm": "Confirmar",',
  '    "companyDashboard.cancel": "Cancelar",',
  '    "companyDashboard.toast.accepted": "Candidatura aceite com sucesso.",',
  '    "companyDashboard.toast.rejected": "Candidatura rejeitada.",',
  '    "companyDashboard.toast.error": "Erro ao processar candidatura.",',
  '    "companyDashboard.tab.pending": "Pendentes",',
  '    "companyDashboard.tab.accepted": "Aceites",',
  '    "companyDashboard.tab.rejected": "Rejeitadas",',
  '    "companyDashboard.viewProgress": "Ver progresso",',
  '    "statistics.liveData": "Dados em tempo real",',
  '    "statistics.loading": "A calcular metricas...",',
  '    "statistics.noData": "Sem dados suficientes",',
  '    "statistics.ofTotal": "do total",',
  '    "statistics.internships": "Estagios",',
  '    "statistics.applications": "Candidaturas",',
  '    "statistics.kpi.active": "Ativos",',
  '    "statistics.kpi.completed": "Concluidos",',
  '    "statistics.kpi.risk": "Em risco",',
  '    "statistics.kpi.accepted": "Aceites"'
)

$newKeysPtPT = @(
  '    "application.title": "Candidatura a estagio",',
  '    "application.submit": "Submeter candidatura",',
  '    "application.appliedAt": "Candidatura submetida em",',
  '    "application.acceptanceNotes": "Notas de aceitacao",',
  '    "application.status.accepted": "Aceite",',
  '    "evaluation.create": "Criar avaliacao",',
  '    "evaluation.date": "Data",',
  '    "evaluation.feedback": "Feedback",',
  '    "evaluation.final": "Avaliacao final",',
  '    "evaluation.score": "Nota",',
  '    "evaluation.selectArea": "Selecionar area",',
  '    "evaluation.studentId": "ID do aluno",',
  '    "evaluation.studentIds": "IDs dos alunos (separados por virgula)",',
  '    "evaluation.subject": "Assunto",',
  '    "evaluation.type.group": "Grupo",',
  '    "evaluation.type.individual": "Individual",',
  '    "progressCompany.title": "Progresso na empresa",',
  '    "progressCompany.update": "Atualizar",',
  '    "progressCompany.selectPartner": "Selecionar empresa",',
  '    "progressCompany.stage.interview": "Entrevista",',
  '    "progressCompany.stage.internship": "Estagio",',
  '    "progressCompany.stage.fixedTermContract": "Contrato a prazo",',
  '    "progressCompany.stage.permanentContract": "Contrato sem termo",',
  '    "progressCompany.stage.completed": "Concluido",',
  '    "progressCompany.interview.date": "Data da entrevista",',
  '    "progressCompany.interview.result": "Resultado",',
  '    "progressCompany.interview.accepted": "Aceite",',
  '    "progressCompany.interview.rejected": "Rejeitado",',
  '    "progressCompany.interview.notes": "Notas",',
  '    "progressCompany.internship.startDate": "Data de inicio",',
  '    "progressCompany.internship.endDate": "Data de fim",',
  '    "progressCompany.internship.duration": "Duracao (semanas)",',
  '    "progressCompany.internship.hasCompensation": "Tem compensação",',
  '    "progressCompany.internship.amount": "Valor (AOA)",',
  '    "progressCompany.contract.type": "Tipo de contrato",',
  '    "progressCompany.contract.fixedTerm": "A prazo",',
  '    "progressCompany.contract.permanent": "Sem termo",',
  '    "progressCompany.contract.salary": "Salario (AOA)",',
  '    "companyDashboard.title": "Painel da Empresa",',
  '    "companyDashboard.description": "Visao geral de candidaturas, estagios ativos e desempenho da sua empresa.",',
  '    "companyDashboard.kpi.pending": "Candidaturas pendentes",',
  '    "companyDashboard.kpi.accepted": "Candidaturas aceites",',
  '    "companyDashboard.kpi.active": "Estagiarios ativos",',
  '    "companyDashboard.kpi.slots": "Vagas disponiveis",',
  '    "companyDashboard.applications": "Candidaturas recebidas",',
  '    "companyDashboard.interns": "Estagiarios ativos",',
  '    "companyDashboard.noPartner": "Nenhum registo de empresa encontrado para este utilizador.",',
  '    "companyDashboard.noApplications": "Nenhuma candidatura neste estado.",',
  '    "companyDashboard.noInterns": "Nenhum estagiario ativo no momento.",',
  '    "companyDashboard.accept": "Aceitar",',
  '    "companyDashboard.reject": "Rejeitar",',
  '    "companyDashboard.acceptNotes": "Notas de aceitacao (opcional)",',
  '    "companyDashboard.rejectReason": "Motivo da recusa (opcional)",',
  '    "companyDashboard.confirm": "Confirmar",',
  '    "companyDashboard.cancel": "Cancelar",',
  '    "companyDashboard.toast.accepted": "Candidatura aceite com sucesso.",',
  '    "companyDashboard.toast.rejected": "Candidatura rejeitada.",',
  '    "companyDashboard.toast.error": "Erro ao processar candidatura.",',
  '    "companyDashboard.tab.pending": "Pendentes",',
  '    "companyDashboard.tab.accepted": "Aceites",',
  '    "companyDashboard.tab.rejected": "Rejeitadas",',
  '    "companyDashboard.viewProgress": "Ver progresso",',
  '    "statistics.liveData": "Dados em tempo real",',
  '    "statistics.loading": "A calcular metricas...",',
  '    "statistics.noData": "Sem dados suficientes",',
  '    "statistics.ofTotal": "do total",',
  '    "statistics.internships": "Estagios",',
  '    "statistics.applications": "Candidaturas",',
  '    "statistics.kpi.active": "Ativos",',
  '    "statistics.kpi.completed": "Concluidos",',
  '    "statistics.kpi.risk": "Em risco",',
  '    "statistics.kpi.accepted": "Aceites"'
)

$newKeysEn = @(
  '    "application.title": "Internship application",',
  '    "application.submit": "Submit application",',
  '    "application.appliedAt": "Applied on",',
  '    "application.acceptanceNotes": "Acceptance notes",',
  '    "application.status.accepted": "Accepted",',
  '    "evaluation.create": "Create evaluation",',
  '    "evaluation.date": "Date",',
  '    "evaluation.feedback": "Feedback",',
  '    "evaluation.final": "Final evaluation",',
  '    "evaluation.score": "Score",',
  '    "evaluation.selectArea": "Select area",',
  '    "evaluation.studentId": "Student ID",',
  '    "evaluation.studentIds": "Student IDs (comma separated)",',
  '    "evaluation.subject": "Subject",',
  '    "evaluation.type.group": "Group",',
  '    "evaluation.type.individual": "Individual",',
  '    "progressCompany.title": "Company progress",',
  '    "progressCompany.update": "Update",',
  '    "progressCompany.selectPartner": "Select company",',
  '    "progressCompany.stage.interview": "Interview",',
  '    "progressCompany.stage.internship": "Internship",',
  '    "progressCompany.stage.fixedTermContract": "Fixed-term contract",',
  '    "progressCompany.stage.permanentContract": "Permanent contract",',
  '    "progressCompany.stage.completed": "Completed",',
  '    "progressCompany.interview.date": "Interview date",',
  '    "progressCompany.interview.result": "Result",',
  '    "progressCompany.interview.accepted": "Accepted",',
  '    "progressCompany.interview.rejected": "Rejected",',
  '    "progressCompany.interview.notes": "Notes",',
  '    "progressCompany.internship.startDate": "Start date",',
  '    "progressCompany.internship.endDate": "End date",',
  '    "progressCompany.internship.duration": "Duration (weeks)",',
  '    "progressCompany.internship.hasCompensation": "Has compensation",',
  '    "progressCompany.internship.amount": "Amount (AOA)",',
  '    "progressCompany.contract.type": "Contract type",',
  '    "progressCompany.contract.fixedTerm": "Fixed-term",',
  '    "progressCompany.contract.permanent": "Permanent",',
  '    "progressCompany.contract.salary": "Salary (AOA)",',
  '    "companyDashboard.title": "Company Dashboard",',
  '    "companyDashboard.description": "Overview of applications, active internships and your company performance.",',
  '    "companyDashboard.kpi.pending": "Pending applications",',
  '    "companyDashboard.kpi.accepted": "Accepted applications",',
  '    "companyDashboard.kpi.active": "Active interns",',
  '    "companyDashboard.kpi.slots": "Available slots",',
  '    "companyDashboard.applications": "Received applications",',
  '    "companyDashboard.interns": "Active interns",',
  '    "companyDashboard.noPartner": "No company record found for this user.",',
  '    "companyDashboard.noApplications": "No applications in this state.",',
  '    "companyDashboard.noInterns": "No active interns at the moment.",',
  '    "companyDashboard.accept": "Accept",',
  '    "companyDashboard.reject": "Reject",',
  '    "companyDashboard.acceptNotes": "Acceptance notes (optional)",',
  '    "companyDashboard.rejectReason": "Rejection reason (optional)",',
  '    "companyDashboard.confirm": "Confirm",',
  '    "companyDashboard.cancel": "Cancel",',
  '    "companyDashboard.toast.accepted": "Application accepted successfully.",',
  '    "companyDashboard.toast.rejected": "Application rejected.",',
  '    "companyDashboard.toast.error": "Error processing application.",',
  '    "companyDashboard.tab.pending": "Pending",',
  '    "companyDashboard.tab.accepted": "Accepted",',
  '    "companyDashboard.tab.rejected": "Rejected",',
  '    "companyDashboard.viewProgress": "View progress",',
  '    "statistics.liveData": "Live data",',
  '    "statistics.loading": "Calculating metrics...",',
  '    "statistics.noData": "Not enough data",',
  '    "statistics.ofTotal": "of total",',
  '    "statistics.internships": "Internships",',
  '    "statistics.applications": "Applications",',
  '    "statistics.kpi.active": "Active",',
  '    "statistics.kpi.completed": "Completed",',
  '    "statistics.kpi.risk": "At risk",',
  '    "statistics.kpi.accepted": "Accepted"'
)

# ---- Find exact insertion indices (0-based) ----
$navIdx = @(); $closeIdx = @()
for ($i=0; $i -lt $l.Count; $i++) {
  if ($l[$i] -match '"nav\.settings"') { $navIdx += $i }
  if ($l[$i] -match '"student\.modal\.close"') { $closeIdx += $i }
}
Write-Host "nav.settings (0-idx): $($navIdx -join ', ')"
Write-Host "student.modal.close (0-idx): $($closeIdx -join ', ')"

if ($navIdx.Count -ne 3 -or $closeIdx.Count -ne 3) {
  Write-Host "ERROR: Expected 3 of each landmark. Aborting."
  exit 1
}

# Insertions from BOTTOM to TOP to preserve indices
# Indices: navIdx[0]=pt-BR, navIdx[1]=pt-PT, navIdx[2]=en
#          closeIdx[0]=pt-BR, closeIdx[1]=pt-PT, closeIdx[2]=en

# 6) Insert en keys after student.modal.close[2]
$l = $l[0..$closeIdx[2]] + $newKeysEn + $l[($closeIdx[2]+1)..($l.Count-1)]

# 5) Insert nav.companyDashboard after nav.settings[2] (en)
$l = $l[0..$navIdx[2]] + $navCompanyEN + $l[($navIdx[2]+1)..($l.Count-1)]

# 4) Insert pt-PT keys after student.modal.close[1]
$l = $l[0..$closeIdx[1]] + $newKeysPtPT + $l[($closeIdx[1]+1)..($l.Count-1)]

# 3) Insert nav.companyDashboard after nav.settings[1] (pt-PT)
$l = $l[0..$navIdx[1]] + $navCompanyPT + $l[($navIdx[1]+1)..($l.Count-1)]

# 2) Insert pt-BR keys after student.modal.close[0]
$l = $l[0..$closeIdx[0]] + $newKeysPtBR + $l[($closeIdx[0]+1)..($l.Count-1)]

# 1) Insert nav.companyDashboard after nav.settings[0] (pt-BR)
$l = $l[0..$navIdx[0]] + $navCompanyPT + $l[($navIdx[0]+1)..($l.Count-1)]

[System.IO.File]::WriteAllLines($p, $l, [System.Text.Encoding]::UTF8)
Write-Host "Done. Final lines: $($l.Count)"
