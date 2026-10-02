import { parseRoute } from "./router.js";

describe("parseRoute", () => {
  it("returns the article id for /post/:id", () => {
    window.history.pushState({}, "", "/post/4");
    expect(parseRoute()).toBe(4);
    window.history.pushState({}, "", "/post/4/");
    expect(parseRoute()).toBe(4);
  });

  it("returns null for the list and for unrelated paths", () => {
    window.history.pushState({}, "", "/");
    expect(parseRoute()).toBeNull();
    window.history.pushState({}, "", "/post/abc");
    expect(parseRoute()).toBeNull();
  });
});
