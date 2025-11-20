import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

export async function POST() {
  try {
    const testUserId = "test_user_12345678";

    const conversation = {
      userId: testUserId,
      messages: [
        {
          id: `${Date.now()}-1`,
          senderId: testUserId,
          senderType: 'user' as const,
          text: 'გამარჯობა! რა ფერის ქუდები გაქვთ?',
          timestamp: new Date(Date.now() - 60000).toISOString()
        },
        {
          id: `${Date.now()}-2`,
          senderId: 'VENERA_BOT',
          senderType: 'bot' as const,
          text: 'გამარჯობა! 👋 გვაქვს სხვადასხვა ფერის ქუდები:\n\n1. ფირუზისფერი ბამბის მოკლე ქუდი - 49 ლარი\n2. სტაფილოსფერი ბამბის მოკლე ქუდი - 49 ლარი\n3. თეთრი გაუღებავი ბამბის ქუდი - 45 ლარი\n4. ფირუზისფერი მატყლის პომპონიანი ქუდი - 55 ლარი\n\nრომელი გაინტერესებთ? 😊',
          timestamp: new Date(Date.now() - 55000).toISOString()
        },
        {
          id: `${Date.now()}-3`,
          senderId: testUserId,
          senderType: 'user' as const,
          text: 'სტაფილოსფერი მომწონს! ფოტო გაქვთ?',
          timestamp: new Date(Date.now() - 30000).toISOString()
        },
        {
          id: `${Date.now()}-4`,
          senderId: 'VENERA_BOT',
          senderType: 'bot' as const,
          text: 'რა თქმა უნდა! აი სტაფილოსფერი ბამბის მოკლე ქუდი - ძალიან კომფორტული და სტილური! 🧡\n\nფასი: 49 ლარი\nმასალა: 100% ბამბა\nზომები: უნივერსალური\n\nგსურთ შეკვეთა?',
          timestamp: new Date(Date.now() - 25000).toISOString()
        },
        {
          id: `${Date.now()}-5`,
          senderId: testUserId,
          senderType: 'user' as const,
          text: 'დიახ! როგორ შევუკვეთო?',
          timestamp: new Date(Date.now() - 10000).toISOString()
        },
        {
          id: `${Date.now()}-6`,
          senderId: 'VENERA_BOT',
          senderType: 'bot' as const,
          text: 'მშვენიერია! 🎉 დამიწერეთ:\n\n1. თქვენი სახელი და გვარი\n2. ტელეფონის ნომერი\n3. მიწოდების მისამართი\n4. სასურველი მიწოდების დრო\n\nშეკვეთას დავადასტურებ და 1-2 სამუშაო დღეში მიიღებთ!',
          timestamp: new Date(Date.now() - 5000).toISOString()
        }
      ]
    };

    await db.collection('metaMessages').doc(testUserId).set(conversation);

    return NextResponse.json({
      success: true,
      message: "Test data populated",
      userId: testUserId,
      messageCount: conversation.messages.length
    });
  } catch (error) {
    console.error("Error populating test data:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to populate test data for meta-review dashboard"
  });
}
