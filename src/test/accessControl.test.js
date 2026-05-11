import { describe, it, expect } from "vitest";
import { normalizeAliasAccountType, resolveAccessProfile } from "../utils/accessControl.js";

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
});