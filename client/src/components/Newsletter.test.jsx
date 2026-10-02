import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import Newsletter from "./Newsletter.jsx";

const subscribeBtn = () => screen.getByRole("button", { name: /subscribe/i });
const emailInput = () => screen.getByLabelText(/email address/i);

describe("Newsletter form", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("shows an error for an empty email and never calls the API", async () => {
    render(<Newsletter />);
    await userEvent.click(subscribeBtn());
    expect(screen.getByText(/please enter your email/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows an error for a badly formatted email and never calls the API", async () => {
    render(<Newsletter />);
    await userEvent.type(emailInput(), "abc@site");
    await userEvent.click(subscribeBtn());
    expect(screen.getByText(/doesn't look like a valid email/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts a valid email, asks the user to confirm by email and clears the input", async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ status: 200, message: "Please check your inbox to confirm your subscription" }),
    });
    render(<Newsletter />);
    await userEvent.type(emailInput(), "test@example.com");
    await userEvent.click(subscribeBtn());

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(emailInput()).toHaveValue("");
    expect(fetch).toHaveBeenCalledWith(
      "/api/subscribe",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows the server's message when the API rejects the email", async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ status: 429, message: "Too many attempts. Please try again in a few minutes." }),
    });
    render(<Newsletter />);
    await userEvent.type(emailInput(), "test@example.com");
    await userEvent.click(subscribeBtn());
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it("does not crash when the server returns something that isn't JSON", async () => {
    fetch.mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("not json");
      },
    });
    render(<Newsletter />);
    await userEvent.type(emailInput(), "test@example.com");
    await userEvent.click(subscribeBtn());
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});