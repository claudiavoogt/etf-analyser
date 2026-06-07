'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function Analyzer() {
  const params = useSearchParams();
  const t = params.get('t') || '';
  const src = t ? `/etf-analyzer-claudia.html?t=${encodeURIComponent(t)}` : '/etf-analyzer-claudia.html';

  return (
    <iframe
      src={src}
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Analyzer />
    </Suspense>
  );
}
