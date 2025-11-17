import { NextResponse } from "next/server";

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipientId = searchParams.get("recipient");
  const testType = searchParams.get("type") || "encoded"; // "encoded" or "unencoded"

  if (!recipientId) {
    return NextResponse.json({ error: "Missing recipient parameter" }, { status: 400 });
  }

  const encodedUrl = "https://bebias.ge/wp-content/uploads/%E1%83%A1%E1%83%A2%E1%83%90%E1%83%A4%E1%83%98%E1%83%9A%E1%83%9D%E1%83%A1%E1%83%A4%E1%83%94%E1%83%A0%E1%83%98-%E1%83%A5%E1%83%A3%E1%83%93%E1%83%98.jpg";
  const unencodedUrl = "https://bebias.ge/wp-content/uploads/სტაფილოსფერი-ქუდი.jpg";
  const imageUrl = testType === "encoded" ? encodedUrl : unencodedUrl;

  console.log(`🧪 Testing ${testType} URL: ${imageUrl}`);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            attachment: {
              type: "image",
              payload: {
                url: imageUrl,
                is_reusable: true,
              },
            },
          },
        }),
      }
    );

    const data = await response.json();

    return NextResponse.json({
      testType,
      imageUrl,
      status: response.status,
      response: data,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
    }, { status: 500 });
  }
}
