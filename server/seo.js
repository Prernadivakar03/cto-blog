const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Give each article its own title, description and Open Graph tags in the HTML
// the server sends, so search engines and link previews see them
function withMeta(html, { title, description, url, type = "article" }) {
  return html
    .replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      (_, a, b) => `${a}${esc(description)}${b}`
    )
    .replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
      (_, a, b) => `${a}${esc(title)}${b}`
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      (_, a, b) => `${a}${esc(description)}${b}`
    )
    .replace(
      /(<meta\s+property="og:type"\s+content=")[^"]*(")/,
      (_, a, b) => `${a}${esc(type)}${b}`
    )
    .replace(
      "</head>",
      () =>
        `<link rel="canonical" href="${esc(url)}" />\n` +
        `<meta property="og:url" content="${esc(url)}" />\n</head>`
    );
}

module.exports = { esc, withMeta };
