# Setup Supabase - FASE 1 (Manual Instructions)

**Goal:** Execute as mudanças de base de dados e preparar ambiente Supabase para GIVA FASE 1

---

## 📋 Checklist de Setup

### **Step 1: Executar SQL Script (Supabase SQL Editor)**

1. Acessa: [Supabase Dashboard](https://app.supabase.com) → Seu Projeto → SQL Editor
2. Cria **Nova Query** → **Paste o conteúdo de:**
   - `docs/architecture/supabase-phase1-structure.sql`
3. Clica **Run** (ou Ctrl+Enter)
4. ✅ Validar: Todas as tabelas criadas sem erro

**Expected Output:**
```
CREATE TABLE "public"."training_area"
CREATE TABLE "public"."courses"
CREATE TABLE "public"."students" (alter)
CREATE TABLE "public"."student_portfolio"
CREATE TABLE "public"."job_applications"
CREATE TABLE "public"."company_progress"
CREATE TABLE "public"."evaluations"
CREATE FUNCTION "public"."update_updated_at_column"()
CREATE TRIGGER "training_area_update_updated_at"
... (8 triggers)
INSERT INTO "public"."training_area" (4 rows)
```

---

### **Step 2: Criar RPC Function (Supabase SQL Editor)**

**Propósito:** Atomicamente incrementar `vagas_preenchidas` em `partners` quando candidatura é aceita

**Cria Nova Query:**

```sql
-- RPC Function: Increment vagas_preenchidas
create or replace function increment_vagas_preenchidas(partner_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.partners
  set vagas_preenchidas = vagas_preenchidas + 1,
      updated_at = now()
  where id = partner_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function increment_vagas_preenchidas(uuid) to authenticated;
```

**Clica Run**

✅ **Validar:** Função criada em `Functions` (SQL Editor sidebar)

---

### **Step 3: Criar Bucket Storage (para Fotos de Perfil)**

1. Supabase Dashboard → **Storage** (left sidebar)
2. **New Bucket** → Nome: `student-profiles`
3. ✅ **Public** (permitir reads públicos, mas não writes)
4. Click **Create Bucket**

**Configurar RLS Policies:**

```sql
-- Allow authenticated users to upload their own photos
create policy "Users can upload their own photo"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-profiles' and
  auth.uid() = (storage.foldername(name))[1]::uuid
);

-- Allow public read access
create policy "Public can read student photos"
on storage.objects
for select
to public
using (bucket_id = 'student-profiles');

-- Allow authenticated users to update/delete their own photos
create policy "Users can update their own photo"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-profiles' and
  auth.uid() = (storage.foldername(name))[1]::uuid
);
```

⚠️ **Nota:** Policies de Storage criam-se directamente na interface de Storage, clicando **Edit Policies** no bucket

---

### **Step 4: Ativar RLS nas Tabelas Novas (Row Level Security)**

**Para `student_portfolio` (Público read, autenticado write):**

```sql
alter table public.student_portfolio enable row level security;

-- Public can read
create policy "Public can read student portfolio"
on student_portfolio for select
using (true);

-- Authenticated can insert/update/delete own
create policy "Students can manage own portfolio"
on student_portfolio for all
to authenticated
using (auth.uid() = student_id)
with check (auth.uid() = student_id);
```

**Para outras tabelas novas (Only authenticated):**

```sql
alter table public.job_applications enable row level security;
alter table public.company_progress enable row level security;
alter table public.evaluations enable row level security;

-- Job Applications: Student e Partner access
create policy "Students can see own applications"
on job_applications for select
to authenticated
using (auth.uid() = student_id);

create policy "Partners can see applications"
on job_applications for select
to authenticated
using (
  partner_id in (
    select id from partners where created_by = auth.uid()
  )
);

-- Company Progress: Student and Partner access
create policy "Students can see own progress"
on company_progress for select
to authenticated
using (auth.uid() = student_id);

create policy "Partners can see progress of their students"
on company_progress for select
to authenticated
using (
  partner_id in (
    select id from partners where created_by = auth.uid()
  )
);

-- Evaluations: Professor and Students access
create policy "Students can see own evaluations"
on evaluations for select
to authenticated
using (auth.uid() = student_id);

create policy "Professors can see class evaluations"
on evaluations for select
to authenticated
using (
  training_area_id in (
    select id from training_area where supervisor_id = auth.uid()
  )
);
```

---

### **Step 5: Adicionar Coluna `supervisor_id` em `training_area` (Opcional)**

Se queres controlar permissões por professor:

```sql
alter table public.training_area
add column supervisor_id uuid references auth.users(id);

-- Exemplo:
update training_area set supervisor_id = auth.uid() where id = 'xxx';
```

---

### **Step 6: Validar Integridade de Dados**

```sql
-- Check all tables exist
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;

-- Check all triggers created
select trigger_name from information_schema.triggers
where trigger_schema = 'public'
order by trigger_name;

-- Check RPC function exists
select routine_name from information_schema.routines
where routine_schema = 'public' and routine_name = 'increment_vagas_preenchidas';
```

---

## 🔐 Matriz de Acesso (RLS)

| Table | Public Read | Auth Read | Auth Write | Admin Only |
|-------|------------|-----------|----------|-----------|
| `training_area` | ✅ | ✅ | 🔒 Professor | — |
| `courses` | ✅ | ✅ | 🔒 Professor | — |
| `student_portfolio` | ✅ | ✅ | 🔒 Own | — |
| `job_applications` | ❌ | ✅ Student/Partner | ✅ Student/Partner | — |
| `company_progress` | ❌ | ✅ Student/Partner | ✅ Partner only | — |
| `evaluations` | ❌ | ✅ Student/Professor | 🔒 Professor | — |

---

## 📝 Notas Importantes

### **Paths de Upload**

Quando aluno faz upload de foto, guardas em:
```
storage/student-profiles/{student_id}/profile.jpg
```

### **Validações App-side**

- ✅ EmailSignUp valida email unique (Supabase auth nativo)
- ✅ Serviços checam `canUseXxxApi()` antes de queries
- ✅ Error logging em todos os serviços

### **Triggers `updated_at`**

Todas as tabelas têm trigger que auto-atualiza `updated_at`:
```sql
create trigger {table_name}_update_updated_at
before update on {table_name}
for each row
execute function update_updated_at_column();
```

---

## ✅ Checklist Completion

- [ ] SQL Script executado (8 tabelas criadas)
- [ ] RPC `increment_vagas_preenchidas()` criada
- [ ] Bucket `student-profiles` criado
- [ ] Storage Policies configuradas
- [ ] RLS ativado em tabelas novas
- [ ] Triggers validados (8 total)
- [ ] Seed data viável (4 áreas de formação)

---

**Estimated Time:** 15-20 minutos  
**Risk Level:** Low (script é idempotent, pode re-executar se necessário)  
**Next Step:** Depois de completar, testar endpoints em `src/services/*` com dados reais
