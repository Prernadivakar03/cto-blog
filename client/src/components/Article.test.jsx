import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import Article from "./Article.jsx";

const post = {
  id: 1,
  title: "Test Article",
  excerpt: "Lead text.",
  date: "2026-09-22",
  category: "3D Printing",
  content: ["Paragraph one.", "Paragraph two."],
};

describe("Article", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads and renders the full article and sets the tab title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ post }) })
    );
    render(<Article id={1} />);

    expect(
      await screen.findByRole("heading", { name: /test article/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Paragraph two.")).toBeInTheDocument();

    // The title is set in an effect, so wait for it instead of reading it instantly
    await waitFor(() => expect(document.title).toMatch(/Test Article/));
  });

  it("shows a message when the article doesn't exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) })
    );
    render(<Article id={999} />);
    expect(
      await screen.findByText(/couldn't find that article/i)
    ).toBeInTheDocument();
  });
});