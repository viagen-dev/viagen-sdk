import { Resend } from "resend";
import { log } from "~/lib/logger.server";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Viagen <notifications@viagen.dev>";
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

  const dashboardUrl = `${APP_URL}/?org=${orgId}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `You've been added to ${orgName} on Viagen`,
    text: `You're in!\n\n${inviterName} added you to ${orgName} on Viagen.\n\nYou can now access shared projects, launch sandboxes, and manage secrets for the team.\n\nOpen Dashboard: ${dashboardUrl}\n\nIf you don't have an account yet, you'll be prompted to log in first.`,
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
  <a href="${dashboardUrl}"
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

export async function sendTaskReadyEmail({
  to,
  projectName,
  projectId,
  taskId,
  taskPrompt,
  prUrl,
}: {
  to: string;
  projectName: string;
  projectId: string;
  taskId: string;
  taskPrompt: string;
  prUrl?: string | null;
}) {
  if (!resend) {
    log.warn("skipping task ready email: RESEND_API_KEY not configured");
    return;
  }

  const promptPreview =
    taskPrompt.length > 120 ? taskPrompt.slice(0, 120) + "..." : taskPrompt;

  const taskUrl = `${APP_URL}/projects/${projectId}/tasks/${taskId}`;

  const textParts = [
    `Task ready for review`,
    `\nA task in ${projectName} has finished and is ready for review:`,
    `\n"${promptPreview}"`,
    `\nView Task: ${taskUrl}`,
  ];
  if (prUrl) textParts.push(`Review PR: ${prUrl}`);
  textParts.push(`\n—\nViagen — ${projectName}`);

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Task ready for review — ${projectName}`,
    text: textParts.join("\n"),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <h2 style="margin: 0 0 16px;">Task ready for review</h2>
  <p style="line-height: 1.6; margin: 0 0 12px;">
    A task in <strong>${projectName}</strong> has finished and is ready for review:
  </p>
  <p style="line-height: 1.6; margin: 0 0 24px; padding: 12px 16px; background: #f4f4f5; border-radius: 6px; font-size: 14px;">
    ${promptPreview}
  </p>
  <div style="margin: 0 0 24px;">
    <a href="${taskUrl}"
       style="display: inline-block; background: #18181b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
      View Task
    </a>${
      prUrl
        ? `&nbsp;&nbsp;<a href="${prUrl}"
       style="display: inline-block; background: #fff; color: #18181b; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; border: 1px solid #e4e4e7;">
      Review PR
    </a>`
        : ""
    }
  </div>
  <p style="margin-top: 32px; font-size: 13px; color: #71717a;">
    Viagen — ${projectName}
  </p>
</body>
</html>`.trim(),
  });

  if (error) {
    log.error({ to, projectName, taskId, error }, "failed to send task ready email");
  } else {
    log.info({ to, projectName, taskId }, "task ready email sent");
  }
}
