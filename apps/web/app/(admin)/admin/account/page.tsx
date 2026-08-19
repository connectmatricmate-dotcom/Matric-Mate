import { createClient } from '@/lib/supabase/server';
import { ChangePassword } from '@/components/admin/ChangePassword';

export const dynamic = 'force-dynamic';

export default async function AdminAccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <>
      <h1 className="font-display text-[26px] text-ink">Your account</h1>
      <p className="mt-0.5 mb-6 text-[13.5px] text-ink2">Signed in as {data.user?.email}.</p>
      <ChangePassword hint="Do this now if the password you are using was set for you." />
    </>
  );
}
