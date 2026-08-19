import { createClient } from '@/lib/supabase/server';
import { currentAffiliate } from '@/lib/affiliate-session';
import { ChangePassword } from '@/components/admin/ChangePassword';
import { Panel } from '@/components/admin/bits';

export const dynamic = 'force-dynamic';

/**
 * A teacher's own account, and the details Adnan holds about them.
 *
 * Read only apart from the password. What a teacher is paid and how is agreed
 * between them and Adnan, and letting one side edit it quietly in a form is
 * how two people end up with different numbers.
 */
export default async function AffiliateSettingsPage() {
  const supabase = await createClient();
  const [{ data }, row] = await Promise.all([supabase.auth.getUser(), currentAffiliate()]);

  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Settings</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">Signed in as {data.user?.email}.</p>

      <Panel title="Your details">
        <dl className="divide-y divide-line">
          {[
            ['Name', row.fullName],
            ['Referral code', row.code],
            ['Commission', `${row.commissionPct}% of everything your students pay`],
            ['Link', row.active ? 'On' : 'Switched off'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
              <dt className="w-[140px] shrink-0 text-[12.5px] font-extrabold text-ink3">{label}</dt>
              <dd className="text-[13.5px] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {/* Their first password was typed by Adnan on the onboarding form, which
          is unavoidable while email is unverified. This is how they stop him
          knowing it. */}
      <div className="mt-7">
        <ChangePassword hint="Your first password was set for you. Change it to something only you know." />
      </div>
    </>
  );
}
