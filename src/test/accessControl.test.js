import { describe, it, expect } from "vitest";
import { canAccessRoute, getRouteAccessRules, normalizeAliasAccountType, resolveAccessProfile } from "../utils/accessControl.js";

describe("accessControl identity contract", () => {
  it("normaliza aliases administrativos e académicos para admin", () => {
    expect(normalizeAliasAccountType("coordinator")).toBe("admin");
    expect(normalizeAliasAccountType("teacher")).toBe("admin");
    expect(normalizeAliasAccountType("ADMIN_1")).toBe("admin");
    expect(normalizeAliasAccountType("super_admin")).toBe("admin");
  });

  it("preserva tipos canónicos e degrada desconhecidos para external", () => {
    expect(normalizeAliasAccountType("student")).toBe("student");
    expect(normalizeAliasAccountType("company")).toBe("company");
    expect(normalizeAliasAccountType("admin")).toBe("admin");
    expect(normalizeAliasAccountType("something-else")).toBe("external");
  });

  it("resolve perfil administrativo legado como admin core", () => {
    const profile = resolveAccessProfile({ role: "ADMIN_1", type: "coordinator" });

    expect(profile.normalizedType).toBe("coordinator");
    expect(profile.normalizedRole).toBe("COORDINATOR");
    expect(profile.isCoordinatorUser).toBe(true);
  });

  it("avalia rotas por prefixo de forma consistente", () => {
    expect(canAccessRoute("/avaliacoes", ["/avaliacoes", "/config"])).toBe(true);
    expect(canAccessRoute("/avaliacoes/123", ["/avaliacoes", "/config"])).toBe(true);
    expect(canAccessRoute("/admin", ["/avaliacoes", "/config"])).toBe(false);
  });

  it("expõe rotas de menu coerentes para professor", () => {
    const profile = resolveAccessProfile({ role: "TEACHER", type: "teacher" });
    const rules = getRouteAccessRules(profile);

    expect(rules.menuRoutes).toContain("/avaliacoes");
    expect(rules.menuRoutes).toContain("/turmas");
    expect(rules.menuRoutes).not.toContain("/admin");
  });

  it("expõe rotas de menu reduzidas para empresa", () => {
    const profile = resolveAccessProfile({ role: "COMPANY", type: "company" });
    const rules = getRouteAccessRules(profile);

    expect(rules.menuRoutes).toEqual([
      "/empresa",
      "/rbac/candidaturas",
      "/chat",
      "/notificacoes",
      "/config",
    ]);
  });
});