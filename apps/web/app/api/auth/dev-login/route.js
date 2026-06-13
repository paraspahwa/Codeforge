import { NextResponse } from "next/server";

export async function POST(request) {
  const apiBase = (process.env.CODEFORGE_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(
    /\/$/,
    "",
  );
  const secret = process.env.CODEFORGE_DEV_LOGIN_SECRET || "";
  const body = await request.json();
  const headers = { "Content-Type": "application/json" };
  if (secret) {
    headers["X-Codeforge-Dev-Secret"] = secret;
  }

  const response = await fetch(`${apiBase}/api/v1/auth/dev-login`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = { detail: "Dev login failed" };
  }

  return NextResponse.json(data, { status: response.status });
}
