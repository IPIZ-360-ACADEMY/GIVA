import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpcMock, sendAccountActivationEmailMock, sendPasswordResetEmailMock, getCurrentSessionMock, getAuthProfileMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  sendAccountActivationEmailMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
  getCurrentSessionMock: vi.fn(),
  getAuthProfileMock: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock("../services/authService.js", () => ({
  sendAccountActivationEmail: sendAccountActivationEmailMock,
  sendPasswordResetEmail: sendPasswordResetEmailMock,
  getCurrentSession: getCurrentSessionMock,
  getAuthProfile: getAuthProfileMock,
}));

import { adminCreatePlatformUser, adminSendPasswordReset } from "../services/usersAdminService.js";

describe("usersAdminService", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    sendAccountActivationEmailMock.mockReset();
    sendPasswordResetEmailMock.mockReset();
    getCurrentSessionMock.mockReset();
    getAuthProfileMock.mockReset();

    getCurrentSessionMock.mockResolvedValue({ user: { id: "u-super" } });
    getAuthProfileMock.mockReturnValue({ role: "SUPER_ADMIN" });
  });

  it("normaliza role legado ADMIN_1 para COORDINATOR ao criar utilizador", async () => {
    rpcMock.mockResolvedValue({ data: "uid-1", error: null });

    const uid = await adminCreatePlatformUser({
      email: "coord@example.com",
      password: "12345678",
      display_name: "Coord Teste",
      type: "coordinator",
      role: "ADMIN_1",
      moderation: "active",
      areaId: "11111111-1111-1111-1111-111111111111",
      requirePasswordChange: true,
    });

    expect(uid).toBe("uid-1");
    expect(rpcMock).toHaveBeenCalledWith(
      "admin_create_platform_user",
      expect.objectContaining({
        p_role: "COORDINATOR",
        p_type: "coordinator",
      })
    );
  });

  it("envia reset com email normalizado", async () => {
    sendPasswordResetEmailMock.mockResolvedValue({ error: null });

    await adminSendPasswordReset("  USER@Example.com ");

    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith("user@example.com");
  });

  it("falha quando email de reset está vazio", async () => {
    await expect(adminSendPasswordReset("   ")).rejects.toThrow("Email é obrigatório");
  });

  it("bloqueia criação de utilizador para perfil sem privilégios", async () => {
    getAuthProfileMock.mockReturnValue({ role: "TEACHER" });

    await expect(
      adminCreatePlatformUser({
        email: "teacher@example.com",
        password: "12345678",
        display_name: "Teacher",
        type: "teacher",
      })
    ).rejects.toThrow("Permissão insuficiente para criar utilizador.");
  });
});
