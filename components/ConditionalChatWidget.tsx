'use client';

import { usePathname } from 'next/navigation';
import ClientChatWidget from './ClientChatWidget';

export default function ConditionalChatWidget() {
  const pathname = usePathname();

  // Don't show widget on meta-review page
  if (pathname === '/meta-review') {
    return null;
  }

  return <ClientChatWidget />;
}
