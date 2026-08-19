import Link from 'next/link';
import { SITE_URL } from '@/lib/site';
import { NewTeacherForm } from '@/components/admin/NewTeacherForm';

export default function NewTeacherPage() {
  return (
    <>
      <Link
        href="/admin/teachers"
        className="mb-1 inline-block text-[13px] font-extrabold text-ink2 transition-colors duration-200 hover:text-teal"
      >
        Teachers
      </Link>
      <h1 className="font-display text-[26px] text-ink">Add a teacher</h1>
      <p className="mt-0.5 mb-6 max-w-[560px] text-[13.5px] text-ink2">
        This creates their account and mints their referral link. They sign in on the website with the email and
        password you set here, and land on their own dashboard rather than a student one.
      </p>
      <NewTeacherForm siteUrl={SITE_URL} />
    </>
  );
}
