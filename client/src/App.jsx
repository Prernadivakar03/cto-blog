import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header.jsx";
import PostCard from "./components/PostCard.jsx";
import Newsletter from "./components/Newsletter.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  const [posts, setPosts] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((d) => setPosts(d.posts))
      .catch(() => setError("Couldn't load articles. Please try again later."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? posts.filter((p) => p.title.toLowerCase().includes(q)) : posts;
  }, [posts, query]);

  return (
    <>
      <Header query={query} onQuery={setQuery} />

      <section className="hero">
        <div className="wrap">
          <p className="eyebrow">Construction Trade Promotion Organization</p>
          <h1>Building what's <em>next</em>,<br />one layer at a time.</h1>
          <p className="hero-sub">
            Field notes on 3D printing, automation and sustainable design from the people shaping the built world.
          </p>
        </div>
      </section>

      <main className="wrap">
        <div className="section-head">
          <h2>Latest Journal</h2>
          <span className="count">
            {!loading && `${filtered.length} ${filtered.length === 1 ? "article" : "articles"}`}
          </span>
        </div>

        {loading && <p className="empty">Loading articles…</p>}
        {error && <p className="empty">{error}</p>}

        <div className="grid" aria-live="polite">
          {filtered.map((post, i) => (
            <PostCard key={post.id} post={post} index={i} featured={i === 0 && !query} />
          ))}
        </div>

        {!loading && !error && filtered.length === 0 && (
          <p className="empty">No articles match “{query}”. Try another keyword.</p>
        )}
      </main>

      <Newsletter />
      <Footer />
    </>
  );
}