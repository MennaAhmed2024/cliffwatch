import { ReceiptsView } from '@/components/ReceiptsView';
import { getReceiptsSnapshot } from '@/lib/receipts';

export const dynamic='force-dynamic';
export default function Page(){const data=getReceiptsSnapshot();return <><div className="page-heading" data-entrance><div><div className="eyebrow">AI OWNERSHIP LEDGER</div><h1>AI Receipts</h1><p>See token spend, linked Git work, and visible rework signals without leaving CliffWatch.</p></div></div><ReceiptsView initial={data}/></>;}
