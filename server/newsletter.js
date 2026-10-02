// Builds one personal email per confirmed subscriber, each with its own unsubscribe link.

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Plain text in, paragraphs out: blank lines separate paragraphs, single newlines become <br>
const toHtml = (body) =>
  body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("\n");

function buildNewsletterMessages(recipients, { subject, body }, baseUrl) {
  const base = baseUrl.replace(/\/+$/, "");
  return recipients.map(({ email, token }) => {
    const unsubscribeUrl = `${base}/api/unsubscribe?token=${token}`;
    return {
      email,
      subject,
      unsubscribeUrl,
      text: `${body}\n\n--\nYou receive this because you subscribed to the CTO Journal.\nUnsubscribe: ${unsubscribeUrl}`,
      html:
        `${toHtml(body)}\n<hr>\n` +
        `<p style="font-size:12px;color:#666">You receive this because you subscribed to the CTO Journal. ` +
        `<a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p>`,
    };
  });
}

module.exports = { buildNewsletterMessages };