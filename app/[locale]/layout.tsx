import { notFound } from "next/navigation";
import { I18nProviderClient } from "../../locales/client";

export function generateStaticParams() {
  return [{ locale: "ka" }];
}

export default async function LocaleLayout({
  params,
  children,
}: {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
}) {
  const { locale } = await params;

  if (locale !== "ka") {
    notFound();
  }

  return <I18nProviderClient locale={locale}>{children}</I18nProviderClient>;
}
