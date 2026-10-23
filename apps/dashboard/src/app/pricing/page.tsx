import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Pricing' };

const plans = [
  { name: 'Free', price: '$0', suffix: 'forever', copy: 'Everything in today’s local CliffWatch release.', badge: 'AVAILABLE', features: ['Codex and OpenRouter monitoring', 'Local dashboard and CLI', 'Desktop and webhook alerts', 'Seven-day local history'], action: 'Use Free', href: '/', featured: false },
  { name: 'Pro', price: '$7', suffix: '/ month', copy: 'Planned for individuals who need longer history and sync.', badge: 'PLANNED', features: ['Unlimited provider adapters', 'Advanced alert rules', 'Extended usage history', 'Encrypted cloud sync'], action: 'Coming soon', href: undefined, featured: true },
  { name: 'Team', price: 'Custom', suffix: '', copy: 'Planned controls for shared AI budgets and workspaces.', badge: 'PLANNED', features: ['Everything in Pro', 'Team workspace', 'Member management', 'Shared policies and billing'], action: 'Coming soon', href: undefined, featured: false },
] as const;

const comparison = [
  ['AI tools monitored', '2', 'Unlimited · planned', 'Unlimited · planned'],
  ['Usage tracking', 'Included', 'Included', 'Included'],
  ['Local dashboard and CLI', 'Included', 'Included', 'Included'],
  ['Advanced alert rules', '—', 'Planned', 'Planned'],
  ['Extended history', '7 days', 'Planned', 'Planned'],
  ['Encrypted cloud sync', '—', 'Planned', 'Planned'],
  ['Team workspace', '—', '—', 'Planned'],
  ['Member management', '—', '—', 'Planned'],
] as const;

export default function PricingPage() {
  return <>
    <div className="page-heading pricing-heading" data-entrance><div><div className="eyebrow accent-eyebrow"><span /> SIMPLE, HONEST PRICING</div><h1>Plans that grow with your AI workflow</h1><p>The local release is free. Pro and Team show the product direction and are not available for purchase yet.</p></div></div>
    <div className="pricing-notice" data-entrance>No payment is collected in v0.1 · Planned tiers are clearly marked</div>
    <div className="pricing-grid">{plans.map(plan => <section className={`price-card${plan.featured ? ' price-card--featured' : ''}`} key={plan.name} data-entrance>
      <span className="plan-badge">{plan.badge}</span><div className="eyebrow">CLIFFWATCH</div><h2>{plan.name}</h2><div className="price">{plan.price} {plan.suffix ? <small>{plan.suffix}</small> : null}</div><p className="plan-copy">{plan.copy}</p>
      <ul className="plan-features">{plan.features.map(feature => <li key={feature}><i>✓</i><span>{feature}</span></li>)}</ul>
      {plan.href ? <Link className="plan-action" href={plan.href}>{plan.action}</Link> : <span className={`plan-action${plan.featured ? ' plan-action--primary' : ''}`} aria-disabled="true">{plan.action}</span>}
    </section>)}</div>
    <section className="panel comparison" data-entrance><table><thead><tr><th>Feature</th><th>Free</th><th>Pro</th><th>Team</th></tr></thead><tbody>{comparison.map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={index > 0 && cell === 'Included' ? 'availability-current' : index > 0 && cell.includes('Planned') ? 'availability-planned' : undefined}>{cell}</td>)}</tr>)}</tbody></table></section>
  </>;
}
