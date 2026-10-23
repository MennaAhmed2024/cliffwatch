import { getOverview } from '@/lib/dashboard';
import { OverviewLive } from '@/components/OverviewLive';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const data = await getOverview();
  return <>
    <div className="page-heading overview-heading" data-entrance>
      <div><div className="eyebrow accent-eyebrow"><span /> LIVE LIMIT INTELLIGENCE</div><h1>See the cliff <em>before</em><br />you reach it.</h1><p>One calm view of your AI quota, burn rate, and time left.</p></div>
      <div className="heading-orbit" aria-hidden="true"><span><img src="/brand/cliffwatch-mark.png" alt="" /></span></div>
    </div>
    <OverviewLive initial={data} />
  </>;
}
