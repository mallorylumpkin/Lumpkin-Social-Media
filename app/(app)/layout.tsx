import { getContext } from "@/lib/org";
import { Nav } from "@/components/Nav";
import { signOut } from "../login/actions";
import { onboard } from "./onboard-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { orgId, user } = await getContext();

  if (!orgId) {
    return (
      <main className="login">
        <h1>Set up your workspace</h1>
        <p className="muted">One-time setup. This creates your brand, storefront collections, and default settings.</p>
        <form action={onboard} className="card">
          <label htmlFor="name">Brand / owner name</label>
          <input id="name" name="name" type="text" defaultValue="Mallory Lumpkin" required />
          <p className="muted small">Your storefront collections will be named under this (for example &quot;Mallory Lumpkin - Gifts under $25&quot;).</p>
          <label htmlFor="board">Pinterest board name (optional)</label>
          <input id="board" name="board" type="text" defaultValue="Mallory Lumpkin - Fav Products" />
          <div className="actions">
            <button className="primary" type="submit">Create workspace</button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Affiliate Commerce <span>OS</span>
        </div>
        <Nav />
        <form action={signOut} style={{ marginTop: 20, padding: "0 6px" }}>
          <div className="muted small" style={{ marginBottom: 6, wordBreak: "break-all" }}>{user.email}</div>
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <div style={{ flex: 1, minWidth: 0 }}>
        <header className="topbar">
          <div className="brand">
            Affiliate Commerce <span>OS</span>
          </div>
          <Nav />
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
