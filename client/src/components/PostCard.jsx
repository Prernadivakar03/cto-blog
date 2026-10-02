import Thumb from "./Thumb.jsx";
import { onLinkClick } from "../router.js";

const fmt = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function PostCard({ post, index, featured }) {
  return (
    <article className={`card ${featured ? "featured" : ""}`}>
      <div className="thumb-wrap">
        <Thumb index={post.id - 1} />
        <span className="tag">{post.category}</span>
      </div>
      <div className="card-body">
        <span className="num">{String(index + 1).padStart(2, "0")}</span>
        <time dateTime={post.date}>{fmt(post.date)}</time>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        <a href={`/post/${post.id}`} className="read" onClick={onLinkClick}>Read article →</a>
      </div>
    </article>
  );
}