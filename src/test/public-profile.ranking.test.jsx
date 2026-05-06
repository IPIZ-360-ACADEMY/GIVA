import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, vi } from "vitest";

let PublicProfilePage;

vi.mock("../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ user: { id: "viewer-1" } }),
}));

vi.mock("../services/profilesService.js", () => ({
  getProfile: vi.fn(async () => ({
    id: "user-student-1",
    display_name: "Ana Silva",
    type: "student",
    bio: "Perfil teste",
    avatar_url: null,
    student_accounts: { process_number: "12345" },
  })),
  isFollowing: vi.fn(async () => false),
  followUser: vi.fn(async () => true),
  unfollowUser: vi.fn(async () => true),
}));

vi.mock("../services/postsService.js", () => ({
  getFeedPosts: vi.fn(async () => []),
  toggleReaction: vi.fn(async () => true),
}));

vi.mock("../services/chatService.js", () => ({
  getOrCreateConversation: vi.fn(async () => ({ id: "conv-1" })),
}));

vi.mock("../components/PostCard.jsx", () => ({
  default: () => <article>post</article>,
}));

vi.mock("../services/publicRatingsService.js", () => ({
  getPublicRatingSummary: vi.fn(async () => ({ average: 4.3, count: 8, comments: ["Excelente desempenho"] })),
  listTopRatedStudents: vi.fn(async () => ([
    { userId: "user-student-1", entityId: "student-1", displayName: "Ana Silva", average: 4.3, count: 8 },
    { userId: "user-student-2", entityId: "student-2", displayName: "Bruno", average: 4.1, count: 6 },
  ])),
  listTopRatedCompanies: vi.fn(async () => []),
  getPublicRankingPosition: vi.fn(async () => ({ position: 7, total: 40 })),
}));

beforeAll(async () => {
  const module = await import("../pages/PublicProfilePage.jsx");
  PublicProfilePage = module.default;
});

describe("PublicProfilePage", () => {
  it("mostra posição global no ranking público", async () => {
    render(
      <MemoryRouter initialEntries={["/perfil-publico/user-student-1"]}>
        <Routes>
          <Route path="/perfil-publico/:userId" element={<PublicProfilePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Top estudantes")).toBeInTheDocument();
      expect(screen.getByText("Posição global: #7 de 40")).toBeInTheDocument();
      expect(screen.getAllByText(/4.3\/5/i).length).toBeGreaterThan(0);
    });
  });
});
