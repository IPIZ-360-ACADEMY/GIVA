# Frontend Atomic Map

## Manifesto
- style.css -> manifesto com compatibilidade legada.
- style-modern.css -> manifesto principal moderno (sem camada legada).

## Tokens e Base
- styles/tokens.css
- styles/base.css

## Layout
- styles/layout.css

## Componentes (atomos, moleculas e organismos)
- styles/components/buttons.css
- styles/components/navigation.css
- styles/components/topbar.css
- styles/components/cards.css
- styles/components/tables.css
- styles/components/forms.css
- styles/components/feedback.css
- styles/components/auth.css
- styles/components/stage-tracking.css
- styles/components/internship-page.css
- styles/components/evaluations-page.css
- styles/components/student-detail-page.css

## Utilitarios e Responsivo
- styles/utilities.css
- styles/responsive.css

## Compatibilidade
- styles/legacy.css

## JavaScript Modular (dominios + paginas)
- scripts/domains/ux.module.js
- scripts/domains/shell.module.js
- scripts/domains/navigation.module.js
- scripts/domains/iam.module.js
- scripts/domains/auth-guard.module.js
- scripts/domains/internship.module.js
- scripts/domains/document.module.js
- scripts/domains/ux-feedback.module.js
- scripts/pages/est.page.js
- scripts/pages/alumno.page.js
- scripts/pages/avaliacoes.page.js
- scripts/pages/parc.page.js
- scripts/pages/notif.page.js
- scripts/pages/statis.page.js
- scripts/pages/config.page.js
- scripts/core/bootstrap.js
- scripts/legacy/app.legacy.js (adapter transversal)

## Estrategia de migracao segura
1. Manter `legacy.css` ativo para nao quebrar telas existentes.
2. Migrar seletor por seletor para os arquivos atomicos.
3. A cada modulo finalizado, remover seletor equivalente do `legacy.css`.
4. Quando todas as rotas estiverem migradas, eliminar `legacy.css`.
