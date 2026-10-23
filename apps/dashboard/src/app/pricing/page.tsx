import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Pricing' };

const plans = [
  { name: 'Free', price: '$0', suffix: 'forever', copy: 'Everything in today’s local CliffWatch release. A two-connection limit is planned, not enforced today.', badge: 'AVAILABLE', features: ['Codex monitoring', 'OpenRouter monitoring (experimental)', 'Local dashboard and CLI', 'Free local alert channels'], action: 'Use Free', href: '/', featured: false },
  { name: 'Pro', price: 'Coming', suffix: '', copy: 'A planned roadmap for individuals who need longer history and sync.', badge: 'PLANNED', features: ['Planned: more provider adapters', 'Planned: advanced alert rules', 'Planned: extended usage history', 'Planned: encrypted cloud sync'], action: 'Join waitlist', href: 'mailto:hello@cliffwatch.dev?subject=CliffWatch%20Pro%20waitlist', featured: true },
  { name: 'Team', price: 'Coming', suffix: '', copy: 'Planned controls for shared AI budgets and workspaces.', badge: 'PLANNED', features: ['Planned: Pro roadmap', 'Planned: team workspace', 'Planned: member management', 'Planned: shared policies and billing'], action: 'Join waitlist', href: 'mailto:hello@cliffwatch.dev?subject=CliffWatch%20Team%20waitlist', featured: false },
] as const;

const comparison = [
  ['Connection limit', '2 · planned, not enforced', 'More · planned', 'More · planned'],
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
    <div className="pricing-notice" data-entrance>Nothing is for sale yet — this is the roadmap.</div>
    <div className="pricing-grid">{plans.map(plan => <section className={`price-card${plan.featured ? ' price-card--featured' : ''}`} key={plan.name} data-entrance>
      <span className="plan-badge">{plan.badge}</span><div className="eyebrow">CLIFFWATCH</div><h2>{plan.name}</h2><div className="price">{plan.price} {plan.suffix ? <small>{plan.suffix}</small> : null}</div><p className="plan-copy">{plan.copy}</p>
      <ul className="plan-features">{plan.features.map(feature => <li key={feature}><i>✓</i><span>{feature}</span></li>)}</ul>
      {plan.href?.startsWith('/') ? <Link className="plan-action" href={plan.href}>{plan.action}</Link> : plan.href ? <a className={`plan-action${plan.featured ? ' plan-action--primary' : ''}`} href={plan.href}>{plan.action}</a> : null}
    </section>)}</div>
    <section className="panel comparison" data-entrance><table><thead><tr><th>Feature</th><th>Free</th><th>Pro</th><th>Team</th></tr></thead><tbody>{comparison.map(row => <tr key={row[0]}>{row.map((cell, index) => <td key={`${row[0]}-${index}`} className={index > 0 && cell === 'Included' ? 'availability-current' : index > 0 && cell.includes('Planned') ? 'availability-planned' : undefined}>{cell}</td>)}</tr>)}</tbody></table></section>
  </>;
}
