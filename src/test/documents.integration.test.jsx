import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";
import DocumentsPage from "../pages/DocumentsPage.jsx";

const originalConfirm = window.confirm;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

const mocks = vi.hoisted(() => {
  const state = {
    docs: [
      {
        id: "doc-seeded-1",
        titulo: "seeded-preview.pdf",
        tipo: "PDF",
        versao: "v1.0",
        categoria: "geral",
        descricao: "Documento inicial",
        arquivoUrl: "https://example.com/seeded-preview.pdf",
        arquivoPath: "11111111-1111-1111-1111-111111111111/general/seeded-preview.pdf",
        estado: "review",
        contextType: "general",
        classGroupId: null,
        partnerId: null,
        isPinned: false,
        folderPath: "",
        folderName: "",
        subfolderName: "",
        createdAt: "2026-04-20T10:00:00.000Z",
        updatedAt: "2026-04-20T10:00:00.000Z",
      },
    ],
  };

  return {
    state,
    showToast: vi.fn(),
    canUseDocumentsApi: vi.fn(() => true),
    listDocuments: vi.fn(async () => [...state.docs]),
    bulkUploadDocuments: vi.fn(async (files) => {
      const created = files.map((file, index) => ({
        id: `doc-upload-${Date.now()}-${index}`,
        titulo: file.name,
        tipo: "CSV",
        versao: "v1.0",
        categoria: "geral",
        descricao: "",
        arquivoUrl: `https://example.com/${file.name}`,
        arquivoPath: `11111111-1111-1111-1111-111111111111/general/${file.name}`,
        estado: "review",
        contextType: "general",
        classGroupId: null,
        partnerId: null,
        isPinned: false,
        folderPath: "",
        folderName: "",
        subfolderName: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      state.docs = [...created, ...state.docs];
      return created.map((doc, idx) => ({ file: files[idx], result: doc, error: null }));
    }),
    downloadDocumentBlob: vi.fn(async () => new Blob(["preview-content"], { type: "text/plain" })),
    deleteDocument: vi.fn(async (id) => {
      state.docs = state.docs.filter((doc) => doc.id !== id);
    }),
    createDocument: vi.fn(),
    updateDocument: vi.fn(),
    updateDocumentStatus: vi.fn(),
    uploadDocumentFile: vi.fn(),
    listManualClasses: vi.fn(async () => []),
    listPartners: vi.fn(async () => []),
    resetState: () => {
      state.docs = [
        {
          id: "doc-seeded-1",
          titulo: "seeded-preview.pdf",
          tipo: "PDF",
          versao: "v1.0",
          categoria: "geral",
          descricao: "Documento inicial",
          arquivoUrl: "https://example.com/seeded-preview.pdf",
          arquivoPath: "11111111-1111-1111-1111-111111111111/general/seeded-preview.pdf",
          estado: "review",
          contextType: "general",
          classGroupId: null,
          partnerId: null,
          isPinned: false,
          folderPath: "",
          folderName: "",
          subfolderName: "",
          createdAt: "2026-04-20T10:00:00.000Z",
          updatedAt: "2026-04-20T10:00:00.000Z",
        },
      ];
    },
  };
});

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    query: "",
    showToast: mocks.showToast,
    t: (key) => {
      const table = {
        "documents.title": "Centro documental",
        "documents.description": "Controla versoes e revisoes.",
        "documents.submit": "Submeter documento",
        "documents.library": "Biblioteca de documentos",
        "documents.toast.titleRequired": "Indique o titulo do documento.",
        "documents.toast.submitted": "Documento submetido para revisao.",
        "common.inReview": "Em revisao",
        "common.approved": "Aprovado",
        "common.pending": "Pendente",
      };
      return table[key] ?? key;
    },
  }),
}));

vi.mock("../contexts/AuthContext.jsx", async (importOriginal) => {
  const actual = await importOriginal();
  const { resolveAccessProfile } = await import("../utils/accessControl.js");
  const authData = {
    authProfile: { role: "COORDINATOR", areaId: "11111111-1111-1111-1111-111111111111" },
    userProfile: { type: "admin" },
  };
  return {
    ...actual,
    useAuth: () => authData,
    useAccessProfile: () => resolveAccessProfile({ role: authData.authProfile.role, type: authData.userProfile.type }),
  };
});

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title, description, meta }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {meta}
    </header>
  ),
}));

vi.mock("../components/PanelSection.jsx", () => ({
  default: ({ title, children }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

vi.mock("../services/classesService.js", () => ({
  listManualClasses: mocks.listManualClasses,
}));

vi.mock("../services/partnersService.js", () => ({
  listPartners: mocks.listPartners,
}));

vi.mock("../services/documentsService.js", () => ({
  canUseDocumentsApi: mocks.canUseDocumentsApi,
  listDocuments: mocks.listDocuments,
  bulkUploadDocuments: mocks.bulkUploadDocuments,
  downloadDocumentBlob: mocks.downloadDocumentBlob,
  deleteDocument: mocks.deleteDocument,
  createDocument: mocks.createDocument,
  updateDocument: mocks.updateDocument,
  updateDocumentStatus: mocks.updateDocumentStatus,
  uploadDocumentFile: mocks.uploadDocumentFile,
}));

describe("Documents integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resetState();

    window.confirm = vi.fn(() => true);

    URL.createObjectURL = vi.fn(() => "blob:test-preview");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    window.confirm = originalConfirm;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("executa upload em lote, abre preview e remove documento", async () => {
    const { container } = render(<DocumentsPage />);

    await screen.findByRole("heading", { name: /centro documental/i });

    const fileInput = container.querySelector("#admin-bulk-input");
    const qaFile = new File(["id,descricao\n1,qa"], "qa-integration.csv", { type: "text/csv" });
    fireEvent.change(fileInput, { target: { files: [qaFile] } });

    fireEvent.click(screen.getByRole("button", { name: /guardar no sistema/i }));

    await waitFor(() => {
      expect(mocks.bulkUploadDocuments).toHaveBeenCalledTimes(1);
    });

    const uploadedTitle = await screen.findByRole("heading", { name: /qa-integration\.csv/i });
    const uploadedCard = uploadedTitle.closest("article");

    fireEvent.click(within(uploadedCard).getByRole("button", { name: /^abrir$/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /visualizador de documento/i })).toBeInTheDocument();
      expect(mocks.downloadDocumentBlob).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: /fechar/i }));

    fireEvent.click(within(uploadedCard).getByRole("button", { name: /remover/i }));

    await waitFor(() => {
      expect(mocks.deleteDocument).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("heading", { name: /qa-integration\.csv/i })).not.toBeInTheDocument();
    });
  });

  it("mostra erro e mantém grelha estável quando upload em lote falha", async () => {
    const { container } = render(<DocumentsPage />);

    await screen.findByRole("heading", { name: /centro documental/i });

    const fileInput = container.querySelector("#admin-bulk-input");
    const brokenFile = new File(["id,descricao\n2,broken"], "qa-broken.csv", { type: "text/csv" });

    mocks.bulkUploadDocuments.mockResolvedValueOnce([
      {
        file: brokenFile,
        result: null,
        error: new Error("Falha storage"),
      },
    ]);

    fireEvent.change(fileInput, { target: { files: [brokenFile] } });
    fireEvent.click(screen.getByRole("button", { name: /guardar no sistema/i }));

    await waitFor(() => {
      expect(mocks.bulkUploadDocuments).toHaveBeenCalledTimes(1);
      expect(mocks.showToast).toHaveBeenCalledWith(
        expect.stringContaining("falharam"),
        "error"
      );
    });

    expect(screen.getByText(/qa-broken\.csv/i)).toBeInTheDocument();
    expect(screen.getByText(/falha storage/i)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /qa-broken\.csv/i })).not.toBeInTheDocument();
  });
});
