'use client';

import { usePathname } from 'next/navigation';
import ClientChatWidget from './ClientChatWidget';

export default function ConditionalChatWidget() {
  const pathname = usePathname();

  // Don't show widget on control-panel page
  if (pathname === '/control-panel') {
    return null;
  }

  return <ClientChatWidget />;
}
