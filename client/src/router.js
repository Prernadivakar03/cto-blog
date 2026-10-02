// Minimal History API routing: "/" is the list, "/post/3" is article 3

export const parseRoute = () => {
  const m = window.location.pathname.match(/^\/post\/(\d+)\/?$/);
  return m ? Number(m[1]) : null;
};

export function navigate(to) {
  window.history.pushState({}, "", to);
  // pushState doesn't fire popstate, so tell the app the route changed
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// onClick handler for internal links: let the browser handle new-tab clicks
export function onLinkClick(e) {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(e.currentTarget.getAttribute("href"));
}
