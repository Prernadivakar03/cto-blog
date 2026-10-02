import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import App from "./App.jsx";

const posts = [
  { id: 1, title: "Novel 3D Printing in Modern Civil Engineering", excerpt: "Printing.", date: "2026-09-22", category: "3D Printing" },
  { id: 2, title: "Automated Gantry Systems in Site Construction", excerpt: "Gantries.", date: "2026-09-15", category: "Automation" },
  { id: 3, title: "Sustainable High-Rise Development Strategies", excerpt: "Towers.", date: "2026-09-08", category: "Sustainability" },
];

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => ({
        ok: true,
        json: async () =>
          String(url).startsWith("/api/posts/")
            ? { post: { ...posts[0], content: ["Full body text."] } }
            : { posts },
      }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads posts from the API and shows the count", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: /novel 3d printing/i })).toBeInTheDocument();
    expect(screen.getByText("3 articles")).toBeInTheDocument();
  });

  it("filters posts by title as the user types", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: /novel 3d printing/i });

    await userEvent.type(screen.getByLabelText(/search posts/i), "gantry");

    expect(screen.getByRole("heading", { name: /gantry/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /novel 3d printing/i })).not.toBeInTheDocument();
    expect(screen.getByText("1 article")).toBeInTheDocument();
  });

  it("shows an empty message when nothing matches", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: /novel 3d printing/i });
    await userEvent.type(screen.getByLabelText(/search posts/i), "zzz");
    expect(screen.getByText(/no articles match/i)).toBeInTheDocument();
  });

  it("shows an error message when the API fails", async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<App />);
    expect(await screen.findByText(/couldn't load articles/i)).toBeInTheDocument();
  });

  it("opens an article from a card link using a real /post/:id URL, without a reload", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: /novel 3d printing/i });

    const links = screen.getAllByRole("link", { name: /read article/i });
    expect(links[0]).toHaveAttribute("href", "/post/1");
    await userEvent.click(links[0]);

    expect(window.location.pathname).toBe("/post/1");
    expect(await screen.findByText("Full body text.")).toBeInTheDocument();
  });

  it("opens the right article when the page is loaded directly at /post/2", async () => {
    window.history.pushState({}, "", "/post/2");
    render(<App />);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/posts/2"));
  });

  it("shows a notice after an email confirmation link and ignores unknown values", async () => {
    window.history.pushState({}, "", "/?subscription=confirmed");
    const { unmount } = render(<App />);
    expect(await screen.findByText(/subscription is confirmed/i)).toBeInTheDocument();
    expect(window.location.search).toBe(""); // param is removed from the URL
    unmount();

    window.history.pushState({}, "", "/?subscription=constructor");
    render(<App />);
    await screen.findByRole("heading", { name: /novel 3d printing/i });
    expect(screen.queryByText(/subscription is confirmed/i)).not.toBeInTheDocument();
  });
});
