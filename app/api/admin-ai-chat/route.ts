import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// Load products directly from Firestore with all fields including WooCommerce ID for site links
async function loadProductsWithLinks(): Promise<any[]> {
  try {
    const productsRef = db.collection("products");
    const snapshot = await productsRef.get();

    // First pass: build map of parent product names to their IDs
    const parentProducts = new Map<string, string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.type === 'variable') {
        const parentName = data.name || doc.id;
        parentProducts.set(parentName, data.id || doc.id);
      }
    });

    // Second pass: map only variations and simple products (NOT parent/variable products)
    return snapshot.docs
      .filter(doc => {
        const data = doc.data();
        // Exclude parent products (type: variable) - they don't have real stock
        return data.type !== 'variable';
      })
      .map(doc => {
        const data = doc.data();
        const wcId = data.id || doc.id;
        const productName = data.name || doc.id;

        // For variations, find parent product ID for the link
        let linkId = wcId;
        if (data.type === 'variation') {
          // Extract parent name from variation name (e.g., "აგურისფერი სადა ქუდი - L" → "აგურისფერი სადა ქუდი")
          const parentName = productName.replace(/\s*-\s*(L|M|S|XS|XXS|XXXS)\s*$/i, '').trim();
          if (parentProducts.has(parentName)) {
            linkId = parentProducts.get(parentName)!;
          }
        }

        return {
          id: wcId,
          name: productName,
          price: data.price || data.sale_price || "0",
          stock: data.stock_qty ?? data.stock ?? 0,
          category: data.categories || data.category || "",
          siteLink: `https://bebias.ge/?p=${linkId}` // Use parent ID for variations
        };
      });
  } catch (err) {
    console.error("Error loading products with links:", err);
    return [];
  }
}

// Get recent orders from Firestore
async function getRecentOrders(limit: number = 20): Promise<any[]> {
  try {
    const ordersRef = db.collection("orders");
    const snapshot = await ordersRef
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error("Error fetching orders:", err);
    return [];
  }
}

// Get order statistics
async function getOrderStats(): Promise<any> {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(1);

    const ordersRef = db.collection("orders");
    const allOrdersSnapshot = await ordersRef.get();

    let todayOrders = 0;
    let weekOrders = 0;
    let monthOrders = 0;
    let totalRevenue = 0;
    let todayRevenue = 0;
    let statusCounts: Record<string, number> = {};

    allOrdersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
      const total = parseFloat(data.total) || 0;

      totalRevenue += total;

      if (createdAt >= todayStart) {
        todayOrders++;
        todayRevenue += total;
      }
      if (createdAt >= weekStart) {
        weekOrders++;
      }
      if (createdAt >= monthStart) {
        monthOrders++;
      }

      const status = data.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    return {
      totalOrders: allOrdersSnapshot.size,
      todayOrders,
      weekOrders,
      monthOrders,
      totalRevenue: totalRevenue.toFixed(2),
      todayRevenue: todayRevenue.toFixed(2),
      statusBreakdown: statusCounts
    };
  } catch (err) {
    console.error("Error fetching order stats:", err);
    return null;
  }
}

// Get conversation stats
async function getConversationStats(): Promise<any> {
  try {
    const conversationsRef = db.collection("conversations");
    const snapshot = await conversationsRef.get();

    let totalConversations = snapshot.size;
    let manualModeCount = 0;
    let needsAttentionCount = 0;
    let totalMessages = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.manualMode) manualModeCount++;
      if (data.needsAttention) needsAttentionCount++;
      totalMessages += data.history?.length || 0;
    });

    return {
      totalConversations,
      manualModeCount,
      needsAttentionCount,
      totalMessages,
      avgMessagesPerConversation: totalConversations > 0
        ? (totalMessages / totalConversations).toFixed(1)
        : 0
    };
  } catch (err) {
    console.error("Error fetching conversation stats:", err);
    return null;
  }
}

// Search orders by various criteria
async function searchOrders(query: string): Promise<any[]> {
  try {
    const ordersRef = db.collection("orders");
    const snapshot = await ordersRef.limit(100).get();

    const lowerQuery = query.toLowerCase();
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((order: any) => {
        const searchableText = [
          order.orderNumber,
          order.customerName,
          order.telephone,
          order.address,
          order.products?.join(" "),
          order.status
        ].filter(Boolean).join(" ").toLowerCase();

        return searchableText.includes(lowerQuery);
      });
  } catch (err) {
    console.error("Error searching orders:", err);
    return [];
  }
}

// POST /api/admin-ai-chat
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, chatHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    console.log(`🤖 Admin AI Chat: "${message}"`);

    // Gather context data based on the question
    const [products, recentOrders, orderStats, conversationStats] = await Promise.all([
      loadProductsWithLinks(),
      getRecentOrders(15),
      getOrderStats(),
      getConversationStats()
    ]);

    // Check if the question mentions searching for specific order/customer
    const searchTerms = message.match(/order[:\s#]*(\w+)|customer[:\s]*([^\s,]+)|phone[:\s]*(\d+)/i);
    let searchResults: any[] = [];
    if (searchTerms) {
      const searchQuery = searchTerms[1] || searchTerms[2] || searchTerms[3];
      if (searchQuery) {
        searchResults = await searchOrders(searchQuery);
      }
    }

    // Build context for AI
    const contextData = {
      products: {
        total: products.length,
        list: products.map(p => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          category: p.category,
          siteLink: p.siteLink
        }))
      },
      recentOrders: recentOrders.map(o => ({
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        telephone: o.telephone,
        products: o.products,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt?.toDate?.()?.toISOString() || o.createdAt
      })),
      orderStats,
      conversationStats,
      searchResults: searchResults.length > 0 ? searchResults.slice(0, 10) : null
    };

    const systemPrompt = `You are an AI assistant for the VENERA/BEBIAS e-commerce admin control panel. You help managers with questions about:
- Product inventory and stock levels
- Order status and history
- Sales statistics and analytics
- Customer conversations
- Business operations

You have access to real-time data from the system. Be concise, helpful, and format responses clearly.

Current System Data:
${JSON.stringify(contextData, null, 2)}

Guidelines:
- Answer in the same language as the question (Georgian or English)
- Be specific with numbers and data
- If asked about a specific order/customer, use the search results
- Format prices in GEL (Georgian Lari)
- Keep responses concise but informative
- If data is not available, say so clearly
- When listing products, ALWAYS include the siteLink as a clickable link
- Format product links as markdown: [product name](siteLink)
- IMPORTANT: When asked "რა გვაქვს" or "რომელი გვაქვს" (what do we have), ONLY show products with stock > 0
- Products with stock = 0 are OUT OF STOCK - don't include them in availability lists unless specifically asked about all products
- CRITICAL: When user asks for a specific size (L, M, S, XS, etc.), ONLY show products that END with that exact size suffix (e.g., "- L" for L size). Do NOT include other sizes!
- Size is indicated at the end of product name after " - " (e.g., "ქუდი - L" is L size, "ქუდი - M" is M size)`;

    // Build messages with history
    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemPrompt }
    ];

    // Add chat history (last 10 messages)
    const recentHistory = chatHistory.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content
      });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content || "Sorry, I couldn't process that question.";

    return NextResponse.json({
      success: true,
      response,
      context: {
        productsCount: products.length,
        ordersCount: orderStats?.totalOrders || 0
      }
    });

  } catch (error: any) {
    console.error("Admin AI Chat error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/admin-ai-chat - Quick stats endpoint
export async function GET() {
  try {
    const [orderStats, conversationStats] = await Promise.all([
      getOrderStats(),
      getConversationStats()
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        orders: orderStats,
        conversations: conversationStats
      }
    });
  } catch (error: any) {
    console.error("Admin AI Chat GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
