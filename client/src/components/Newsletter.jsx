import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const value = email.trim();

    if (!value)
      return setMsg({ text: "Please enter your email.", type: "error" });
    if (value.length > 254 || !EMAIL_RE.test(value))
      return setMsg({ text: "That doesn't look like a valid email.", type: "error" });

    setLoading(true);
    setMsg({ text: "", type: "" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      // Don't crash if the server returns something that isn't JSON
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setMsg({
          text: "You're subscribed. Thanks for joining the site report list.",
          type: "success",
        });
        setEmail("");
      } else {
        setMsg({
          text: data.message || "Something went wrong. Please try again.",
          type: "error",
        });
      }
    } catch {
      setMsg({ text: "Network error. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="newsletter" id="newsletter">
      <div className="wrap news-inner">
        <div>
          <h2>Get the site report.</h2>
          <p>One concise email a month on construction technology. No noise.</p>
        </div>
        <form onSubmit={submit} noValidate>
          <div className="news-row">
            <input
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => {
                setEmail(e.target.value);
                if (msg.text) setMsg({ text: "", type: "" });
              }}
              placeholder="you@company.com"
              aria-label="Email address"
              aria-invalid={msg.type === "error"}
              autoComplete="email"
            />
            <button type="submit" disabled={loading}>
              {loading ? (
                <span className="spinner" aria-label="Submitting" />
              ) : (
                "Subscribe"
              )}
            </button>
          </div>
          <p className={`form-msg ${msg.type}`} role="status" aria-live="polite">
            {msg.text}
          </p>
        </form>
      </div>
    </section>
  );
}