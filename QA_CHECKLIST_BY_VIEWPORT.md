# QA Checklist por Resolução de Viewport - GIVA Platform

## Overview
Este documento detalha os testes de qualidade assurance para o GIVA IPIZ em diferentes resoluções de dispositivo.

## Regra de Paridade com Figma
- [ ] Para cada viewport, comparar screenshot da aplicação com o frame equivalente no Figma.
- [ ] Validar posição relativa dos blocos principais (header, cards, painéis, tabela).
- [ ] Validar margens laterais, espaçamentos verticais e alinhamento de títulos/ações.
- [ ] Registrar qualquer diferença visual como P0 (quebra), P1 (desvio perceptível) ou P2 (refino).

---

## 📱 Mobile Extra Small (320px) - iPhone SE

**Test Device:** iPhone SE / Small Device
**Viewport Width:** 320px
**Viewport Height:** 568px

### Login Page
- [ ] Logo aparece acima do formulário em layout responsivo
- [ ] Título "Aceder ao GIVA" é legível
- [ ] Campos de input cobrem 100% da largura com padding
- [ ] Botões "Entrar" e "Modo demonstracao" empilhados verticalmente
- [ ] Botões têm altura mínima de 44px para toque
- [ ] Sem scroll horizontal
- [ ] Animações slideInUp ativadas ao carregar

### Dashboard (Post-Login)
- [ ] Menu hamburger visível no topo esquerdo
- [ ] Search box oculto no topbar (substituído por ícone de lupa)
- [ ] Profile chip stackado/reduzido no topbar
- [ ] Sidebar completamente oculta (deve abrir com hamburger)
- [ ] Cards de estatísticas em layout single-column
- [ ] Nenhuma tabela visível horizontalmente (scroll overflow)
- [ ] Footer/rodapé acessível sem scroll excessivo

### Navigation & Interaction
- [ ] Clique no hamburger abre sidebar
- [ ] Clique fora da sidebar fecha automaticamente
- [ ] Links de navegação funcionam corretamente
- [ ] Theme toggle (light/dark) funciona
- [ ] Toast/notificações aparecem sem ocluir página

---

## 📱 Mobile Small (375px) - iPhone 12

**Test Device:** iPhone 12 / Standard Mobile
**Viewport Width:** 375px
**Viewport Height:** 667px

### Login Page
- [ ] Logo com boa proporção e visibilidade
- [ ] Texto "Plataforma institucional IPIZ" lido sem problemas
- [ ] Campos de input responsivos com bordas douradas no foco
- [ ] Placeholder text visível
- [ ] Botão primário com hover effect (escrecimento da cor)
- [ ] Botão ghost com transição de fundo
- [ ] Sem erro de layout ou overflow

### Dashboard
- [ ] Stats cards em 1 coluna com spacing adequado
- [ ] DataTable renderizado como cards com labels
- [ ] Data labels (_label) visíveis para cada valor
- [ ] Tabelas móveis com 2 colunas max (label | valor)
- [ ] Sidebar opens/closes suavemente
- [ ] Search retorna resultados sem distorcer layout
- [ ] Nenhuma linha de tabela excede largura da tela

---

## 📱 Mobile Standard (390px) - iPhone 12/13

**Test Device:** iPhone 12/13
**Viewport Width:** 390px
**Viewport Height:** 844px

### Layout & Positioning
- [ ] Topbar mantém alinhamento horizontal sem sobreposição de ícones e campo de busca
- [ ] Header da página preserva hierarquia visual (título, descrição, meta)
- [ ] Cards de KPI mantêm largura uniforme e espaçamento consistente
- [ ] Tabelas em modo card exibem par label/valor sem quebra de layout
- [ ] Drawer lateral abre/fecha sem deslocar conteúdo da página

### Figma Matching
- [ ] Distância do topo ao primeiro bloco equivalente ao frame
- [ ] Espaçamento entre cards equivalente ao frame
- [ ] Ações principais alinhadas conforme o frame

---

## 📱 Mobile Medium (414px) - iPhone 12 Pro

**Test Device:** iPhone 12 Pro / Larger Mobile
**Viewport Width:** 414px
**Viewport Height:** 896px (com notch)

### Visual Refinements
- [ ] Brand colors (gold #a8843f) aplicados corretamente
- [ ] Acentos dourados visíveis em botões hover
- [ ] Card hover effects com borda dourada sutil
- [ ] Topbar responsivo sem crowding

### Forms & Inputs
- [ ] Labels em font-weight 700 (bold)
- [ ] Inputs têm box-shadow de focus com tom dourado
- [ ] Cursor visível em inputs
- [ ] Enter key submete formulário
- [ ] Tab order funciona corretamente

### Content
- [ ] Imagens (logo, perfil) carregam corretamente
- [ ] Texto não se sobrepõe em nenhum elemento
- [ ] Icons (Material Icons) renderizados corretamente
- [ ] No console errors ou warnings

---

## 📱 Tablet (768px) - iPad Mini / Portrait

**Test Device:** Tablet / Medium Screen
**Viewport Width:** 768px
**Viewport Height:** 1024px

### Layout Transition
- [ ] 2-column grid aparece em stats (ex: 2 stats lado a lado)
- [ ] Sidebar ainda em modo mobile (toggle), ou início de desktop
- [ ] Search box volta a aparecer completamente no topbar
- [ ] Profile chip em tamanho normal

### DataTable
- [ ] Tabelas retornam parcialmente para formato horizontal (se applicable)
- [ ] Data labels ainda visíveis para mobile cards
- [ ] Scroll horizontal minimizado

### Navigation
- [ ] Topbar brand link (logo + text) aparece
- [ ] Navigation responsivo sem truncate

---

## 🖥️ Desktop Standard (1024px) - iPad Landscape / Desktop

**Test Device:** Desktop / Tablet Landscape
**Viewport Width:** 1024px
**Viewport Height:** 768px

### Layout Completion
- [ ] Sidebar visível e fixo à esquerda
- [ ] 3-4 column grid para stats cards
- [ ] Tabelas em formato horizontal normal
- [ ] Sem toggle do sidebar (sempre visível)
- [ ] Breadcrumb/nav hierarchy clara

### Components
- [ ] Logo no topbar (brand-mark) com sombra drop
- [ ] Profile chip detalhado (avatar + nome + role + menu)
- [ ] Search com autocomplete funcional
- [ ] Botões com hover effect (scale, shadow)
- [ ] Navlinks com active state dourado

---

## 🖥️ Desktop Large (1280px+) - Full Desktop

**Test Device:** Desktop Large / Wide Monitor
**Viewport Width:** 1280px+
**Viewport Height:** 800px+

### Full Features
- [ ] Grid layout de 4+ colunas para stats
- [ ] Sidebar com todas as opções visíveis
- [ ] No clipping ou text truncation
- [ ] Todos os elementos têm espaço adequado
- [ ] Dropdown menus funcionam corretamente
- [ ] Modals/dialogs centrados corretamente

### Visual Polish
- [ ] Box shadows renderizam corretamente
- [ ] Gradientes suaves sem banding
- [ ] Transições de mouse (hover) responsivas
- [ ] Focus rings visíveis para acessibilidade
- [ ] Cores de marca aplicadas consistentemente

---

## 🖥️ Desktop XL (1440px) - Large Canvas

**Test Device:** Desktop XL
**Viewport Width:** 1440px
**Viewport Height:** 900px

### Layout Distribution
- [ ] Grid ocupa área útil sem deixar blocos comprimidos
- [ ] ClassesPage mantém distribuição previsível dos cards por linha
- [ ] Dashboard mantém equilíbrio entre KPI, painéis e tabela
- [ ] StudentPage mantém proporção entre bloco de competências e bloco de nota

### Figma Matching
- [ ] Margens externas e gutters equivalentes ao frame 1440
- [ ] Largura visual da sidebar e área de conteúdo equivalentes ao frame
- [ ] Alinhamento de linhas de base de títulos e subtítulos equivalente ao frame

---

## 🎨 Visual & Animation Checklist

**Applies to All Viewports:**

### Colors & Branding
- [ ] Primary gold (#a8843f) aplicado corretamente
- [ ] Cream background (#f5f1e8) no light mode
- [ ] Dark mode inverte cores apropriadamente
- [ ] Contraste WCAG AA mínimo em todos os textos
- [ ] Links visíveis e diferenciados

### Animations & Transitions
- [ ] @keyframes slideInUp dispara ao abrir página
- [ ] Stagger delays funcionam (0.1s, 0.2s, 0.3s, 0.4s)
- [ ] Button hover não causa layout shift (no CLS)
- [ ] Focus states não ocluem conteúdo
- [ ] Transições suaves sem janky

### Accessibility
- [ ] Buttons e links tousuchable (min 44x44 útil)
- [ ] ARIA labels presentes em inputs
- [ ] Tab order lógico (esquerda-direita, top-bottom)
- [ ] Modo dark não causa strain ocular
- [ ] Nenhum elemento "cegamente piscante"

---

## 🔍 Cross-Platform Testing Procedure

### Per Viewport:

1. **Open DevTools** (F12)
2. **Set viewport:** Chrome DevTools → Toggle Device Toolbar (Ctrl+Shift+M)
3. **Select device:** Escolha no dropdown de dispositivos pré-configurados
4. **Reload:** F5 ou Cmd+R
5. **Navigate:** Teste cada página (Login, Dashboard, Documentos, Avaliações, etc.)
6. **Check Console:** Abra Console tab, procure por errors/warnings (vermelho)
7. **Verify Performance:** Network tab → verifique carregamento de assets
8. **Test Interaction:** Clique em botões, abra menus, navegue entre páginas
9. **Take Screenshot:** Capturar screenshot para documentação
10. **Document:** Aplique checkmarks e anote qualquer problema

### Network Simulation (Optional):
- Throttle to "Slow 4G" para testar carregamento lento
- Procure por images nãodefinidas ou assets faltando

---

## 📋 Sign-Off

- **Tested by:** ____________________
- **Date:** ____________________
- **Build Version:** 51 modules (Vite 5.4.21)
- **CSS Size:** 16.67KB (gzipped: 4.55KB)
- **JS Size:** 191.52KB (gzipped: 60.26KB)

### Overall Status:
- [ ] ✅ PASSED - Sem issues críticos
- [ ] ⚠️ PASSED WITH ISSUES - Documentar em seção de Issues
- [ ] ❌ FAILED - Documentar e retest após fix

### Known Issues (if any):
```
(Listar aqui qualquer problema encontrado durante os testes)
```

---

## Appendix: Quick Device Presets

### Available in Chrome DevTools:
- iPhone SE (375 x 667)
- iPhone 12 (390 x 844)
- iPhone 12 Pro (390 x 844)
- iPad Mini (768 x 1024)
- iPad Pro 12.9" (1024 x 1366)
- Windows Desktop (1280 x 720)
- Samsung Galaxy S8 (360 x 740)

### Breakpoints Defined in CSS:
```css
/* 1200px and below - Large desktop → 2-column stats */
@media (max-width: 1200px)

/* 1024px and below - Transição desktop/tablet */
@media (max-width: 1024px)

/* 980px and below - Desktop → Tablet layout, sidebar toggle */
@media (max-width: 980px)

/* 768px and below - Tablet → 2-column cards */
@media (max-width: 768px)

/* 640px and below - Mobile → 1-column, table → cards */
@media (max-width: 640px)

/* 480px and below - Mobile small → Compact topbar, small text */
@media (max-width: 480px)

/* 414px and below - Ajustes finos mobile large */
@media (max-width: 414px)

/* 390px and below - Ajustes finos mobile standard */
@media (max-width: 390px)
```

---

**Last Updated:** 2025-01-XX
**Status:** ✅ Active & Ready for Testing
