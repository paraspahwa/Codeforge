import { NextResponse } from "next/server";

const COOKIE_NAME = "codeforge_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function cookieOptions() {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

function encodeSession(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeSession(value) {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const data = JSON.parse(json);
    if (data?.access_token && data?.user_id) {
      return data;
    }
  } catch {
    // invalid cookie
  }
  return null;
}

export async function GET(request) {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  const session = raw ? decodeSession(raw) : null;
  if (!session) {
    return NextResponse.json({ access_token: null, user_id: null });
  }
  return NextResponse.json(session);
}

export async function POST(request) {
  const body = await request.json();
  const accessToken = String(body?.access_token || "").trim();
  const userId = String(body?.user_id || "").trim();
  if (!accessToken || !userId) {
    return NextResponse.json({ detail: "access_token and user_id are required" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, encodeSession({ access_token: accessToken, user_id: userId }), cookieOptions());
  return response;
}
