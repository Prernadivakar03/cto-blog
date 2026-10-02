import { useEffect, useState } from "react";
import Thumb from "./Thumb.jsx";
import { onLinkClick } from "../router.js";

const fmt = (d) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default function Article({ id }) {
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState("loading");

  // Load the article
  useEffect(() => {
    setStatus("loading");
    fetch(`/api/posts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((d) => {
        setPost(d.post);
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  // Per-article tab title and meta description
  useEffect(() => {
    if (!post) return;
    const defaultTitle = "CTO Journal · Construction Trade Promotion Organization";
    const desc = document.querySelector('meta[name="description"]');
    const defaultDesc = desc?.getAttribute("content");

    document.title = `${post.title} · CTO Journal`;
    desc?.setAttribute("content", post.excerpt);

    return () => {
      document.title = defaultTitle;
      if (desc && defaultDesc) desc.setAttribute("content", defaultDesc);
    };
  }, [post]);

  return (
    <main className="wrap article" id="main-content">
      <a href="/" className="back" onClick={onLinkClick}>← All articles</a>

      {status === "loading" && <p className="empty">Loading article…</p>}
      {status === "error" && (
        <p className="empty">We couldn't find that article.</p>
      )}

      {status === "ok" && post && (
        <article>
          <div className="meta">
            <span className="tag-inline">{post.category}</span>
            <time dateTime={post.date}>{fmt(post.date)}</time>
          </div>
          <h1>{post.title}</h1>
          <div className="thumb-wrap">
            <Thumb index={post.id - 1} />
          </div>
          <p className="lead">{post.excerpt}</p>
          {post.content.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </article>
      )}
    </main>
  );
}