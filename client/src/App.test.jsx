import { render, screen } from "@testing-library/react";
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
    window.location.hash = "";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ posts }) })
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
});