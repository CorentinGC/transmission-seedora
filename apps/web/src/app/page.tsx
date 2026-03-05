'use client';

import dynamic from 'next/dynamic';

// Disable SSR entirely — this is an SPA with client-side i18n and localStorage
const SeedoraApp = dynamic(() => import('@/lib/SeedoraApp'), { ssr: false });

export default function Page() {
  return <SeedoraApp />;
}
