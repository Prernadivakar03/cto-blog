export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-inner">
        <p>© {new Date().getFullYear()} Construction Trade Promotion Organization. All rights reserved.</p>
        <nav aria-label="Footer">
          {["About", "Events", "Membership", "Privacy", "Contact"].map((l) => (
            <a key={l} href="#" onClick={(e) => e.preventDefault()}>{l}</a>
          ))}
        </nav>
      </div>
    </footer>
  );
}