import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import PostCard from "./components/PostCard.jsx";
import Article from "./components/Article.jsx";
import Newsletter from "./components/Newsletter.jsx";
import Footer from "./components/Footer.jsx";
import { parseRoute, navigate } from "./router.js";

// Shown after the user clicks a confirm / unsubscribe link in an email
const NOTICES = {
  confirmed: "Your subscription is confirmed. Welcome aboard.",
  unsubscribed: "You've been unsubscribed. You won't receive any more emails.",
  invalid: "That link is invalid or has expired.",
};

const readNotice = () => {
  const key = new URLSearchParams(window.location.search).get("subscription");
  return key && Object.hasOwn(NOTICES, key) ? NOTICES[key] : "";
};

export default function App() {
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [postId, setPostId] = useState(parseRoute);
  const [notice] = useState(readNotice);

  // Back/forward buttons and navigate() both end up here
  useEffect(() => {
    const onPop = () => {
      setPostId(parseRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Remove ?subscription=... from the address bar once the notice is shown
  useEffect(() => {
    if (notice) window.history.replaceState({}, "", window.location.pathname);
  }, [notice]);

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => {
        if (!r.ok) throw new Error("bad response");
        return r.json();
      })
      .then((d) => setPosts(d.posts))
      .catch(() => setError("Couldn't load articles. Please try again later."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? posts.filter((p) => p.title.toLowerCase().includes(q)) : posts;
  }, [posts, query]);

  // Typing in search while reading an article returns to the list
  const handleQuery = (value) => {
    setQuery(value);
    if (window.location.pathname !== "/") navigate("/");
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header query={query} onQuery={handleQuery} />

      {notice && (
        <div className="wrap">
          <p className="notice" role="status">{notice}</p>
        </div>
      )}

      {postId ? (
        <Article id={postId} />
      ) : (
        <>
          <section className="hero">
            <div className="wrap">
              <p className="eyebrow">Construction Trade Promotion Organization</p>
              <h1>
                Building what's <em>next</em>,<br />one layer at a time.
              </h1>
              <p className="hero-sub">
                Field notes on 3D printing, automation and sustainable design
                from the people shaping the built world.
              </p>
            </div>
          </section>

          <main className="wrap" id="main-content">
            <div className="section-head">
              <h2>Latest Journal</h2>
              <span className="count">
                {!loading &&
                  `${filtered.length} ${filtered.length === 1 ? "article" : "articles"}`}
              </span>
            </div>

            {loading && <p className="empty">Loading articles…</p>}
            {error && <p className="empty">{error}</p>}

            <div className="grid" aria-live="polite">
              {filtered.map((post, i) => (
                <PostCard
                  key={post.id}
                  post={post}
                  index={i}
                  featured={i === 0 && !query}
                />
              ))}
            </div>

            {!loading && !error && filtered.length === 0 && (
              <p className="empty">
                No articles match “{query}”. Try another keyword.
              </p>
            )}
          </main>
        </>
      )}

      <Newsletter />
      <Footer />
    </>
  );
}
