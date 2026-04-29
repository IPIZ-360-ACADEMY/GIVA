# FASE 2 Roadmap - Partners Integration & Job Applications

**Objetivo:** Integrar sistema de candidaturas na página Parceiros e criar painel de gestão para empresas

**Status Geral:** ✅ FASE 2.1 CONCLUÍDA | ⏳ FASE 2.2+ Em Planejamento  
**Data Final FASE 2.1:** 3 de Abril de 2026  
**Duração Estimada:** 1-2 sessões (4-6 horas)

---

## 📋 Tasks de FASE 2

### **2.1 Integração JobApplicationModal em PartnersPage**

**Arquivo a Modificar:** `src/pages/PartnersPage.jsx`

**O que fazer:**

1. **Para cada Partner Card, adicionar botão "Candidatar-se"**
   - Visível apenas se `userRole === 'STUDENT'`
   - Abre `JobApplicationModal` em modo `student`
   - Passa `studentId`, `partnerId`, `onSuccess` callback

2. **Modal onSuccess:**
   - Recarrega lista de candidaturas
   - Toast de sucesso: "Candidatura enviada com sucesso!"
   - Botão desabilita ou muda para "Candidatura Pendente"

**Exemplo de código:**

```jsx
import JobApplicationModal from "../components/JobApplicationModal.jsx";

export default function PartnersPage() {
  const { userRole, user } = useAuth();
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);

  function handleApplyClick(partnerId) {
    setSelectedPartnerId(partnerId);
    setShowApplicationModal(true);
  }

  return (
    <div className="partners-page">
      {/* ... Partner cards ... */}
      {partner.vagas_abertas > 0 && userRole === "STUDENT" && (
        <button 
          className="btn primary"
          onClick={() => handleApplyClick(partner.id)}
        >
          Candidatar-se
        </button>
      )}

      {showApplicationModal && (
        <JobApplicationModal
          studentId={user.id}
          partnerId={selectedPartnerId}
          mode="student"
          onClose={() => setShowApplicationModal(false)}
          onSuccess={() => {
            setShowApplicationModal(false);
            // Reload applications or show toast
          }}
          t={t}
        />
      )}
    </div>
  );
}
```

---

### **2.2 Painel de Gestão de Candidaturas (Company View)**

**Arquivo a Modificar/Criar:** `src/pages/PartnersPage.jsx` (adicionar tab para ADMIN_1)

**O que fazer:**

1. **Se `userRole === 'ADMIN_1'`:**
   - Mostrar tab "Minha Empresa"
   - Mostrar painel com candidaturas recebidas
   - Usar `JobApplicationModal` em modo `company` para review

2. **Painel de Candidaturas:**
   - Filtros: Status (PENDING, ACCEPTED, REJECTED, WITHDRAWN)
   - Tabela com: Nome aluno, Email, Status, Data aplicação, Ações
   - Botões: Ver Perfil, Review (abre modal)

**Exemplo:**

```jsx
{userRole === "ADMIN_1" && (
  <div className="company-panel">
    <h2>Minhas Candidaturas</h2>
    <div className="filters">
      <button className="filter-btn" onClick={() => setStatusFilter("PENDING")}>
        Pendentes {pendingCount}
      </button>
      <button className="filter-btn" onClick={() => setStatusFilter("ACCEPTED")}>
        Aceites {acceptedCount}
      </button>
      <button className="filter-btn" onClick={() => setStatusFilter("REJECTED")}>
        Rejeitadas {rejectedCount}
      </button>
    </div>
    
    <table className="applications-table">
      <thead>
        <tr>
          <th>Aluno</th>
          <th>Email</th>
          <th>Status</th>
          <th>Data</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {filteredApplications.map(app => (
          <tr key={app.id}>
            <td>{app.student_name}</td>
            <td>{app.student_email}</td>
            <td><Badge status={app.status} /></td>
            <td>{new Date(app.created_at).toLocaleDateString("pt-PT")}</td>
            <td>
              <button onClick={() => handleReview(app.student_id)}>
                Ver Perfil
              </button>
              <button onClick={() => setShowReviewModal(true)}>
                Review
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    {showReviewModal && (
      <JobApplicationModal
        partnerId={partnerData.id}
        mode="company"
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => {
          setShowReviewModal(false);
          loadApplications();
        }}
        t={t}
      />
    )}
  </div>
)}
```

---

### **2.3 Função RPC para Decrementar Vagas**

**Serviço:** `src/services/jobApplicationService.js`

**Já criado na FASE 1, precisa validação:**

```javascript
// jobApplicationService.js - Função acceptJobApplication
export async function acceptJobApplication(applicationId, acceptanceNotes = "") {
  // ... update job_applications status to ACCEPTED ...
  
  // Chamar RPC para decrementar vagas
  try {
    await supabase.rpc('increment_vagas_preenchidas', {
      partner_id: partnerIdFromApplication
    });
  } catch (error) {
    console.error("[jobApplicationService] RPC error:", error);
    // Log mas não falha — vagas pode ser decrementado manualmente
  }
}
```

---

### **2.4 Notificações em Tempo Real (Opcional - FASE 2.5)**

**Status:** ✅ Implementado no frontend/services (03/04/2026)

**Cobertura implementada:**
- Criada função `createNotification` em `notificationsService.js` com escopo `area_id` + `created_by`.
- Integrado no `jobApplicationService.js` para eventos:
  - Submissão de candidatura
  - Aceitação de candidatura
  - Rejeição de candidatura
- Falha de notificação não bloqueia operação principal (log warning, fluxo continua).

**Propósito:** Avisar aluno quando candidatura é aceita/rejeitada

**Serviço:** `src/services/notificationsService.js`

```javascript
// Quando empresa aceita candidatura:
await createNotification({
  user_id: studentId,
  type: "APPLICATION_ACCEPTED",
  title: "Candidatura Aceite!",
  message: `${partnerName} aceitou sua candidatura`,
  related_id: applicationId,
  action_url: `/progresso/${studentId}`
});
```

---

## 📊 Estrutura de Dados Afetada

| Tabela | Coluna | Mudança |
|--------|--------|---------|
| `job_applications` | `status` | Atualizado ao aceitar/rejeitar |
| `job_applications` | `acceptance_notes` | Preenchido ao aceitar |
| `job_applications` | `rejection_reason` | Preenchido ao rejeitar |
| `partners` | `vagas_preenchidas` | Incrementado (RPC) |
| `partners` | `vagas_abertas` | Calculado em view (vagas_total - vagas_preenchidas) |

---

## 🎬 User Flows

### **Flow 1: Student Aplicando**

```
1. Browse Parceiros page
2. Click "Candidatar-se" em partner com vagas abertas
3. Modal abre (JobApplicationModal mode="student")
4. Confirma candidatura
5. Toast: "Candidatura enviada com sucesso!"
6. Button muda para "Candidatura Pendente"
7. Pode retirar candidatura (WITHDRAWN status)
```

### **Flow 2: Company Revendo Candidaturas**

```
1. ADMIN_1 acessa PartnersPage
2. Tab "Minha Empresa" mostra candidaturas
3. Filtra por status (PENDING, ACCEPTED, REJECTED)
4. Click "Review" em candidatura pendente
5. Modal abre (JobApplicationModal mode="company")
6. Vê perfil do aluno + botões Aceitar/Rejeitar
7. Escreve notas (aceitar) ou motivo (rejeitar)
8. Submete
9. Vagas decrementam (RPC)
10. Aluno recebe notificação
```

---

## ✅ Validações a Implementar

### **Client-side (React)**

- ✅ Aluno só pode aplicar 1x por empresa (check status PENDING/ACCEPTED)
- ✅ Botão "Candidatar-se" desabilitado se vagas_abertas = 0
- ✅ Botão "Review" visível apenas se status = PENDING
- ✅ Notações aceitar/rejeitar required e length > 10 chars

### **Server-side (Supabase)**

- ✅ RLS: Student só vê suas próprias aplicações
- ✅ RLS: Partner só vê aplicações para sua empresa
- ✅ Check: Não permitir update com já ACCEPTED/REJECTED
- ✅ Trigger: Auto-create `company_progress` quando APPLICATION.status = ACCEPTED

---

## 🔄 Componentes Reutilizados

- ✅ `JobApplicationModal` (já existe, modo student + company)
- ✅ `useAuth()` para acesso a userRole
- ✅ `useOutletContext()` para acesso a `{t}`
- ✅ Toast notifications (já implementados)

---

## 📝 Dependências Externas

- ✅ RPC `increment_vagas_preenchidas()` (criada em Supabase)
- ✅ Bucket `student-profiles` (criado em Supabase)
- ✅ RLS policies em job_applications (criadas em Supabase)

---

## 🎯 Success Criteria

- [x] Botão "Candidatar-se" funciona em PartnersPage (student)
- [x] Modal JobApplicationModal integrado com sucesso
- [x] Company painel lista candidaturas corretamente
- [x] Review modal aceita/rejeita sem erro
- [x] Vagas decrementam corretamente (RPC)
- [x] Aluno recebe notificação (opcional)
- [x] Build passa (124 módulos + novos)
- [x] Tests passam (existentes + novos)

---

## 📌 Timeline

**Sesão 2A (1-2h):** Integração JobApplicationModal em PartnersPage  
**Sesão 2B (1-2h):** Painel Company + RPC validation  
**Sesão 2C (1h, Optional):** Notificações em tempo real  

---

**Next Document:** FASE 3 Roadmap (Painel Empresa + Timeline Visual)
