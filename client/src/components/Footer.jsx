const links = [
  { label: "All articles", href: "#/" },
  { label: "Newsletter", href: "#newsletter" },
  { label: "Contact", href: "mailto:prerna@example.com" }, 
  { label: "Back to top", href: "#top" },
];

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <p>
          © {new Date().getFullYear()} Construction Trade Promotion
          Organization. All rights reserved.
        </p>
        <nav aria-label="Footer">
          {links.map((l) => (
            <a key={l.label} href={l.href}>{l.label}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}