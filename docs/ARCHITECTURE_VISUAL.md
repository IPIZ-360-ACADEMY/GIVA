# GIVA Sistema - Arquitetura Visual FASE 1

**Visão Geral do Sistema GIVA com Áreas de Formação, Avaliações, Candidaturas e Progresso**

---

## 📐 Arquitetura de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                        GIVA SUPABASE DATABASE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐      ┌──────────────────────┐         │
│  │   training_area      │      │      courses         │         │
│  ├──────────────────────┤      ├──────────────────────┤         │
│  │ id (UUID)            │◄─────│ id (UUID)            │         │
│  │ code (TEXT)          │      │ training_area_id (FK)│         │
│  │ name (TEXT)          │      │ code (TEXT)          │         │
│  │ color_hex (TEXT)     │      │ name (TEXT)          │         │
│  │ icon_name (TEXT)     │      │ description (TEXT)   │         │
│  │ display_order (INT)  │      │ is_active (BOOLEAN)  │         │
│  │ is_active (BOOLEAN)  │      └──────────────────────┘         │
│  │ created_at/updated_at│                                        │
│  └──────────────────────┘                                        │
│           ▲                                                       │
│           │                                                       │
│           │ belongs to                                           │
│           │                                                       │
│  ┌────────┴──────────────────┐                                   │
│  │      students (expandido) │                                   │
│  ├──────────────────────────┤                                    │
│  │ id (UUID)                │                                    │
│  │ email (TEXT)             │                                    │
│  │ full_name (TEXT)         │──────┐                             │
│  │ training_area_id (FK) ───┼──────┘ links to training_area     │
│  │ course_id (FK) ───────┐  │                                    │
│  │ phone (TEXT)          │  ├─ NEW: Perfil Expandido            │
│  │ address (TEXT)        │  │  - profile_photo_url              │
│  │ city (TEXT)           │  │  - professional_summary            │
│  │ postal_code (TEXT)    │  │  - bio (TEXT)                     │
│  │ profile_photo_url     │  │  - skills (ARRAY)                 │
│  │ professional_summary  │  │  - languages (ARRAY)              │
│  │ bio (TEXT)            │  │  - portfolio_url (TEXT)           │
│  │ skills (ARRAY)        │  │  - linkedin_url (TEXT)            │
│  │ languages (ARRAY)     │  │  - status (ENUM)                  │
│  │ portfolio_url (TEXT)  │  │                                    │
│  │ linkedin_url (TEXT)   │  │                                    │
│  │ status ('ACTIVE'...)  │  └─────────────────────              │
│  │ created_at/updated_at │                                       │
│  └──────────────────────┘                                        │
│           ▲                                                       │
│           │                                                       │
│           ├─────────────┬──────────────┬───────────────┐         │
│           │             │              │               │         │
│  ┌────────┴────┐  ┌─────┴────┐  ┌─────┴──────┐  ┌────┴────────┐ │
│  │  student_   │  │job_      │  │company_    │  │evaluations │ │
│  │portfolio    │  │applicat. │  │progress    │  │            │ │
│  ├─────────────┤  ├──────────┤  ├────────────┤  ├────────────┤ │
│  │id (UUID)    │  │id (UUID) │  │id (UUID)   │  │id (UUID)   │ │
│  │student_id   │  │student_id│  │student_id  │  │student_id  │ │
│  │type (ENUM)  │  │partner_id│  │partner_id  │  │training_   │ │
│  │title        │  │status    │  │progression │  │area_id     │ │
│  │description  │  │notes     │  │_stage      │  │type:       │ │
│  │organization │  │created_at│  │interview_* │  │INDIVIDUAL/ │ │
│  │url          │  │updated_at│  │internship_ │  │GROUP       │ │
│  │image_url    │  │          │  │*            │  │score(0-20) │ │
│  │tags (ARRAY) │  │          │  │contract_*  │  │feedback    │ │
│  │is_featured  │  │          │  │contact_*   │  │evaluation_ │ │
│  │created_at   │  │          │  │assessments │  │date        │ │
│  │updated_at   │  │          │  │completed_at│  │is_final    │ │
│  └──────────────┘  │          │  │created_at  │  │created_at  │ │
│                    │          │  │updated_at  │  │updated_at  │ │
│                    └──────────┘  └────────────┘  └────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ALL TABLES: ALTER TABLE {name} ADD COLUMN updated_at WHEN? │ │
│ │ TRIGGER: update_updated_at_column() fires BEFORE UPDATE    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 User Roles & Permissions

```
┌───────────────────────────────────────────────────────┐
│                   AUTHENTICATION                       │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Supabase Auth (email/password)                       │
│       │                                               │
│       ├─ STUDENT (role_id = 'student')                │
│       │  ├─ READ: training_areas, courses             │
│       │  ├─ READ/WRITE: own student profile            │
│       │  ├─ CREATE: job_applications                   │
│       │  ├─ READ: evaluations (own)                    │
│       │  └─ READ: company_progress (own internship)    │
│       │                                               │
│       ├─ PROFESSOR (role_id = 'professor')             │
│       │  ├─ CREATE/EDIT: training_areas, courses       │
│       │  ├─ CREATE: evaluations (individual/group)     │
│       │  ├─ READ: evaluations, student grades          │
│       │  └─ EXPORT: CSV evaluations report             │
│       │                                               │
│       ├─ ADMIN_1 (role_id = 'admin_company')           │
│       │  ├─ MANAGE: own company (partners row)         │
│       │  ├─ READ: job_applications (incoming)          │
│       │  ├─ ACCEPT/REJECT: applications                │
│       │  ├─ CREATE: company_progress (internship)      │
│       │  ├─ UPDATE: interview/internship/contract      │
│       │  └─ NOTIFY: aluno status changes               │
│       │                                               │
│       └─ ADMIN_PLATFORM (future)                       │
│          └─ Full access to all resources              │
│                                                        │
└───────────────────────────────────────────────────────┘
```

---

## 🗺️ Navigation Map

```
┌─────────────────────────────────────────────────────────────────┐
│                         GIVA NAVIGATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  STUDENT VIEW                    PROFESSOR VIEW                  │
│  ┌──────────────────────┐        ┌──────────────────────┐       │
│  │ Dashboard            │        │ Dashboard            │       │
│  │ ├─ Resumo            │        │ ├─ Turmas            │       │
│  │ └─ Notificações      │        │ └─ Desempenho        │       │
│  │                      │        │                      │       │
│  │ Áreas de Formação    │        │ Áreas de Formação    │       │
│  │ ├─ Cards coloridos   │        │ ├─ Criar/editar      │       │
│  │ ├─ Listar cursos     │        │ └─ Ver alunos        │       │
│  │ └─ Ver skills req.   │        │                      │       │
│  │                      │        │ Avaliações           │       │
│  │ Parceiros (Empresas) │        │ ├─ Individual        │       │
│  │ ├─ Listar com vagas  │        │ ├─ Grupo             │       │
│  │ ├─ Candidatar-se (✨)│        │ ├─ Média/Turma       │       │
│  │ └─ Ver vagas         │        │ └─ Export CSV        │       │
│  │                      │        │                      │       │
│  │ Meu Progresso (✨)   │        │ Notificações         │       │
│  │ ├─ Timeline empresa  │        │ └─ Alertas genéricas │       │
│  │ ├─ Entrevista        │        │                      │       │
│  │ ├─ Estágio           │        │ Config               │       │
│  │ └─ Contrato          │        │ └─ Preferências      │       │
│  │                      │        │                      │       │
│  │ Meu Perfil (✨)      │        └──────────────────────┘       │
│  │ ├─ Pessoal           │                                        │
│  │ ├─ Académico         │        COMPANY ADMIN VIEW              │
│  │ ├─ Profissional      │        ┌──────────────────────┐       │
│  │ └─ Portfólio (✨)    │        │ Parceiros            │       │
│  │                      │        │ ├─ Minha Empresa     │       │
│  │ Config               │        │ ├─ Vagas abertas     │       │
│  │ └─ Perfil/Aparência  │        │ ├─ Candidaturas (✨) │       │
│  │                      │        │ │  ├─ Pendentes      │       │
│  └──────────────────────┘        │ │  ├─ Aceites        │       │
│                                  │ │  └─ Rejeitadas     │       │
│                                  │ ├─ Review Modal      │       │
│                                  │ └─ Progresso Alunos  │       │
│                                  │                      │       │
│                                  │ Config               │       │
│                                  │ └─ Dados Empresa     │       │
│                                  └──────────────────────┘       │
│                                                                   │
│ ✨ = Novo em FASE 1                                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow: Job Application → Hiring

```
STUDENT SIDE                    SUPABASE                   COMPANY SIDE
─────────────                   ────────                   ───────────

1. Browse Parceiros
   ├─ See: partners.name
   ├─ See: vagas_abertas
   └─ See: vagas_preenchidas

2. Click "Candidatar-se"
   │
   └──→ JobApplicationModal
       (student mode)
            │
            ├─ Input: motivation/CV
            │
            └──→ jobApplicationService
                .submitJobApplication()
                     │
                     ├─→ INSERT job_applications
                     │   {status: 'PENDING'}
                     │
                     └─→ NOTIFY company admin

3. Show toast:                                 4. Company sees new
   "Candidatura enviada"                          application in:
                                                 Parceiros 
   Button: "Pendente"                            ├─ Tab "Minha Empresa"
                                                 ├─ Filter "Pendentes"  
                                                 └─ Table row + Review btn

5. Wait & See
   status updates:
   - Still PENDING?
   - Or ACCEPTED?
   - Or REJECTED?

                                             6. Company Review:
                                                JobApplicationModal
                                                (company mode)
                                                    │
                                                    ├─ See: student name, email
                                                    ├─ See: student skills, links
                                                    ├─ Action: ACCEPT with notes
                                                    │    │
                                                    │    └──→ UPDATE job_applications
                                                    │        {status: 'ACCEPTED'}
                                                    │        │
                                                    │        ├─→ RPC increment_vagas
                                                    │        │
                                                    │        ├─→ INSERT company_progress
                                                    │        │   {stage: 'INTERVIEW'}
                                                    │        │
                                                    │        └─→ Notify student
                                                    │
                                                    └─ Action: REJECT with reason
                                                         │
                                                         └──→ UPDATE job_applications
                                                             {status: 'REJECTED'}
                                                             │
                                                             └─→ Notify student

7. NOTIFIED:
   "Candidatura aceite por XYZ"
   └─ Redirect to /progresso/studentId

8. New flow:
   company_progress timeline
   ├─ Entrevista (data, resultado, notas)
   ├─ Estágio (datas, duração, compensação)
   ├─ Contrato (tipo, salário, datas)
   └─ Completo/Terminado
```

---

## 📊 Evaluation Flow

```
PROFESSOR CREATES EVALUATION

Individual Eval:
  ┌────────────────────────────────┐
  │ EvaluationsPageEnhanced        │
  ├────────────────────────────────┤
  │ 1. Select Training Area        │
  │ 2. Tab: Individual             │
  │ 3. Form:                       │
  │    - Student ID                │
  │    - Score (0-20)              │
  │    - Feedback                  │
  │    - Date                      │
  │    - Is Final checkbox         │
  │ 4. Submit                      │
  │    │                           │
  │    └─→ evaluationService       │
  │        .createIndividual...()  │
  │        │                       │
  │        ├─→ INSERT evaluations  │
  │        │   1 row per student   │
  │        │                       │
  │        └─→ Toast success       │
  └────────────────────────────────┘

Group Eval:
  ┌────────────────────────────────┐
  │ Same, but:                     │
  │ - Input: Subject ("Prova 1")   │
  │ - Input: Student IDs (CSV)     │
  │ - Score applies to ALL         │
  │ - Creates:                     │
  │   1 parent evaluation          │
  │   + N child evaluations        │
  │     (1 per student)            │
  └────────────────────────────────┘

STUDENT VIEWS EVALUATION

List View (EvaluationsPage):
  ┌────────────────────────────┐
  │ Student clicks:            │
  │ "View My Evaluations"      │
  ├────────────────────────────┤
  │ Shows:                     │
  │ - All individual evals     │
  │ - All group evals          │
  │ - Sorted by date (newest)  │
  │ - Shows score, feedback    │
  │ - Average grade badge      │
  │                            │
  │ Data from:                 │
  │ evaluationService          │
  │   .getStudentEvaluations() │
  │   .getStudentAverage...()  │
  └────────────────────────────┘
```

---

## 📱 Responsive Breakpoints

```
Desktop (1200px+)
├─ Grid: 3-4 columns
├─ Sidebar navigation visible
├─ Full modal widths
└─ Hover states active

Tablet (768px-1200px)
├─ Grid: 2 columns
├─ Sidebar collapses to hamburger
├─ Forms 2-column
└─ Touch-friendly buttons

Mobile (< 768px)
├─ Grid: 1 column
├─ Full-width modals
├─ Stacked forms
├─ Hamburger navigation
└─ Bottom sheet for actions
```

---

## 🔐 RLS (Row Level Security)

| Table | Insert | Select | Update | Delete | Notes |
|-------|--------|--------|--------|--------|-------|
| training_area | 🔒 Professor | ✅ Public | 🔒 Professor | 🔒 Professor | Seed data only |
| courses | 🔒 Professor | ✅ Public | 🔒 Professor | 🔒 Professor | Read only for students |
| job_applications | 🔒 Student | ✅ Student/Partner | 🔒 Partner | 🔒 Student | Applicant/recipient only |
| company_progress | 🔒 Partner | ✅ Student/Partner | 🔒 Partner | ❌ | Partner manages |
| student_portfolio | ✅ Owner | ✅ Public | ✅ Owner | ✅ Owner | Full CRUD by owner |
| evaluations | 🔒 Professor | ✅ Student/Professor | 🔒 Professor | 🔒 Professor | Read by student/prof |

---

## 🧩 Component Hierarchy

```
AppShell
├─ RequireAuth
│  ├─ DashboardPage
│  ├─ TrainingAreasPage
│  │  ├─ PageHeader
│  │  └─ TrainingAreaCard (repeat)
│  │     └─ Expand/collapse courses
│  │
│  ├─ EvaluationsPageEnhanced
│  │  ├─ Area selector
│  │  ├─ Tab switcher
│  │  ├─ IndividualEvalForm | GroupEvalForm
│  │  └─ Eval card list
│  │
│  ├─ PartnersPage (FASE 2 integration)
│  │  ├─ Partner cards
│  │  ├─ JobApplicationModal (student mode)
│  │  └─ Company admin panel (company mode)
│  │
│  ├─ StudentProfilePage
│  │  └─ ExpandedStudentProfile
│  │     ├─ Header (photo + intro)
│  │     └─ Tab panels
│  │        ├─ PersonalTab
│  │        ├─ AcademicTab
│  │        ├─ ProfessionalTab
│  │        └─ PortfolioTab
│  │
│  ├─ StudentProgressPage
│  │  ├─ Partner selector
│  │  └─ CompanyProgressTimeline
│  │     ├─ Timeline dots
│  │     └─ Phase panels
│  │        ├─ InterviewPhasePanel
│  │        ├─ InternshipPhasePanel
│  │        └─ ContractPhasePanel
│  │
│  └─ SettingsLayout
│     ├─ SettingsProfilePage
│     ├─ SettingsAppearancePage
│     ├─ SettingsSecurityPage
│     └─ SettingsPreferencesPage
│
└─ LoginPage
```

---

**Arquitetura Completa FASE 1 ✅**  
**FASE 2:** Integration com PartnersPage (Candidaturas UI)  
**FASE 3:** Painel Empresa + Timeline Bilateral
