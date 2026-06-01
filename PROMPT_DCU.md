# Prompt: Diagrama de Casos de Uso (DCU) - Sistema GIVA/IPIZ

## Contexto do Projeto

GIVA/IPIZ é um sistema de gestão de estágios profissionais e académico para instituições de ensino profissional. O sistema foi desenvolvido com React (frontend) e Supabase/PostgreSQL (backend), seguindo arquitetura DDD + Clean Architecture.

## Funcionalidades do Sistema

### Módulos/Páginas do Frontend

1. **Dashboard** (`/`) - Painel principal com estatísticas e Overview
2. **Home** (`/home`) - Página inicial
3. **Estágios** (`/estagios`) - Gestão de estágios
4. **Turmas** (`/turmas`) - Gestão de turmas
5. **Detalhe de Turma** (`/turmas/detalhe`) - Vista detailhada de turma
6. **Áreas de Formação** (`/areas-formacao`) - Areas de formação (TI, EIE, MECA, TLQB)
7. **Avaliações** (`/avaliacoes`) - Sistema de avaliações
8. **Parceiros** (`/parceiros`) - Gestão de empresas parceiras
9. **Documentos** (`/documentos`) - Gestão documental
10. **Notificações** (`/notificacoes`) - Sistema de notificações
11. **Aluno** (`/aluno`) - Vista do aluno
12. **Perfil do Aluno** (`/perfil/:studentId`) - Perfil detalhado de aluno
13. **Progresso do Aluno** (`/progresso/:studentId`) - Progresso académico
14. **Painel Empresa** (`/empresa`) - Dashboard da empresa
15. **Vagas** (`/rbac/vagas`) - Gestão de vagas de estágio
16. **Candidaturas** (`/rbac/candidaturas`) - Gestão de candidaturas
17. **Admin** (`/admin`) - Painel de administração
18. **Ferramentas** (`/ferramentas`) - Ferramentas de gestão
19. **Pedidos** (`/pedidos`) - Gestão de pedidos
20. **Chat** (`/chat`) - Sistema de chat/mensagens
21. **Configurações** (`/config/*`) - Múltiplas páginas de configuração:
    - Perfil (`/config/perfil`)
    - Conta (`/config/conta`)
    - Preferências (`/config/preferencias`)
    - Aparência (`/config/aparencia`)
    - Segurança (`/config/seguranca`)
22. **Auth**:
    - Login (`/login`)
    - Signup (`/signup`)
    - Perfil Público (`/perfil-publico/:userId`)
    - Post público (`/post/:postId`)
    - Email Status (`/email-status`)

### Atores do Sistema

1. **SUPER_ADMIN**
   - Admin global do sistema
   - Acesso a todas as funcionalidades
   - Pode aprovar/rejeitar ações sensíveis

2. **ADMIN_1** (Gatekeeper)
   - Gestão de utilizadores
   - Aprovação de ações sensíveis
   - Auditoria do sistema

3. **ADMIN_2** (Coordenador)
   - Gestão de área específica
   - Criação de turmas e cursos
   - Gestão de alunos
   - Gestão de estágios
   - Solicitação de aprovações

4. **STUDENT** (Aluno)
   - Ver perfil próprio
   - Ver progressos
   - Candidatar a vagas
   - Upload de documentos
   - Receber notificações
   - Participar em chat

5. **Empresa Parceira**
   - Dashboard de empresa
   - Publicar vagas
   - Ver candidaturas
   - Avaliar alunos

## Casos de Uso Principais

### Autenticação e Autorização
- Login no sistema
- Registo de novo utilizador
- Redefinição de password
- Logout
- Autenticação multifator (MFA)

### Gestão de Utilizadores
- Criar utilizador
- Editar perfil de utilizador
- Ativar/desativar utilizador
- Atribuir papéis
- Gerir permissões

### Gestão Académica
- Criar área de formação
- Criar curso
- Criar turma
- Associar aluno a turma
- Gerir estado do aluno

### Gestão de Alunos
- Criar aluno
- Editar dados do aluno
- Ativar aluno
- Arquivar aluno
- Ver perfil do aluno
- Ver progresso do aluno

### Gestão de Estágios
- Criar estágio
- Atribuir estágio a aluno
- Atualizar estado do estágio
- Registar início/fim de estágio
- Avaliar estágio

### Gestão Documental
- Upload de documento
- Versionar documento
- Categorizar documento
- Download de documento
- Eliminar documento

### Sistema de Avaliações
- Criar avaliação
- Definir critérios
- Submeter avaliação
- Aprovar/rejeitar avaliação
- Ver estatísticas

### Gestão de Parceiros
- Registar empresa parceira
- Atualizar dados da empresa
- Publicar vaga
- Gerir candidaturas

### Notificações
- Enviar notificação
- Receber notificação
- Marcar como lida
- Configurar preferências

### Chat/Mensagens
- Enviar mensagem
- Receber mensagem
- Criar conversa
- Ver histórico

### Fluxo de Aprovação
- Submeter pedido de aprovação
- Aprovar pedido
- Rejeitar pedido
- Executar ação aprovada

### Auditoria
- Registar evento de auditoria
- Consultar logs de auditoria
- Filtrar por ator/data/ação

## Regras de Negócio Importantes

1. **Multi-Tenant por Área**: Cada registo pertence a uma área (TI, EIE, MECA, TLQB)
2. **Acesso Restrito**: Admin2 só acede à sua própria área
3. **Aprovação Obrigatória**: Ações sensíveis requerem aprovação de Admin1/Super Admin
4. **Estado do Aluno**: PENDING → ACTIVE → EXPIRED/ARCHIVED
5. **Versionamento**: Documentos têm versão incremental

---

## Instruções para Gerar o Diagrama de Casos de Us

Com base nas informações acima, crie um Diagrama de Casos de Uso completo que inclua:

1. **Todos os atores** correctamente identificados com ícones standard UML
2. **Todos os casos de uso** organizados por módulo/funcionalidade
3. **Associações** entre atores e casos de uso (incluir, estender, generalizar quando aplicável)
4. **Fronteiras de sistema** (pacotes) para grouping lógico
5. **Relacionamentos** entre casos de uso, se aplicável (include, extend)
6. **Descrição breve** de cada caso de uso

O DCU deve refletir todas as funcionalidades reais do sistema GIVA/IPIZ e ser adequado para documentação técnicas ou apresentação académica.

### Sugestão de Agrupamento (Pacotes)

- **Autenticação**: Login, Signup, Logout, MFA
- **Gestão de Utilizadores**: CRUD Utilizadores, Papéis, Permissões
- **Gestão Académica**: Áreas, Cursos, Turmas
- **Gestão de Alunos**: CRUD, Perfis, Progresso
- **Gestão de Estágios**: CRUD, Atribuição, Avaliação
- **Gestão Documental**: Upload, Download, Versionamento
- **Avaliações**: Criar, Submeter, Aprovar
- **Parceiros**: Registo, Vagas, Candidaturas
- **Comunicações**: Notificações, Chat
- **Administração**: Admin, Ferramentas, Aud
- **Fluxo de Trabalho**: Aprovação
