import { describe, it, expect } from "vitest";
import { canManageUsersSensitiveAction } from "../pages/UsersManagementPage.jsx";

describe("UsersManagementPage access helper", () => {
  it("permite ações sensíveis apenas para SUPER_ADMIN", () => {
    expect(canManageUsersSensitiveAction("SUPER_ADMIN")).toBe(true);
    expect(canManageUsersSensitiveAction("super_admin")).toBe(true);
    expect(canManageUsersSensitiveAction("COORDINATOR")).toBe(false);
    expect(canManageUsersSensitiveAction("ADMIN")).toBe(false);
    expect(canManageUsersSensitiveAction("TEACHER")).toBe(false);
    expect(canManageUsersSensitiveAction(null)).toBe(false);
  });
});
