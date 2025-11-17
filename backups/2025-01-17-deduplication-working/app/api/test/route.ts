import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const verifyToken = process.env.VERIFY_TOKEN;
  
  return NextResponse.json({
    hasToken: !!verifyToken,
    tokenLength: verifyToken?.length || 0,
    tokenPreview: verifyToken ? verifyToken.substring(0, 10) + "..." : "not set"
  });
}
