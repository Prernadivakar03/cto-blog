import logoMark from "../assets/logo-mark.jpeg";
import logoText from "../assets/logo-text.jpeg";

export default function Header({ query, onQuery }) {
  return (
    <header className="site-header">
      <div className="wrap header-inner">
        <a href="/" className="brand" aria-label="Alpha Konnect Koncepts home">
          <img src={logoMark} alt="" className="brand-mark" />
          <img src={logoText} alt="Alpha Konnect Koncepts" className="brand-text" />
        </a>

        <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search articles by title…"
            aria-label="Search posts"
          />
        </form>
      </div>
    </header>
  );
}