'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function Motion() {
  const pathname = usePathname();
  useEffect(() => {
    let alive = true;
    let cleanup: (() => void) | undefined;
    Promise.all([import('lenis'), import('gsap')]).then(([{ default: Lenis }, { default: gsap }]) => {
      if (!alive) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const lenis = new Lenis({ duration: 1.05, autoRaf: false, anchors: true, smoothWheel: !reduce });
      const tick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      const context = gsap.context(() => {
        if (reduce) return;
        const entrances = gsap.utils.toArray<HTMLElement>('[data-entrance]');
        const progressBars = gsap.utils.toArray<HTMLElement>('[data-progress]');
        const orbitMarks = gsap.utils.toArray<HTMLImageElement>('.heading-orbit img');
        if (entrances.length) gsap.fromTo(entrances, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .7, stagger: .065, ease: 'power3.out', clearProps: 'transform' });
        if (progressBars.length) gsap.fromTo(progressBars, { scaleX: 0 }, { scaleX: 1, duration: 1.1, delay: .25, stagger: .08, ease: 'power3.out', transformOrigin: 'left center' });
        if (orbitMarks.length) gsap.fromTo(orbitMarks, { rotate: -14, scale: .88 }, { rotate: 0, scale: 1, duration: 1.15, ease: 'elastic.out(1, .55)' });
      });
      cleanup = () => { context.revert(); gsap.ticker.remove(tick); lenis.destroy(); };
    });
    return () => { alive = false; cleanup?.(); };
  }, [pathname]);
  return null;
}
