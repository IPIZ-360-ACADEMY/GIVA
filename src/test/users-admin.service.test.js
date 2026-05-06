import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpcMock, sendAccountActivationEmailMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  sendAccountActivationEmailMock: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock("../services/authService.js", () => ({
  sendAccountActivationEmail: sendAccountActivationEmailMock,
}));

import { adminCreatePlatformUser, adminSendPasswordReset } from "../services/usersAdminService.js";

describe("usersAdminService", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    sendAccountActivationEmailMock.mockReset();
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
    sendAccountActivationEmailMock.mockResolvedValue({ error: null });

    await adminSendPasswordReset("  USER@Example.com ");

    expect(sendAccountActivationEmailMock).toHaveBeenCalledWith("user@example.com");
  });

  it("falha quando email de reset está vazio", async () => {
    await expect(adminSendPasswordReset("   ")).rejects.toThrow("Email é obrigatório");
  });
});
