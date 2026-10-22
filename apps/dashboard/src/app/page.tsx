import { getOverview } from '@/lib/dashboard';
import { OverviewLive } from '@/components/OverviewLive';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await getOverview();
  return <><div className="page-heading" data-entrance><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Overview</h1><p>Know where your quota is going before it runs out.</p></div><div className="page-heading-side">Local dashboard <span className="online-dot" /></div></div><OverviewLive initial={data} /></>;
}
