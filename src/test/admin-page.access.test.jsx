import { describe, it, expect } from "vitest";
import { canAccessAdminPanel, canRunAdminSensitiveAction } from "../pages/AdminPage.jsx";

describe("AdminPage access helper", () => {
  it("permite apenas SUPER_ADMIN", () => {
    expect(canAccessAdminPanel("SUPER_ADMIN")).toBe(true);
    expect(canAccessAdminPanel("super_admin")).toBe(true);
    expect(canAccessAdminPanel("COORDINATOR")).toBe(false);
    expect(canAccessAdminPanel("ADMIN")).toBe(false);
    expect(canAccessAdminPanel("TEACHER")).toBe(false);
    expect(canAccessAdminPanel(null)).toBe(false);
  });

  it("aplica o mesmo contrato para ações sensíveis", () => {
    expect(canRunAdminSensitiveAction("SUPER_ADMIN")).toBe(true);
    expect(canRunAdminSensitiveAction("COORDINATOR")).toBe(false);
    expect(canRunAdminSensitiveAction("ADMIN")).toBe(false);
  });
});
