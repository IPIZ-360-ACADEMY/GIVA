import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  challengeMock: vi.fn(),
  verifyMock: vi.fn(),
}));

vi.mock("../lib/supabase.js", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      mfa: {
        challenge: (...args) => hoisted.challengeMock(...args),
        verify: (...args) => hoisted.verifyMock(...args),
      },
    },
  },
}));

import { verifyMfaTotpCode } from "../services/authService.js";

describe("authService.verifyMfaTotpCode", () => {
  beforeEach(() => {
    hoisted.challengeMock.mockReset();
    hoisted.verifyMock.mockReset();

    hoisted.challengeMock.mockResolvedValue({ data: { id: "challenge-1" }, error: null });
    hoisted.verifyMock.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("falha quando factorId é inválido", async () => {
    const result = await verifyMfaTotpCode({ factorId: "", code: "123456" });

    expect(result.error).toBeTruthy();
    expect(String(result.error.message)).toMatch(/Fator MFA inválido/i);
    expect(hoisted.challengeMock).not.toHaveBeenCalled();
    expect(hoisted.verifyMock).not.toHaveBeenCalled();
  });

  it("falha quando código MFA não tem 6 dígitos", async () => {
    const result = await verifyMfaTotpCode({ factorId: "factor-1", code: "12a45" });

    expect(result.error).toBeTruthy();
    expect(String(result.error.message)).toMatch(/Código MFA inválido/i);
    expect(hoisted.challengeMock).not.toHaveBeenCalled();
    expect(hoisted.verifyMock).not.toHaveBeenCalled();
  });

  it("normaliza entradas e valida MFA com challenge + verify", async () => {
    const result = await verifyMfaTotpCode({ factorId: " factor-1 ", code: " 12 34 56 " });

    expect(result.error).toBeNull();
    expect(hoisted.challengeMock).toHaveBeenCalledWith({ factorId: "factor-1" });
    expect(hoisted.verifyMock).toHaveBeenCalledWith({
      factorId: "factor-1",
      challengeId: "challenge-1",
      code: "123456",
    });
  });
});
