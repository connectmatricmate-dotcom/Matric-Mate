import { Redirect } from 'expo-router';
import { useApp } from '../src/store/app';

/**
 * The plans screen, gone from the app.
 *
 * It compared the two plans, named what each opened and copied a sign-in link
 * to the website's plans page, and Google Play forbids all of that: an app may
 * not lead anyone to pay outside Play, and Pakistan is in no programme that
 * allows it (core/billing.ts). A student without a plan now meets the trial
 * screen (a new account) or the paused screen (a trial or plan that ended).
 *
 * The route stays, as a redirect, for whatever still links here: an older
 * notification, an update not yet taken.
 */
export default function Upgrade() {
  const { state } = useApp();
  const to = state.premium.active ? '/account/subscription' : state.premium.trialState === 'eligible' ? '/trial' : '/paused';
  return <Redirect href={to} />;
}
