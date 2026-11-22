import { redirect } from 'next/navigation';

/** The profile page moved to /account (and the granted-course list to /my-courses). */
export default function ProfileRedirect() {
  redirect('/account');
}
