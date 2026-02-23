import { Resend } from "resend";
import { log } from "~/lib/logger.server";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Viagen <boa@viagen.dev>";
const APP_URL = "https://app.viagen.dev";

export async function sendOrgInviteEmail({
  to,
  orgName,
  orgId,
  inviterName,
}: {
  to: string;
  orgName: string;
  orgId: string;
  inviterName: string;
}) {
  if (!resend) {
    log.warn("skipping invite email: RESEND_API_KEY not configured");
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been added to ${orgName} on Viagen`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px;">You're in!</h2>
  <p style="line-height: 1.6; margin: 0 0 12px;">
    <strong>${inviterName}</strong> added you to <strong>${orgName}</strong> on Viagen.
  </p>
  <p style="line-height: 1.6; margin: 0 0 24px;">
    You can now access shared projects, launch sandboxes, and manage secrets for the team.
  </p>
  <a href="${APP_URL}/?org=${orgId}"
     style="display: inline-block; background: #18181b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
    Open Dashboard
  </a>
  <p style="margin-top: 32px; font-size: 13px; color: #71717a;">
    If you don't have an account yet, you'll be prompted to log in first.
  </p>
</body>
</html>`.trim(),
  });

  if (error) {
    log.error({ to, orgName, error }, "failed to send org invite email");
  } else {
    log.info({ to, orgName }, "org invite email sent");
  }
}
