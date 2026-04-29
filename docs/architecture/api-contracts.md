# API Contracts - SGEIP v2.0 (REST)

## Auth
- POST /api/v1/auth/login
- POST /api/v1/auth/refresh
- POST /api/v1/auth/logout

## Areas / Cursos / Turmas
- GET /api/v1/areas
- GET /api/v1/courses?areaId=
- POST /api/v1/courses
- GET /api/v1/class-groups?areaId=&year=
- POST /api/v1/class-groups

## Alunos
- GET /api/v1/students?areaId=&state=&classGroupId=
- POST /api/v1/students
- PATCH /api/v1/students/{id}
- POST /api/v1/students/{id}/activate
- POST /api/v1/students/{id}/archive

## Estagios
- GET /api/v1/internships?areaId=&status=
- POST /api/v1/internships
- PATCH /api/v1/internships/{id}

## Documentos
- POST /api/v1/documents/upload
- GET /api/v1/documents?areaId=&courseId=&year=
- GET /api/v1/documents/{id}/download
- POST /api/v1/documents/{id}/new-version

## Aprovacoes
- POST /api/v1/approvals
- GET /api/v1/approvals?status=PENDING_APPROVAL
- POST /api/v1/approvals/{id}/approve
- POST /api/v1/approvals/{id}/reject

## Auditoria
- GET /api/v1/audit/events?from=&to=&actorId=&action=&areaId=&status=

## Headers obrigatorios
- Authorization: Bearer <token>
- X-Correlation-Id: <uuid>
- X-Area-Id: <uuid> (obrigatorio para escopo de area)

## Erros padrao
```json
{
  "code": "FORBIDDEN",
  "message": "Operacao nao autorizada para o perfil atual",
  "details": {
    "requiredRole": "ADMIN_1"
  }
}
```

## Regras de seguranca na API
- Toda rota valida role + area scope.
- Rotas sensiveis de Admin2 retornam 202 e criam approval request.
- Todas as mutacoes persistem evento em `audit_event`.
