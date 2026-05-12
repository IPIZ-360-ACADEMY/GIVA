import { describe, expect, it } from "vitest";
import { resolveEvaluationView } from "../utils/evaluationViewConfig.js";

describe("evaluationViewConfig", () => {
  it("define visao admin com exportacao", () => {
    const view = resolveEvaluationView({ isSuperAdmin: true });
    expect(view.viewMode).toBe("admin");
    expect(view.defaultTab).toBe("overview");
    expect(view.tabs.map((tab) => tab.id)).toContain("export");
    expect(view.canExport).toBe(true);
  });

  it("define visao professor com lancamento de notas", () => {
    const view = resolveEvaluationView({ isTeacherUser: true });
    expect(view.viewMode).toBe("teacher");
    expect(view.tabs.map((tab) => tab.id)).toEqual(["my-classes", "grade-entry", "student-progress"]);
  });

  it("define visao estudante minima por defeito", () => {
    const view = resolveEvaluationView(null);
    expect(view.viewMode).toBe("student");
    expect(view.defaultTab).toBe("mine");
  });
});
