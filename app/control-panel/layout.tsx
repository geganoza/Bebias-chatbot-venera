import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Control Panel | VENERA Bot',
  description: 'Manage conversations and control bot responses',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1877f2',
};

export default function ControlPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
