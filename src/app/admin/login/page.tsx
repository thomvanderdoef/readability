import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/admin-auth";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await hasAdminSession()) {
    redirect("/");
  }

  const params = await searchParams;
  const error = Array.isArray(params?.error) ? params.error[0] : params?.error;

  return (
    <main>
      <section className="login-wrap" aria-labelledby="login-heading">
        <Link className="wordmark" href="/">
          Readable<span className="wordmark-dot">.</span>
        </Link>
        <div className="login-panel">
          <p className="setup-kicker">Admin</p>
          <h1 className="login-title" id="login-heading">
            Log in to edit the library
          </h1>
          <form className="login-form" action="/api/admin/login" method="post">
            <label className="flabel" htmlFor="admin-password">
              Password
            </label>
            <input
              className="finput"
              id="admin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
            {error ? (
              <p className="form-error">
                {error === "config"
                  ? "Admin login is not configured yet."
                  : "Invalid password."}
              </p>
            ) : null}
            <button className="btn primary" type="submit">
              Log in
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
