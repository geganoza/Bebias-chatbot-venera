'use client';
import React from 'react';
import ClientChatWidget from '../../components/ClientChatWidget';

export default function Page() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: 420, maxWidth: '100%' }}>
        <ClientChatWidget />
      </div>
    </div>
  );
}
