import { onLinkClick } from "../router.js";

// Set VITE_CONTACT_EMAIL when building (see .env.example). If it isn't set,
// the Contact link is simply left out, so no address is ever hard-coded in the source.
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL;

const links = [
  { label: "All articles", href: "/", internal: true },
  { label: "Newsletter", href: "#newsletter" },
  ...(CONTACT_EMAIL ? [{ label: "Contact", href: `mailto:${CONTACT_EMAIL}` }] : []),
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
            <a
              key={l.label}
              href={l.href}
              onClick={l.internal ? onLinkClick : undefined}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
