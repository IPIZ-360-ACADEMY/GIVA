# Prompt: Diagrama de Entidade-Relacionamento (DER) - Sistema GIVA/IPIZ

## Contexto do Projeto

GIVA/IPIZ é um sistema de gestão de estágios profissionais e académico para instituições de ensino profissional. O sistema foi desenvolvido com React (frontend) e Supabase/PostgreSQL (backend).

## Estrutura do Banco de Dados

### Tabelas Principais

1. **area** - Áreas de formação
   - id (UUID, PK)
   - code (VARCHAR 16, UNIQUE) - ex: "TI", "EIE", "MECA", "TLQB"
   - name (VARCHAR 80)
   - is_active (BOOLEAN)
   - created_at (TIMESTAMPTZ)

2. **app_user** - Utilizadores do sistema
   - id (UUID, PK)
   - email (VARCHAR 160, UNIQUE)
   - password_hash (TEXT)
   - display_name (VARCHAR 120)
   - role (VARCHAR 24) - SUPER_ADMIN, ADMIN_1, ADMIN_2, STUDENT
   - area_id (UUID, FK → area)
   - is_active (BOOLEAN)
   - created_at (TIMESTAMPTZ)

3. **course** - Cursos
   - id (UUID, PK)
   - area_id (UUID, FK → area)
   - name (VARCHAR 120)
   - created_at (TIMESTAMPTZ)

4. **class_group** - Turmas
   - id (UUID, PK)
   - area_id (UUID, FK → area)
   - course_id (UUID, FK → course)
   - academic_year (INT)
   - status (VARCHAR 16) - CHECK: 'ACTIVE', 'ARCHIVED'
   - created_at (TIMESTAMPTZ)

5. **student** - Alunos
   - id (UUID, PK)
   - area_id (UUID, FK → area)
   - class_group_id (UUID, FK → class_group)
   - full_name (VARCHAR 140)
   - email (VARCHAR 160)
   - state (VARCHAR 16) - CHECK: 'PENDING', 'ACTIVE', 'EXPIRED', 'ARCHIVED'
   - activation_date (TIMESTAMPTZ)
   - expiration_date (TIMESTAMPTZ)
   - created_at (TIMESTAMPTZ)

6. **internship** - Estágios
   - id (UUID, PK)
   - area_id (UUID, FK → area)
   - student_id (UUID, FK → student)
   - company_name (VARCHAR 140)
   - status (VARCHAR 24)
   - started_at (TIMESTAMPTZ)
   - expected_end_at (TIMESTAMPTZ)
   - created_at (TIMESTAMPTZ)

7. **document** - Documentos
   - id (UUID, PK)
   - area_id (UUID, FK → area)
   - course_id (UUID, FK → course)
   - title (VARCHAR 180)
   - file_url (TEXT)
   - mime_type (VARCHAR 120)
   - file_size_bytes (BIGINT)
   - academic_year (INT)
   - uploaded_by (UUID, FK → app_user)
   - version (INT)
   - created_at (TIMESTAMPTZ)

8. **approval_request** - Requisições de aprovação
   - id (UUID, PK)
   - area_id (UUID, FK → area)
   - requested_by (UUID, FK → app_user)
   - approved_by (UUID, FK → app_user)
   - action (VARCHAR 80)
   - resource (VARCHAR 80)
   - resource_id (UUID)
   - status (VARCHAR 20) - CHECK: 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED'
   - before_json (JSONB)
   - after_json (JSONB)
   - created_at (TIMESTAMPTZ)
   - decided_at (TIMESTAMPTZ)

9. **audit_event** - Eventos de auditoria
   - id (BIGSERIAL, PK)
   - correlation_id (UUID)
   - area_id (UUID, FK → area)
   - actor_id (UUID, FK → app_user)
   - role (VARCHAR 24)
   - action (VARCHAR 100)
   - resource (VARCHAR 80)
   - resource_id (UUID)
   - status (VARCHAR 24)
   - before_json (JSONB)
   - after_json (JSONB)
   - created_at (TIMESTAMPTZ)

### Índices
- idx_audit_event_created_at on audit_event(created_at desc)
- idx_audit_event_actor on audit_event(actor_id, created_at desc)
- idx_audit_event_area on audit_event(area_id, created_at desc)
- idx_audit_event_action on audit_event(action, created_at desc)

## Papéis de Utilizador

- **SUPER_ADMIN**: Admin global do sistema
- **ADMIN_1**: Gatekeeper de ações sensíveis
- **ADMIN_2**: Coordenador por área
- **STUDENT**: Escopo próprio

## Fluxo de Aprovação

1. Admin2 solicita ação sensível
2. Sistema cria approval_request com snapshot before
3. Admin1/Super Admin aprova ou rejeita
4. Na aprovação, comando é executado e evento final persistido

## Multi-Tenant

- Tenant key: area_id (TI, EIE, MECA, TLQB)
- Todo registo de domínio académico possui area_id
- Nenhum acesso cross-area sem permissão explícita (scope:cross_area)

---

## Instruções para Gerar o DER

Com base nas informações acima, crie um Diagrama de Entidade-Relacionamento completo que inclua:

1. **Todas as entidades** listadas com os respetivos atributos
2. **Relacionamentos** entre entidades (1:1, 1:N, N:N)
3. **Cardinalidades** corretamente representadas
4. **Chaves primárias** (PK) e estrangeiras (FK)
5. **Restrições** (CHECK, UNIQUE, NOT NULL)
6. **Índices** relevantes
7. Notação padronizada (preferencialmente Crow's Foot ou Chen)

O DER deve refletir o modelo de dados real do sistema GIVA/IPIZ e ser adequado para documentação técnica ou apresentação académica.
