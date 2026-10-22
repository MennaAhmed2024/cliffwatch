'use client';

import { useRef, type HTMLAttributes, type PointerEvent } from 'react';

type Props = HTMLAttributes<HTMLDivElement>;

export function SpotlightCard({ children, className = '', onPointerMove, onPointerLeave, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  function move(event: PointerEvent<HTMLDivElement>) {
    const element = ref.current;
    if (element && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const rect = element.getBoundingClientRect();
      element.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
      element.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
      element.style.setProperty('--spot-opacity', '1');
    }
    onPointerMove?.(event);
  }
  function leave(event: PointerEvent<HTMLDivElement>) {
    ref.current?.style.setProperty('--spot-opacity', '0');
    onPointerLeave?.(event);
  }
  return <div ref={ref} className={`spotlight-card ${className}`} onPointerMove={move} onPointerLeave={leave} {...rest}><span className="spotlight-glow" aria-hidden="true" /><div className="spotlight-content">{children}</div></div>;
}
