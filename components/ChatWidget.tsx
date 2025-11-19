"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Role = "system" | "user" | "assistant";
type Message = { role: Role; content: string };

// System prompt for better language handling
const SYSTEM_PROMPT = `You are a helpful bilingual assistant for MARTIVI DIGITAL / MARTIVI CONSULTING.
Reply strictly in the same language as the user's latest message — Georgian or English. Do not mix languages.
If the user writes in Georgian, answer fully in Georgian. If the user writes in English, answer fully in English.`;

const BRAND_BG = "#12324C";          // dark brand
const CTA_BLUE = "#578096";          // booking button

// Calendly + API base from env (safe for static export too)
const CALENDLY =
  process.env.NEXT_PUBLIC_CALENDLY_LINK ||
  "https://calendly.com/martividigital/30min";

const API_BASE = process.env.NEXT_PUBLIC_CHAT_API_BASE || "";

// detect "book a call" suggestion in EN + KA
const suggestsCallIn = (text: string) =>
  /schedule.*call|book.*call|discovery call|ჩანიშნე\s?ზარი|ზარის\s?ჩანიშვ/i.test(
    text
  );

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [started, setStarted] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Detect Georgian mode based on current page URL instead of bot messages
  const [georgianMode, setGeorgianMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGeorgianMode(window.location.pathname.includes('/ka'));
    }
  }, []);

  // inline lead capture
  const [leadOpen, setLeadOpen] = useState(false);
  const [lead, setLead] = useState({
    name: "",
    email: "",
    company: "",
    budget: "",
    timeline: "",
    country: "",
  });
  const [leadSent, setLeadSent] = useState(false);

  // Auto-start conversation on first open with typing animation
  useEffect(() => {
    if (open && !started && messages.length === 0) {
      setStarted(true);
      setLoading(true);

      // Simulate typing delay
      setTimeout(() => {
        const greeting = georgianMode
          ? "გამარჯობა! 👋\n\nქვემოთ აირჩიეთ ერთ-ერთი ვარიანტი ან უბრალოდ მკითხეთ რაც გაინტერესებთ."
          : "Hello! 👋\n\nChoose an option below, or just ask a question and I'll help you.";

        setMessages([{
          role: "assistant",
          content: greeting
        }]);
        setLoading(false);
      }, 1500);
    }
  }, [open, started, messages.length, georgianMode]);

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading, leadOpen]);

  const lastBot = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages]
  );

  const showBookCTA = !!lastBot && suggestsCallIn(lastBot.content);

  async function sendMessage(userText?: string) {
    const text = (userText ?? input).trim();
    if (!text) return;

    const userMsg: Message = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    const paymentKeywords = georgianMode ? ['გადავიხადე', 'გადმოვრიცხე', 'გავაგზავნე'] : ['paid', 'sent', 'transferred'];
    const mentionsPayment = paymentKeywords.some(keyword => text.toLowerCase().includes(keyword));
    if (mentionsPayment) {
      setIsVerifying(true);
    }

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...nextMessages],
          lead:
            leadSent || !leadOpen
              ? undefined
              : {
                  name: lead.name || undefined,
                  email: lead.email || undefined,
                  company: lead.company || undefined,
                  budget: lead.budget || undefined,
                  timeline: lead.timeline || undefined,
                  country: lead.country || undefined,
                },
        }),
      });
      const data = await res.json();

      // sanitize any Calendly links from bot text; we show our own button
      const rawReply: string = typeof data.reply === "string" ? data.reply : "";
      const cleanedReply = rawReply
        .replace(/\[.*?\]\(https?:\/\/calendly\.com[^\)]*\)/gi, "")
        .replace(/https?:\/\/calendly\.com[^\s)]+/gi, "")
        .trim();

      const botMsg: Message = { role: "assistant", content: cleanedReply || "…" };
      setMessages([...nextMessages, botMsg]);

      // open lead form the first time bot suggests booking
      if (!leadSent && suggestsCallIn(cleanedReply)) {
        setLeadOpen(true);
      }
    } catch (err) {
      console.error(err);
      const botMsg: Message = {
        role: "assistant",
        content: georgianMode
          ? "უფ, პრობლემა წარმოიშვა. სცადეთ კიდევ ერთხელ."
          : "Oops, something went wrong. Please try again.",
      };
      setMessages([...nextMessages, botMsg]);
    } finally {
      setLoading(false);
      setIsVerifying(false);
    }
  }

  function submitLeadOnly() {
    // Push a brief note so the API receives the lead payload together with context
    sendMessage(
      georgianMode
        ? "ამატებ საკონტაქტო დეტალებს."
        : "Submitting my contact details."
    );
    setLeadSent(true);
    setLeadOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          padding: "12px 16px",
          borderRadius: 999,
          border: "none",
          background: BRAND_BG,
          color: "#fff",
          fontWeight: 700,
          cursor: "pointer",
          zIndex: 50,
          boxShadow: "0 8px 24px rgba(0,0,0,.25)",
        }}
      >
        {georgianMode ? "ჩატის გახსნა" : "Chat with us"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 80,
            width: 360,
            height: 520,
            display: "flex",
            flexDirection: "column",
            background: "#fff",
            border: "1px solid #e6e6e6",
            borderRadius: 14,
            boxShadow: "0 18px 48px rgba(0,0,0,.30)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: 12,
              background: BRAND_BG,
              color: "#fff",
              fontWeight: 800,
              letterSpacing: 0.2,
            }}
          >
            <span>{georgianMode ? "მარტივი კონსალტინგი" : "MARTIVI CONSULTING"}</span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 18,
                cursor: "pointer",
              }}
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 12,
              fontSize: 14,
              background: "#fafbfc",
            }}
          >
            {messages.map((m, i) => {
              const isBot = m.role === "assistant";
              return (
                <div
                  key={i}
                  style={{
                    marginBottom: 10,
                    textAlign: isBot ? "left" : "right",
                  }}
                >
                  <div
                    style={{
                      display: "inline-block",
                      maxWidth: "85%",
                      padding: "9px 12px",
                      borderRadius: 12,
                      background: isBot ? "#eef2f6" : BRAND_BG,
                      color: isBot ? "#0f172a" : "#fff",
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                      boxShadow: isBot ? "none" : "0 2px 10px rgba(0,0,0,.15)",
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div style={{ opacity: 0.7, fontStyle: "italic" }}>
                {isVerifying
                  ? georgianMode ? "გადახდის ვერიფიკაცია…" : "Verifying payment…"
                  : georgianMode ? "ასისტენტი წერს…" : "assistant is typing…"}
              </div>
            )}

            {/* Quick reply buttons on first greeting */}
            {started && messages.length === 1 && messages[0]?.role === "assistant" && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => sendMessage(georgianMode ? "ინფორმაცია სერვისებზე" : "Info about services")}
                  style={quickBtnStyle}
                >
                  {georgianMode ? "ინფორმაცია სერვისებზე" : "Info about services"}
                </button>
                <button
                  onClick={() => setLeadOpen(true)}
                  style={quickBtnStyle}
                >
                  {georgianMode ? "ზარის ჩანიშვნა" : "Schedule a call"}
                </button>
                <a
                  href="tel:+995577273090"
                  style={{ ...quickBtnStyle, textDecoration: "none", display: "inline-block", textAlign: "center" }}
                >
                  {georgianMode ? "დარეკვა" : "Call now"}
                </a>
                <a
                  href="mailto:contact@martiviconsulting.com"
                  style={{ ...quickBtnStyle, textDecoration: "none", display: "inline-block", textAlign: "center" }}
                >
                  {georgianMode ? "იმეილის გაგზავნა" : "Send email"}
                </a>
              </div>
            )}

            {/* Smart CTAs */}
            {showBookCTA && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a
                  href={CALENDLY}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    textDecoration: "none",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: CTA_BLUE,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    display: "inline-block",
                  }}
                >
                  {georgianMode ? "📅 ჩანიშნე ზარი" : "📅 Book a Call"}
                </a>

                <a
                  href="tel:+995577273090"
                  style={{
                    textDecoration: "none",
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: BRAND_BG,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    display: "inline-block",
                  }}
                >
                  {georgianMode ? "📞 დარეკვა" : "📞 Call +995 577 27 30 90"}
                </a>

                {!leadSent && (
                  <button
                    onClick={() => setLeadOpen((v) => !v)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "#e2e8f0",
                      color: "#0f172a",
                      fontWeight: 700,
                      fontSize: 14,
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {georgianMode ? "კონტაქტის დატოვება" : "Leave your details"}
                  </button>
                )}
              </div>
            )}

            {/* Lead form */}
            {leadOpen && !leadSent && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  border: "1px solid #e6e6e6",
                  borderRadius: 10,
                  background: "#fff",
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>
                  {georgianMode ? "საკონტაქტო ინფორმაცია" : "Contact details"}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    placeholder={georgianMode ? "სახელი და გვარი" : "Full name"}
                    value={lead.name}
                    onChange={(e) => setLead((l) => ({ ...l, name: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder="Email"
                    value={lead.email}
                    onChange={(e) => setLead((l) => ({ ...l, email: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder={georgianMode ? "კომპანია (არასავალდებულო)" : "Company (optional)"}
                    value={lead.company}
                    onChange={(e) => setLead((l) => ({ ...l, company: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder={georgianMode ? "ბიუჯეტის დიაპაზონი" : "Budget range"}
                    value={lead.budget}
                    onChange={(e) => setLead((l) => ({ ...l, budget: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder={georgianMode ? "ვადები" : "Timeline"}
                    value={lead.timeline}
                    onChange={(e) => setLead((l) => ({ ...l, timeline: e.target.value }))}
                    style={inputStyle}
                  />
                  <input
                    placeholder={georgianMode ? "ქვეყანა" : "Country"}
                    value={lead.country}
                    onChange={(e) => setLead((l) => ({ ...l, country: e.target.value }))}
                    style={inputStyle}
                  />

                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button
                      onClick={submitLeadOnly}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: CTA_BLUE,
                        color: "#fff",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {georgianMode ? "გაგზავნა" : "Submit"}
                    </button>
                    <button
                      onClick={() => setLeadOpen(false)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "#e2e8f0",
                        color: "#0f172a",
                        fontWeight: 700,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {georgianMode ? "დახურვა" : "Close"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <div style={{ display: "flex", borderTop: "1px solid #e6e6e6" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={georgianMode ? "შეტყობინება…" : "Type a message..."}
              style={{
                flex: 1,
                border: "none",
                padding: 12,
                outline: "none",
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading}
              style={{
                border: "none",
                background: BRAND_BG,
                color: "#fff",
                padding: "0 16px",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              {georgianMode ? "გაგზავნა" : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const quickBtnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "10px 12px",
  outline: "none",
};