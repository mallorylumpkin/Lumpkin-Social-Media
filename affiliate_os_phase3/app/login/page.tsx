import { Flash, pick } from "@/components/Flash";
import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  return (
    <main className="login">
      <h1>
        Affiliate Commerce <span style={{ color: "var(--accent)" }}>OS</span>
      </h1>
      <p className="muted">Sign in to your dashboard.</p>
      <Flash msg={pick(sp.msg)} error={pick(sp.error)} />
      <form className="card">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={10} />
        <div className="actions">
          <button className="primary" formAction={signIn}>
            Sign in
          </button>
          <button formAction={signUp}>Create account</button>
        </div>
        <p className="muted small" style={{ marginTop: 12 }}>
          First time? Create an account once. After you finish setup, turn off public sign-ups in Supabase
          (Authentication &gt; Sign In / Providers) so only you can log in.
        </p>
      </form>
    </main>
  );
}
