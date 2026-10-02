// Sends email through Resend's HTTP API (no extra npm dependency).
// Without RESEND_API_KEY and MAIL_FROM it only logs, which is fine for local
// development but means no real email is sent.

const RESEND_URL = "https://api.resend.com/emails";
const BATCH_SIZE = 100; // Resend's batch endpoint accepts up to 100 emails per call

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function buildConfirmationEmail({ confirmUrl, unsubscribeUrl }) {
  const subject = "Confirm your subscription to the CTO Journal";
  const text = [
    "Thanks for signing up to the CTO Journal site report.",
    "",
    "Please confirm your email address by opening this link:",
    confirmUrl,
    "",
    "If you didn't sign up, ignore this email and you won't hear from us again.",
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join("\n");
  const html = `
    <p>Thanks for signing up to the CTO Journal site report.</p>
    <p><a href="${escapeHtml(confirmUrl)}">Confirm my subscription</a></p>
    <p>If you didn't sign up, ignore this email and you won't hear from us again.</p>
    <p style="font-size:12px;color:#666"><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe</a></p>`;
  return { subject, text, html };
}

function createMailer({
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.MAIL_FROM,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  if (!apiKey || !from) {
    return {
      kind: "console",
      async sendConfirmation(email, links) {
        logger.log(`[mail not configured] Confirmation link for ${email}: ${links.confirmUrl}`);
      },
      async sendNewsletter(messages) {
        logger.log(`[mail not configured] Would send "${messages[0]?.subject}" to ${messages.length} subscribers`);
        return { sent: 0, failed: 0, notConfigured: true };
      },
    };
  }

  const post = (url, payload) =>
    fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

  return {
    kind: "resend",

    async sendConfirmation(email, links) {
      const { subject, text, html } = buildConfirmationEmail(links);
      const res = await post(RESEND_URL, {
        from,
        to: [email],
        subject,
        text,
        html,
        headers: { "List-Unsubscribe": `<${links.unsubscribeUrl}>` },
      });
      if (!res.ok) throw new Error(`Email provider responded with ${res.status}`);
    },

    // messages: [{ email, subject, text, html, unsubscribeUrl }]
    // Sent in batches of 100. A failed batch is counted and logged, and the rest still go out.
    async sendNewsletter(messages) {
      let sent = 0;
      let failed = 0;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const chunk = messages.slice(i, i + BATCH_SIZE);
        try {
          const res = await post(
            `${RESEND_URL}/batch`,
            chunk.map((m) => ({
              from,
              to: [m.email],
              subject: m.subject,
              text: m.text,
              html: m.html,
              headers: {
                "List-Unsubscribe": `<${m.unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }))
          );
          if (!res.ok) throw new Error(`Email provider responded with ${res.status}`);
          sent += chunk.length;
        } catch (err) {
          logger.error(`Newsletter batch starting at ${i} failed: ${err.message}`);
          failed += chunk.length;
        }
      }
      return { sent, failed };
    },
  };
}

module.exports = { createMailer, buildConfirmationEmail };