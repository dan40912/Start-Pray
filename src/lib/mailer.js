// Optional transactional mailer (password reset), sent through the Resend
// HTTP API with plain fetch so no mail library has to be added.
//
// Off unless RESEND_API_KEY and MAIL_FROM are set, so environments without
// mail keep their current behaviour. Settings:
//   RESEND_API_KEY  API key from https://resend.com (sending domain verified there)
//   MAIL_FROM       e.g. "Start Pray <no-reply@example.com>"

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;

export function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

export async function sendMail({ to, subject, text }) {
  if (!isMailConfigured()) {
    const error = new Error("MAIL_NOT_CONFIGURED");
    error.code = "MAIL_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM.trim(),
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend responded ${response.status}: ${detail.slice(0, 300)}`);
  }

  return response.json().catch(() => ({}));
}
