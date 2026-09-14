import { AiLocked } from '@/components/app/AiLocked';
import { currentAccess } from '@/lib/entitlement';

/**
 * Every screen under /tutor is AI: the chat, saved chats, AI tests and mock
 * papers. On Basic, which has no AI, the whole section is one screen saying
 * so, decided here once rather than in each page, so a new AI screen added
 * under /tutor is covered without anyone remembering to.
 *
 * An account with no plan at all never gets here; the (app) layout has already
 * sent it to the plans page.
 */
export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const access = await currentAccess();
  if (access.active && !access.ai) return <AiLocked titleKey="tutor.title" />;
  return children;
}
