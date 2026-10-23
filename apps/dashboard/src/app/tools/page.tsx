import type { Metadata } from 'next';
import { AddToolWizard } from '@/components/AddToolWizard';

export const metadata: Metadata = { title: 'Add AI Tool' };

export default function Page() {
  return <><div className="page-heading" data-entrance><div><div className="eyebrow accent-eyebrow"><span /> LOCAL CONNECTION SETUP</div><h1>Add AI Tool</h1><p>Detect, test, preview the first trusted reading, then save. Secrets stay on this machine.</p></div></div><AddToolWizard /></>;
}
