# 🧪 GIVA QA Testing Guide - Automated Checklist

## Quick Start

1. **Open DevTools:** `F12` (Windows) or `Cmd+Option+I` (Mac)
2. **Toggle Device View:** `Ctrl+Shift+M` (Windows) or `Cmd+Shift+M` (Mac)
3. **Select Resolution:** Use dropdown in DevTools to pick device/viewport
4. **Reload Page:** `F5` or `Cmd+R`
5. **Test Using This Guide:** Follow steps for each resolution below

## Figma Pixel-Perfect Pass

1. Abra o frame correspondente no Figma para a resolução em teste.
2. Faça screenshot da aplicação na mesma resolução.
3. Compare: margem lateral, espaçamento vertical, alinhamento de títulos, posição de botões e largura dos cards.
4. Classifique diferença: `P0` (quebra), `P1` (desvio visível), `P2` (refino).
5. Corrija e repita até remover P0/P1.

---

## 🔍 Test Resolution: 320px (iPhone SE)

### **Navigation & Sidebar**
1. Open app → See hamburger menu (≡) in top-left
2. Click hamburger → Sidebar slides in from left
3. Click "Dashboard" in sidebar → Navigates, sidebar closes
4. Click hamburger again → Sidebar opens again
5. Click outside sidebar → Sidebar closes (backdrop click)

**Expected:** Sidebar smooth, no lag, closes properly ✓

### **Login Page**
1. Open DevTools → Go to 320px width
2. Navigate to `/` or logout if needed
3. **Visual Check:**
   - [ ] Logo centered, 72px square, shadow visible
   - [ ] Text "GIVA IPIZ" below logo
   - [ ] Tag "Experiencia oficial da academia" with icon
   - [ ] Heading size proportional
   - [ ] Desc text not clipped
   - [ ] Form fields 100% width with left/right margin
   - [ ] Buttons vertically stacked

4. **Interaction:**
   - [ ] Click "Utilizador" field → Border turns gold (#a8843f), input focused
   - [ ] Type "test.user" → Text appears, no overflow
   - [ ] Tab to password field → Focus moves, gold border
   - [ ] Type "pass123" → Dots appear (password masked)
   - [ ] Click "Entrar" → Loading state (if applicable) or navigate
   - [ ] If error → Try "demo.user" + any password

**Expected:** Smooth focus transitions, no horizontal scroll, animations work ✓

### **Dashboard Layout (if logged in with demo)**
1. Check stats cards → Single column
2. Check tables → Rendered as cards (label | value format)
3. Scroll down → No horizontal scroll needed
4. Open sidebar → Check nav items readable

**Expected:** Single-column layout, cards not cut off ✓

---

## 📱 Test Resolution: 375px (iPhone 12)

### **Run Same Tests as 320px**
- [ ] Sidebar toggle works
- [ ] Login page visible fully
- [ ] Forms responsive
- [ ] No horizontal scroll

### **Additional Checks**
1. **Buttons Hover Effect:**
   - Hover over "Entrar" button (or use DevTools :hover)
   - Should become darker + blue shadow slightly stronger
   - No sudden jump or resize

2. **Card Styling:**
   - Click checkbox or hover row → Gold tint appears
   - Hover on nav link → Background color changes to cream-gold

3. **Theme Toggle:**
   - Top right → Click theme icon
   - Page switches to dark mode
   - Colors invert: cream →黑, dark text → light text
   - Click again → Back to light

**Expected:** Hover effects smooth, theme switch instant ✓

---

## 📱 Test Resolution: 390px (iPhone 12/13)

1. Validar topbar sem sobreposição de elementos.
2. Validar cards KPI em coluna única com espaçamento uniforme.
3. Validar tabelas em modo card com label/valor legíveis.
4. Comparar com Figma e registrar diferenças P0/P1/P2.

---

## 📱 Test Resolution: 414px (iPhone 12 Pro)

### **Run Same Tests as Above**

### **Additional - Text & Typography**
1. Open DevTools → Inspect a label in form
2. Should see `font-weight: 700` and `letter-spacing: 0.015em`
3. Labels should be slightly bolder than placeholder text
4. H1 "Aceder ao GIVA" should feel prominent

**Expected:** Label text noticeably bold, heading dominant ✓

---

## 💻 Test Resolution: 768px (iPad Portrait)

### **Breakpoint Activation**
At 768px, CSS media query `@media (max-width: 768px)` activates:

1. **Stats Grid Check:**
   - Open Dashboard
   - Stats cards arranged in 2 columns (not 1, not 3)
   - Example: "Active Internships | Total Hours"
   - On row 2: "Eval Score | Docs Pending"

2. **Sidebar Check:**
   - Sidebar still toggle (not permanently visible yet)
   - OR slightly visible with reduced width (depends on design)

3. **Table Check:**
   - Open any page with table (Partners, Documents, etc.)
   - Table still in card format OR partially horizontal
   - Check for data-label attributes (if visible)

**Expected:** 2-column layout kicks in, layout not broken ✓

---

## 🖥️ Test Resolution: 1024px (Desktop / iPad Landscape)

### **Desktop Layout Activation**
At 1024px, sidebar becomes FIXED/permanent:

1. **Sidebar Check:**
   - Left sidebar always visible (not toggle)
   - Width approximately 276px
   - Navigation links: Dashboard, Documents, Evaluations, Internships, Partners, Notifications, Settings, Statistics
   - Current page highlighted with gold background

2. **Stats Grid:**
   - 3-4 columns visible (e.g., 2x2 grid or 4 columns)
   - Cards fully visible without scroll

3. **Topbar Check:**
   - Left: Hamburger (hidden on desktop) or empty space
   - Center-left: Topbar brand link with logo (if visible at this res)
   - Center: Search box
   - Right: Theme toggle + Profile chip
   - Profile chip shows: Avatar (small | rounded) + Name "Demo User" + dropdown arrow

4. **Tables:**
   - Format back to horizontal tables (if applicable)
   - thead visible (not display:none)
   - Columns properly spaced
   - Hover row → Light gold background

5. **Interactions:**
   - Click profile chip (top right) → Dropdown menu with options
   - Click a nav link → Page loads, link becomes active (gold)
   - Click search box → Focus ring with gold border
   - Type in search → Results filter/update

**Expected:** Desktop layout complete, sidebar permanent, all elements visible ✓

---

## 🖥️ Test Resolution: 1280px+ (Large Desktop)

### **Full Layout**
1. **Everything from 1024px should work**
2. **Check Full-Width:**
   - Stats grid uses full width (likely 4 columns visible)
   - No elements truncated
   - Padding symmetrical
   - Content breathes (not cramped)

3. **Performance:**
   - Open DevTools → Performance tab
   - Reload page
   - Check FCP (First Contentful Paint) < 1.5s
   - LCP (Largest Contentful Paint) < 2.5s
   - CLS (Cumulative Layout Shift) < 0.1

---

## 🖥️ Test Resolution: 1440px (Desktop XL)

1. Validar distribuição visual da página sem blocos comprimidos.
2. Validar alinhamento entre header, grids e painéis.
3. Validar ClassesPage com cards distribuídos de forma consistente.
4. Comparar com Figma e registrar diferenças P0/P1/P2.

---

## 🎬 Animation Testing (All Resolutions)

### **Login Page Animations**
1. Open login page (logout if needed)
2. Watch elements appear in sequence:
   - [ ] Brand block (logo + "GIVA IPIZ") appears first, slides up
   - [ ] Tag slides up slightly after
   - [ ] Heading h2 slides up
   - [ ] Description p slides up
   - Right panel should also slide up

3. **Timing:** Should all complete within 1-2 seconds total

**Expected:** Staggered animation, no overlap, smooth ✓

### **Button Hover Animation**
1. Hover over primary button ("Entrar")
2. Should see: Color darken + shadow increase
3. **No resize/reflow** (should not cause layout shift)
4. Can test with DevTools: Right-click → Inspect → Click `:hov` in DevTools

**Expected:** Subtle animation, smooth, no jump ✓

---

## 🔊 Browser Console Check

1. Open DevTools → Console tab
2. Reload page
3. **Should see:**
   - Vite client connected (if dev server)
   - No red errors (❌)
   - Maybe one or two warnings (⚠️) is OK
   - Clean console is ideal

4. **If errors present:**
   - Note the error message
   - Click to see line number
   - Report as bug

**Expected:** 0 errors, clean console ✓

---

## 📊 Network & Performance Tab

1. Open DevTools → Network tab
2. Reload page → Watch requests
3. **Check:**
   - Logo asset loads: `logo-XXXXX.png` (should be ~83KB)
   - Profile image: `perfil-1-XXXXX.jpg` (should be ~30KB)
   - CSS: `index-XXXXX.css` (should be ~16KB)
   - JS: `index-XXXXX.js` (should be ~191KB)
   - All assets have green checkmarks (200 status)

4. **If any red/orange:**
   - Right-click request → Check "Response"
   - If 404 → Asset missing (critical bug)
   - If 403 → Permissions issue
   - If 500 → Server error

**Expected:** All 200 status, all assets loaded ✓

---

## 🎯 Accessibility Quick Check

1. **Tab Navigation:**
   - Press Tab key repeatedly
   - Should cycle through: Links, Buttons, Form fields
   - Order should be logical (top-bottom, left-right)
   - Should eventually return to start

2. **Focus Indicators:**
   - As you tab, each element should have visible outline
   - Outline should be **gold** (brand color) or blue
   - Should NOT be completely invisible

3. **Color Contrast:**
   - Login page text readable (white on dark gradient OK)
   - Form labels readable (dark text on light background OK)
   - Use: https://webaim.org/resources/contrastchecker/ if unsure

4. **ARIA Labels:**
   - Inspect form fields (F12 → Elements)
   - Inputs should have `<label htmlFor="...">` tags
   - OR `aria-label="..."` attribute

**Expected:** Tab order logical, focus visible, readable ✓

---

## 🐛 Issue Reporting Template

If you find a problem, document it:

```
## Issue: [Title]

**Resolution:** [e.g., 375px, 1280px]
**Browser:** [Chrome, Firefox, Safari]
**OS:** [Windows, Mac, iOS, Android]

**Description:**
What is the problem? (e.g., "Button shifts right on hover", "Text overflows at 320px")

**Steps to Reproduce:**
1. Go to [URL]
2. Resize to [viewport width]
3. [Action] → [Expected] but [Actual happened]

**Expected Behavior:**
What should happen? (e.g., "Button stays in place, only color changes")

**Actual Behavior:**
What actually happens? (e.g., "Button jumps 10px to the right")

**Severity:** Critical | High | Medium | Low
```

---

## ✅ Test Sign-Off

After testing all resolutions (320, 375, 390, 414, 768, 1024, 1280, 1440), check:

- [ ] Navigation works at all sizes
- [ ] No horizontal scroll except in tables
- [ ] Animations play (login page)
- [ ] Buttons responsive (hover work, no shift)
- [ ] Colors correct (brand gold, cream, dark)
- [ ] Forms functional (can type, submit)
- [ ] Console clean (no errors)
- [ ] Assets all loaded (Network tab)
- [ ] Tab order logical (Accessibility)
- [ ] Theme toggle works (Light ↔ Dark)

### Overall Result:
- [ ] ✅ **PASSED** - Ready for production
- [ ] ⚠️ **PASSED (Minor Issues)** - Document issues, can release if non-critical
- [ ] ❌ **FAILED** - Fix issues before release

**Tester Name:** ________________  
**Date:** ________________  
**Time Spent:** ________________ minutes

---

**Notes:**
```
[Any additional observations, device-specific issues, or successes]
```

---

*Generated for GIVA IPIZ Platform v1.0*  
*Last Updated: 2025-01-XX*
