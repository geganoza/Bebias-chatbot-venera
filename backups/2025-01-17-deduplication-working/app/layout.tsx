// app/layout.tsx
import type { Metadata } from "next";
import { Geist_Mono, Montserrat } from "next/font/google";
import Script from "next/script";
import Analytics from "./analytics";
import "./globals.css";
import { Suspense } from "react";
import ConditionalChatWidget from "../components/ConditionalChatWidget";

const montserrat = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Martivi Consulting – Digital Growth Services",
    template: "%s | Martivi Consulting",
  },
  description:
    "Full-stack digital marketing, sales-enablement and business-development services from Tbilisi-based consultants.",
  metadataBase: new URL("https://www.martiviconsulting.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.martiviconsulting.com",
    title: "Martivi Consulting – Digital Growth Services",
    description:
      "Full-stack digital marketing, sales-enablement and business-development services.",
    siteName: "Martivi Consulting",
    images: [
      {
        url: "/images/martivi-consulting-logo.png",
        width: 1200,
        height: 630,
        alt: "Martivi Consulting",
      },
    ],
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${geistMono.variable} antialiased`}
      >
        {/* Google Analytics */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', { anonymize_ip: true });
              `}
            </Script>
            <Suspense fallback={null}>
              <Analytics />
            </Suspense>
          </>
        )}

        {/* Meta Pixel */}
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '768277356187018');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
<img
  height="1"
  width="1"
  style={{ display: "none" }}
  src="https://www.facebook.com/tr?id=768277356187018&ev=PageView&noscript=1"
  alt=""
/>
        </noscript>

        {children}
        <ConditionalChatWidget /> {/* floating button bottom-right, hidden on meta-review */}
      </body>
    </html>
  );
}