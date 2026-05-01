import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import HomePage from "../pages/HomePage.jsx";

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: "u1" },
    userProfile: { type: "external", display_name: "Visitante", avatar_url: null },
    authProfile: { role: "EXTERNAL" },
  },
  getFeedPosts: vi.fn(),
  getBookmarkedPostIds: vi.fn(),
  getBookmarkedPosts: vi.fn(),
  sharePost: vi.fn(),
  subscribeToFeed: vi.fn(),
  toggleReaction: vi.fn(),
}));

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    t: (key) => key,
  }),
}));

vi.mock("../contexts/AuthContext.jsx", async (importOriginal) => {
  const actual = await importOriginal();
  const { resolveAccessProfile } = await import("../utils/accessControl.js");
  return {
    ...actual,
    useAuth: () => mocks.auth,
    useAccessProfile: () => resolveAccessProfile({
      role: mocks.auth.authProfile?.role,
      type: mocks.auth.userProfile?.type,
    }),
  };
});

vi.mock("../components/PageHeader.jsx", () => ({
  default: ({ title, description }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock("../components/PanelSection.jsx", () => ({
  default: ({ title, actions, children }) => (
    <section>
      <h2>{title}</h2>
      {actions}
      {children}
    </section>
  ),
}));

vi.mock("../components/CreatePostCard.jsx", () => ({
  default: () => <div data-testid="create-post-card">CreatePostCard</div>,
}));

vi.mock("../components/PostCard.jsx", () => ({
  default: ({ post, readOnly }) => (
    <article data-testid={`post-${post.id}`}>
      <span>{post.content}</span>
      <span>{readOnly ? "readonly" : "interactive"}</span>
    </article>
  ),
}));

vi.mock("../services/postsService.js", () => ({
  getBookmarkedPostIds: mocks.getBookmarkedPostIds,
  getBookmarkedPosts: mocks.getBookmarkedPosts,
  getFeedPosts: mocks.getFeedPosts,
  sharePost: mocks.sharePost,
  subscribeToFeed: mocks.subscribeToFeed,
  toggleReaction: mocks.toggleReaction,
}));

describe("HomePage enterprise multi-profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getBookmarkedPostIds.mockResolvedValue([]);
    mocks.getBookmarkedPosts.mockResolvedValue([]);
    mocks.getFeedPosts.mockResolvedValue([
      {
        id: "p-1",
        content: "Comunicado de teste",
        is_official: true,
        reactions: [],
        comments_count: [{ count: 0 }],
        shares_count: [{ count: 0 }],
        author: { id: "a-1", display_name: "IPIZ", type: "admin" },
        created_at: new Date().toISOString(),
      },
    ]);
    mocks.subscribeToFeed.mockReturnValue(() => {});
  });

  it("perfil externo fica em modo leitura e sem composer", async () => {
    mocks.auth.authProfile = { role: "EXTERNAL" };
    mocks.auth.userProfile = { type: "external", display_name: "Visitante" };
    mocks.getFeedPosts.mockResolvedValue([
      {
        id: "p-1",
        content: "Comunicado de teste",
        is_official: true,
        reactions: [],
        comments_count: [{ count: 0 }],
        shares_count: [{ count: 0 }],
        author: { id: "a-1", display_name: "IPIZ", type: "admin" },
        created_at: new Date().toISOString(),
      },
      {
        id: "p-2",
        content: "Aviso publico",
        is_official: false,
        reactions: [],
        comments_count: [{ count: 0 }],
        shares_count: [{ count: 0 }],
        author: { id: "a-2", display_name: "Secretaria", type: "admin" },
        created_at: new Date().toISOString(),
      },
    ]);

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /feed público curado/i })).toBeInTheDocument();
    });

    expect(screen.queryByTestId("create-post-card")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /guardados/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tendências/i })).not.toBeInTheDocument();
    expect(screen.getAllByText(/readonly/i)).toHaveLength(2);
    expect(screen.queryByText(/interactive/i)).not.toBeInTheDocument();
    expect(mocks.getBookmarkedPostIds).not.toHaveBeenCalled();
  });

  it("perfil estudante vê feed próprio e mantém composer", async () => {
    mocks.auth.authProfile = { role: "STUDENT" };
    mocks.auth.userProfile = { type: "student", display_name: "Aluno Demo" };

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /feed do estudante/i })).toBeInTheDocument();
    });

    expect(screen.getByTestId("create-post-card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardados/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tendências/i })).not.toBeInTheDocument();
    expect(screen.getByText(/interactive/i)).toBeInTheDocument();
  });

  it("super admin vê visão de comando com filtros completos", async () => {
    mocks.auth.authProfile = { role: "SUPER_ADMIN" };
    mocks.auth.userProfile = { type: "admin", display_name: "Super Admin" };

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /comando social institucional/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /guardados/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tendências/i })).toBeInTheDocument();
  });
});
