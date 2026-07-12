'use client';

import { useEffect, useState } from 'react';

export default function CurrentDate() {
  const [mounted, setMounted] = useState(false);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setMounted(true);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    setDateStr(new Date().toLocaleDateString(undefined, options));
  }, []);

  if (!mounted) return <div className="h-4 w-32 bg-secondary animate-pulse rounded"></div>;

  return <span>{dateStr}</span>;
}
