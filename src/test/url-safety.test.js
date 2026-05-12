import { describe, expect, it } from "vitest";
import { sanitizeAssetUrl } from "../utils/urlSafety.js";

describe("sanitizeAssetUrl", () => {
  it("aceita caminho relativo local", () => {
    expect(sanitizeAssetUrl("/assets/avatar.png")).toBe("/assets/avatar.png");
  });

  it("bloqueia protocolo javascript e protocolo relativo", () => {
    expect(sanitizeAssetUrl("javascript:alert(1)")).toBe("");
    expect(sanitizeAssetUrl("//evil.example.com/image.png")).toBe("");
  });

  it("aceita apenas host permitido para URL absoluta", () => {
    const sameHostUrl = `${window.location.origin}/avatar.png`;
    expect(sanitizeAssetUrl(sameHostUrl)).toBe(sameHostUrl);
    expect(sanitizeAssetUrl("https://evil.example.com/avatar.png")).toBe("");
  });
});
