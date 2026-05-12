
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import CompanyDashboardPage from "../pages/CompanyDashboardPage.jsx";
import JobApplicationModal from "../components/JobApplicationModal.jsx";

const mocks = vi.hoisted(() => {
  const state = {
    partner: {
      id: "partner-1",
      empresa: "Empresa Demo GIVA",
      vagas: 0,
    },
    vacancies: [],
    applications: [],
  };

  return {
    state,
    showToast: vi.fn(),
    getMyPartner: vi.fn(async () => state.partner),
    createPartner: vi.fn(async () => state.partner),
    listPartnerVacancies: vi.fn(async (partnerId, options = {}) => {
      const includeClosed = Boolean(options.includeClosed);
      const rows = state.vacancies.filter((v) => v.partner_id === partnerId);
      return includeClosed ? rows : rows.filter((v) => v.status === "OPEN");
    }),
    createPartnerVacancy: vi.fn(async ({ partner_id, title, description, total_slots }) => {
      const vacancy = {
        id: `vac-${state.vacancies.length + 1}`,
        partner_id,
        title,
        description: description ?? "",
        status: "OPEN",
        total_slots,
        filled_slots: 0,
        available_slots: total_slots,
      };
      state.vacancies.unshift(vacancy);
      state.partner.vagas = state.vacancies
        .filter((v) => v.status === "OPEN")
        .reduce((sum, v) => sum + Math.max(0, v.total_slots - v.filled_slots), 0);
      return vacancy;
    }),
    updatePartnerVacancyStatus: vi.fn(async (vacancyId, status) => {
      const vacancy = state.vacancies.find((v) => v.id === vacancyId);
      if (!vacancy) return null;
      vacancy.status = status;
      state.partner.vagas = state.vacancies
        .filter((v) => v.status === "OPEN")
        .reduce((sum, v) => sum + Math.max(0, v.total_slots - v.filled_slots), 0);
      return vacancy;
    }),
    listPartnerApplications: vi.fn(async (partnerId) =>
      state.applications.filter((app) => app.partner_id === partnerId)
    ),
    submitJobApplication: vi.fn(async (studentId, partnerId, vacancyId) => {
      const vacancy = state.vacancies.find((v) => v.id === vacancyId);
      const application = {
        id: `app-${state.applications.length + 1}`,
        student_id: studentId,
        partner_id: partnerId,
        vacancy_id: vacancyId,
        status: "PENDING",
        applied_at: new Date().toISOString(),
        student: {
          id: studentId,
          full_name: "Estudante Demo",
          email: "estudante.demo@giva.ao",
        },
        vacancy: vacancy ? { id: vacancy.id, title: vacancy.title } : null,
      };
      state.applications.unshift(application);
      return application;
    }),
    acceptJobApplication: vi.fn(async (applicationId) => {
      const app = state.applications.find((row) => row.id === applicationId);
      if (!app) return null;
      app.status = "ACCEPTED";

      const vacancy = state.vacancies.find((v) => v.id === app.vacancy_id);
      if (vacancy) {
        vacancy.filled_slots = Math.min(vacancy.total_slots, vacancy.filled_slots + 1);
        vacancy.available_slots = Math.max(0, vacancy.total_slots - vacancy.filled_slots);
      }

      return app;
    }),
    rejectJobApplication: vi.fn(async (applicationId) => {
      const app = state.applications.find((row) => row.id === applicationId);
      if (!app) return null;
      app.status = "REJECTED";
      return app;
    }),
    resetState: () => {
      state.vacancies = [];
      state.applications = [];
      state.partner = {
        id: "partner-1",
        empresa: "Empresa Demo GIVA",
        vagas: 0,
      };
    },
  };
});

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    t: (key) => key,
    showToast: mocks.showToast,
  }),
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    authProfile: { displayName: "Empresa Demo GIVA", email: "empresa.demo@giva.ao" },
  }),
}));

vi.mock("../services/partnersService.js", () => ({
  getMyPartner: mocks.getMyPartner,
  createPartner: mocks.createPartner,
}));

vi.mock("../services/vacanciesService.js", () => ({
  listPartnerVacancies: mocks.listPartnerVacancies,
  createPartnerVacancy: mocks.createPartnerVacancy,
  updatePartnerVacancyStatus: mocks.updatePartnerVacancyStatus,
}));

vi.mock("../services/jobApplicationService.js", () => ({
  listPartnerApplications: mocks.listPartnerApplications,
  submitJobApplication: mocks.submitJobApplication,
  acceptJobApplication: mocks.acceptJobApplication,
  rejectJobApplication: mocks.rejectJobApplication,
}));

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title }) => <h2>{title}</h2>,
}));

vi.mock("../components/CompanyProgressTimeline.jsx", () => ({
  default: () => <div>timeline</div>,
}));

describe("Vacancy Flow Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetState();
  });

  it("empresa publica vaga, estudante candidata e empresa fecha/reabre respeitando pendencias", { timeout: 20000 }, async () => {
    const dashboard = render(<CompanyDashboardPage />);

    await screen.findByText(/Vagas publicadas/i);

    fireEvent.change(screen.getByLabelText("Titulo da vaga"), {
      target: { value: "Estágio Frontend React" },
    });
    fireEvent.change(screen.getByLabelText("Descricao"), {
      target: { value: "Vaga para React e Supabase" },
    });
    fireEvent.change(screen.getByLabelText("Quantidade"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Publicar vaga(s)?/i }));

    await waitFor(() => {
      expect(mocks.createPartnerVacancy).toHaveBeenCalled();
    });

    dashboard.unmount();

    const onClose = vi.fn();
    const onSuccess = vi.fn();

    const modalRender = render(
      <JobApplicationModal
        mode="student"
        studentId="student-1"
        partnerId="partner-1"
        existingApplications={[]}
        onClose={onClose}
        onSuccess={onSuccess}
        t={(key) => key}
      />
    );

    await screen.findByRole("heading", { name: "Estágio Frontend React" });
    fireEvent.click(screen.getByRole("button", { name: "application.submit" }));

    await waitFor(() => {
      expect(mocks.submitJobApplication).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });

    modalRender.unmount();

    const companyRender = render(<CompanyDashboardPage />);

    await screen.findByText(/Vagas publicadas/i);
    fireEvent.click(screen.getByRole("button", { name: "Fechar vaga" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining("pendentes"),
        "error"
      );
    });
    expect(mocks.updatePartnerVacancyStatus).not.toHaveBeenCalledWith("vac-1", "CLOSED");

    await mocks.acceptJobApplication("app-1");
    companyRender.unmount();
    render(<CompanyDashboardPage />);
    await screen.findByText(/Vagas publicadas/i);

    fireEvent.click(screen.getByRole("button", { name: "Fechar vaga" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(mocks.updatePartnerVacancyStatus).toHaveBeenCalledWith("vac-1", "CLOSED");
    });

    await screen.findByRole("button", { name: "Reabrir vaga" });
    fireEvent.click(screen.getByRole("button", { name: "Reabrir vaga" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(mocks.updatePartnerVacancyStatus).toHaveBeenCalledWith("vac-1", "OPEN");
    });
  });
});
