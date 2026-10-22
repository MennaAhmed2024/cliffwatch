'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function Motion() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let alive = true;
    let cleanup: (() => void) | undefined;
    Promise.all([import('lenis'), import('gsap')]).then(([{ default: Lenis }, { default: gsap }]) => {
      if (!alive) return;
      const lenis = new Lenis({ autoRaf: true, duration: 0.85 });
      const tween = gsap.fromTo('[data-entrance]', { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.38, stagger: 0.035, ease: 'power2.out' });
      cleanup = () => { tween.kill(); lenis.destroy(); };
    });
    return () => { alive = false; cleanup?.(); };
  }, [pathname]);
  return null;
}
