import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import PostCard from "./components/PostCard.jsx";
import Article from "./components/Article.jsx";
import Newsletter from "./components/Newsletter.jsx";
import Footer from "./components/Footer.jsx";

// Hash routing: "#/post/3" opens article 3, "" or "#/" shows the list
const parseRoute = () => {
  const m = window.location.hash.match(/^#\/post\/(\d+)$/);
  return m ? Number(m[1]) : null;
};

export default function App() {
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [postId, setPostId] = useState(parseRoute);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash;
      // Only react to our own routes; plain anchors like #newsletter just scroll
      if (h === "" || h.startsWith("#/")) {
        setPostId(parseRoute());
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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
    if (window.location.hash) window.location.hash = "";
  };

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Header query={query} onQuery={handleQuery} />

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