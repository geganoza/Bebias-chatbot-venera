import { NextResponse } from "next/server";
import { SignJWT } from "jose";

const CONTROL_PANEL_PASSWORD = process.env.CONTROL_PANEL_PASSWORD || "changeme123";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key-change-in-production"
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    // Validate password
    if (password !== CONTROL_PANEL_PASSWORD) {
      console.log("❌ Failed login attempt");
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Create JWT token
    const token = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    console.log("✅ Successful login to control panel");

    // Set HTTP-only cookie
    const response = NextResponse.json({ success: true });
    response.cookies.set("control-panel-auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("❌ Login error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
