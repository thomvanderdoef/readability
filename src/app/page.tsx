import Link from "next/link";

export default function Home() {
  return (
    <main>
      <header className="app-header">
        <Link className="wordmark" href="/">
          Readable<span className="wordmark-dot">.</span>
        </Link>
      </header>

      <section className="locked-wrap" aria-labelledby="locked-heading">
        <Link className="wordmark" href="/">
          Readable<span className="wordmark-dot">.</span>
        </Link>
        <div className="lock-glyph" aria-hidden="true" />
        <h1 className="locked-msg" id="locked-heading">
          This is a private library.
        </h1>
        <p className="locked-sub">
          Access requires a link from its owner. If you arrived here by accident,
          there is nothing to see, politely, not even the shelves.
        </p>

        <div className="setup-panel">
          <p className="setup-kicker">Bootstrap milestone</p>
          <p>
            The deployable skeleton is in place. Database schema, seed data, and
            the private read path are being wired next.
          </p>
        </div>
      </section>
    </main>
  );
}
