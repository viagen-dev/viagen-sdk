export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const { code } = (await request.json()) as { code?: string };
  if (!code) {
    return Response.json({ error: "Invite code is required" }, { status: 400 });
  }

  const validCodes = (process.env.INVITE_CODES ?? "")
    .split(",")
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);

  if (validCodes.length === 0) {
    console.warn("[invite] No INVITE_CODES configured — allowing all access");
    // If no codes configured, skip the gate
  } else if (!validCodes.includes(code.trim().toLowerCase())) {
    console.log(`[invite] Invalid invite code attempted: ${code}`);
    return Response.json({ error: "Invalid invite code" }, { status: 401 });
  }

  console.log(`[invite] Valid invite code used: ${code}`);

  const isSecure = new URL(request.url).protocol === "https:";
  const cookie = [
    `viagen-invite=1`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${365 * 24 * 60 * 60}`,
    ...(isSecure ? ["Secure"] : []),
  ].join("; ");

  return Response.json(
    { success: true },
    { headers: { "Set-Cookie": cookie } },
  );
}
