/**
 * WOLT FLOW TEST ENDPOINT
 *
 * Tests the REAL Shipping Manager APIs step by step.
 * Shows exactly what requests are sent and what responses are received.
 *
 * Usage:
 * POST /api/test-wolt-flow
 * { "address": "ვაჟა-ფშაველას 71" }
 *
 * Returns all API call logs and responses.
 */

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { db } from "@/lib/firestore";
import { logOrder } from "@/lib/orderLoggerWithFirestore";
import { OrderData } from "@/lib/sendOrderEmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SHIPPING_MANAGER_URL = "https://shipping-manager-standalone.vercel.app";

interface TestLog {
  step: string;
  request: { url: string; method: string; body?: any };
  response: any;
  duration: number;
  timestamp: string;
}

interface TestResult {
  success: boolean;
  logs: TestLog[];
  summary: {
    address: string;
    validated: boolean;
    coordinates?: { lat: number; lon: number };
    deliveryPrice?: number;
    eta?: number;
    mapLink?: string;
    sessionId?: string;
    orderNumber?: string;
  };
  error?: string;
}

async function testStep(
  stepName: string,
  url: string,
  method: string,
  body?: any
): Promise<{ log: TestLog; data: any }> {
  const startTime = Date.now();

  console.log(`\n[TEST-WOLT-FLOW] ====== ${stepName} ======`);
  console.log(`[TEST-WOLT-FLOW] Request: ${method} ${url}`);
  if (body) console.log(`[TEST-WOLT-FLOW] Body:`, JSON.stringify(body, null, 2));

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    const duration = Date.now() - startTime;

    console.log(`[TEST-WOLT-FLOW] Response (${duration}ms):`, JSON.stringify(data, null, 2));

    return {
      log: {
        step: stepName,
        request: { url, method, body },
        response: data,
        duration,
        timestamp: new Date().toISOString(),
      },
      data,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorData = { error: error instanceof Error ? error.message : "Unknown error" };

    console.log(`[TEST-WOLT-FLOW] Error (${duration}ms):`, errorData);

    return {
      log: {
        step: stepName,
        request: { url, method, body },
        response: errorData,
        duration,
        timestamp: new Date().toISOString(),
      },
      data: errorData,
    };
  }
}

export async function POST(request: NextRequest) {
  const result: TestResult = {
    success: false,
    logs: [],
    summary: { address: "", validated: false },
  };

  try {
    const body = await request.json();
    const address = body.address || "ვაჟა-ფშაველას 71";
    const testSenderId = body.senderId || `test-${Date.now()}`;
    const createOrder = body.createOrder === true;

    result.summary.address = address;

    console.log("\n" + "=".repeat(60));
    console.log("[TEST-WOLT-FLOW] STARTING WOLT FLOW TEST");
    console.log("=".repeat(60));
    console.log(`[TEST-WOLT-FLOW] Address: ${address}`);
    console.log(`[TEST-WOLT-FLOW] SenderId: ${testSenderId}`);
    console.log(`[TEST-WOLT-FLOW] Create Order: ${createOrder}`);

    // ==================== STEP 1: Validate Address ====================
    const step1 = await testStep(
      "1. Validate Address",
      `${SHIPPING_MANAGER_URL}/api/address/validate`,
      "POST",
      { address }
    );
    result.logs.push(step1.log);

    if (step1.data.error) {
      result.error = "Address validation failed";
      return NextResponse.json(result);
    }

    result.summary.validated = step1.data.action !== "ASK_FOR_ADDRESS";

    // ==================== STEP 2: Get Wolt Estimate ====================
    const step2 = await testStep(
      "2. Get Wolt Estimate (Price)",
      `${SHIPPING_MANAGER_URL}/api/wolt/estimate`,
      "POST",
      { address, city: "თბილისი" }
    );
    result.logs.push(step2.log);

    if (step2.data.available) {
      result.summary.deliveryPrice = step2.data.price;
      result.summary.eta = step2.data.eta_minutes;
    }

    // ==================== STEP 3: Generate Map Link ====================
    const CALLBACK_URL = "https://bebias-venera-chatbot.vercel.app/api/location-confirmed-webhook";

    const step3 = await testStep(
      "3. Generate Map Confirmation Link",
      `${SHIPPING_MANAGER_URL}/api/location/generate-link`,
      "POST",
      { address, senderId: testSenderId, callbackUrl: CALLBACK_URL }
    );
    result.logs.push(step3.log);

    if (step3.data.link) {
      result.summary.mapLink = step3.data.link;
      result.summary.sessionId = step3.data.sessionId;
    }

    // ==================== STEP 4: Check Confirmed Location ====================
    // Note: This will return not confirmed since we're just testing
    if (step3.data.sessionId) {
      const step4 = await testStep(
        "4. Check Confirmed Location (will be false without user action)",
        `${SHIPPING_MANAGER_URL}/api/location/confirm?sessionId=${step3.data.sessionId}`,
        "GET"
      );
      result.logs.push(step4.log);

      if (step4.data.confirmed && step4.data.data) {
        result.summary.coordinates = {
          lat: step4.data.data.lat,
          lon: step4.data.data.lon,
        };
      }
    }

    // ==================== STEP 5: Simulate Location Confirmation ====================
    // Directly write to Firestore to simulate user confirming on map
    const testLat = 41.7151;
    const testLon = 44.8271;

    console.log(`\n[TEST-WOLT-FLOW] ====== 5. Simulating Location Confirmation ======`);
    console.log(`[TEST-WOLT-FLOW] Writing confirmed location to Firestore...`);

    await db.collection("confirmedLocations").doc(step3.data.sessionId).set({
      lat: testLat,
      lon: testLon,
      address: address,
      confirmed: true,
      timestamp: new Date().toISOString(),
      source: "test",
    });

    result.logs.push({
      step: "5. Simulate Location Confirmation (Firestore Write)",
      request: {
        url: "Firestore: confirmedLocations",
        method: "SET",
        body: { lat: testLat, lon: testLon, address, confirmed: true },
      },
      response: { success: true, message: "Location confirmed in Firestore" },
      duration: 0,
      timestamp: new Date().toISOString(),
    });

    result.summary.coordinates = { lat: testLat, lon: testLon };

    // ==================== STEP 6: Create Order (if requested) ====================
    if (createOrder) {
      console.log(`\n[TEST-WOLT-FLOW] ====== 6. Creating Order ======`);

      const orderData: OrderData = {
        product: body.product || "შავი ბამბის მოკლე ქუდი M",
        quantity: body.quantity || "1",
        clientName: body.clientName || "ტესტ მომხმარებელი",
        telephone: body.telephone || "555123456",
        address: `${address}, თბილისი`,
        total: `${(body.productPrice || 49) + (result.summary.deliveryPrice || 0)} ლარი`,
        deliveryMethod: "wolt",
        deliveryCompany: "wolt",
        deliveryPrice: result.summary.deliveryPrice,
        etaMinutes: result.summary.eta,
        sessionId: step3.data.sessionId,
        lat: testLat,
        lon: testLon,
        deliveryInstructions: body.deliveryInstructions || "",
        isWoltOrder: true,
      };

      console.log(`[TEST-WOLT-FLOW] Order data:`, JSON.stringify(orderData, null, 2));

      const orderNumber = await logOrder(orderData, "wolt", { skipStockUpdate: true });

      result.logs.push({
        step: "6. Create Order",
        request: {
          url: "Firestore: orders (via logOrder)",
          method: "CREATE",
          body: orderData,
        },
        response: { success: true, orderNumber },
        duration: 0,
        timestamp: new Date().toISOString(),
      });

      result.summary.orderNumber = orderNumber;

      // Verify order in Firestore
      const orderDoc = await db.collection("orders").doc(orderNumber).get();
      if (orderDoc.exists) {
        result.logs.push({
          step: "7. Verify Order in Firestore",
          request: { url: `Firestore: orders/${orderNumber}`, method: "GET" },
          response: orderDoc.data(),
          duration: 0,
          timestamp: new Date().toISOString(),
        });
      }
    }

    result.success = true;

    console.log("\n" + "=".repeat(60));
    console.log("[TEST-WOLT-FLOW] TEST COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60));
    console.log(`[TEST-WOLT-FLOW] Summary:`, JSON.stringify(result.summary, null, 2));

    return NextResponse.json(result);

  } catch (error) {
    console.error("[TEST-WOLT-FLOW] Error:", error);
    result.error = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(result, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: "/api/test-wolt-flow",
    description: "Tests the complete Wolt delivery flow with Shipping Manager APIs",
    usage: {
      method: "POST",
      body: {
        address: "Customer address (required)",
        senderId: "Optional test sender ID",
        createOrder: "Set to true to create a real order in Firestore",
        product: "Product name (optional)",
        productPrice: "Product price (optional, default 49)",
        clientName: "Customer name (optional)",
        telephone: "Phone number (optional)",
        deliveryInstructions: "Instructions for courier (optional)",
      },
    },
    apisCalled: [
      "POST /api/address/validate - Validate and parse address",
      "POST /api/wolt/estimate - Get delivery price and ETA",
      "POST /api/location/generate-link - Generate map confirmation link",
      "GET /api/location/confirm - Check if location was confirmed",
    ],
    shippingManagerUrl: SHIPPING_MANAGER_URL,
  });
}
