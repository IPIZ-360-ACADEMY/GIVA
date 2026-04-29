import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import PostCard from "../components/PostCard.jsx";

const mocks = vi.hoisted(() => ({
  user: { id: "external-user-1" },
  addComment: vi.fn(),
  getComments: vi.fn(),
  getPublicPostUrl: vi.fn((postId) => `https://giva.test/publicacao/${postId}`),
  toggleBookmark: vi.fn(),
  votePoll: vi.fn(),
}));

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    user: mocks.user,
    userProfile: { display_name: "Visitante" },
  }),
}));

vi.mock("../services/postsService.js", () => ({
  addComment: mocks.addComment,
  getComments: mocks.getComments,
  getPublicPostUrl: mocks.getPublicPostUrl,
  toggleBookmark: mocks.toggleBookmark,
  votePoll: mocks.votePoll,
}));

function renderCard(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function makePost() {
  return {
    id: "post-1",
    content: "Conteudo de teste",
    created_at: new Date().toISOString(),
    is_official: false,
    image_url: null,
    poll: null,
    author: {
      id: "author-1",
      display_name: "Autor",
      type: "admin",
      avatar_url: null,
    },
    reactions: [],
    comments_count: [{ count: 0 }],
    shares_count: [{ count: 0 }],
  };
}

describe("PostCard readOnly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getComments.mockResolvedValue([]);
  });

  it("bloqueia reacao e remove acoes de comentario/partilha no modo completo", () => {
    const onReaction = vi.fn();
    const onShare = vi.fn();

    renderCard(
      <PostCard
        post={makePost()}
        onReaction={onReaction}
        onShare={onShare}
        readOnly
      />
    );

    const reagirBtn = screen.getByRole("button", { name: /reagir/i });
    expect(reagirBtn).toBeDisabled();

    fireEvent.click(reagirBtn);
    expect(onReaction).not.toHaveBeenCalled();

    expect(screen.queryByRole("button", { name: /comentar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /partilhar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/modo leitura: interações indisponíveis para este perfil/i)).toBeInTheDocument();
  });

  it("desativa gostar e partilhar no modo compacto", () => {
    const onReaction = vi.fn();
    const onShare = vi.fn();

    renderCard(
      <PostCard
        post={makePost()}
        onReaction={onReaction}
        onShare={onShare}
        compact
        readOnly
      />
    );

    const gostarBtn = screen.getByRole("button", { name: /gostar/i });
    const partilharBtn = screen.getByRole("button", { name: /partilhar/i });

    expect(gostarBtn).toBeDisabled();
    expect(partilharBtn).toBeDisabled();

    fireEvent.click(gostarBtn);
    fireEvent.click(partilharBtn);

    expect(onReaction).not.toHaveBeenCalled();
    expect(onShare).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: /partilhar publicação/i })).not.toBeInTheDocument();
  });
});
