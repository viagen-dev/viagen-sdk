import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { H1, H2, Lead, Muted, P } from "~/components/ui/typography";
import { WebsiteHeader } from "~/components/website-header";

export default function CompanyPage() {
  return (
    <div className="min-h-svh flex flex-col bg-background text-foreground">
      <WebsiteHeader />

      <main className="flex-1">
        {/* ── Hero ────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <div className="grid grid-cols-1 items-end gap-12 md:grid-cols-2">
            <H1 className="text-5xl leading-[1.1] sm:text-6xl lg:text-7xl">
              Building the
              <br />
              future of
              <br />
              collaboration
            </H1>
            <Lead className="text-2xl leading-relaxed">
              viagen was founded on a simple belief — the best software is built
              when everyone on the team can contribute, not just engineers.
            </Lead>
          </div>
        </section>

        {/* ── Mission ────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="border-t pt-12" />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_2fr]">
            <H2 className="border-0 pb-0 text-xl font-bold sm:text-2xl">
              Our mission
            </H2>
            <div>
              <P className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl lg:text-4xl">
                Turn software development into an organized, safe, and
                collaborative workspace.
              </P>
            </div>
          </div>
        </section>

        {/* ── Values ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_2fr]">
            <H2 className="border-0 pb-0 text-xl font-bold sm:text-2xl">
              What we believe
            </H2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[
                {
                  title: "Teams over tools",
                  description:
                    "The best technology disappears into the workflow. We build for the way teams actually work — not the way we wish they did.",
                },
                {
                  title: "Speed with safety",
                  description:
                    "Moving fast shouldn't mean moving recklessly. Every feature we ship balances velocity with guardrails that keep production safe.",
                },
                {
                  title: "AI as a teammate",
                  description:
                    "AI isn't a replacement for your team — it's an accelerant. We use it to handle the tedious so your people can focus on the creative.",
                },
                {
                  title: "Transparency first",
                  description:
                    "Every automated action is auditable. Every change is traceable. Trust is built on visibility, and we don't hide complexity.",
                },
                {
                  title: "Inclusive by design",
                  description:
                    "Great ideas come from everywhere. We lower the barrier to contribution so that anyone on the team can shape the product.",
                },
                {
                  title: "Ship, learn, repeat",
                  description:
                    "We're builders ourselves. We ship early, listen closely, and iterate relentlessly. Our product evolves with our users.",
                },
              ].map((value) => (
                <div key={value.title} className="rounded-2xl bg-muted p-8">
                  <h3 className="mb-3 text-xl font-bold tracking-tight">
                    {value.title}
                  </h3>
                  <p className="leading-relaxed text-muted-foreground">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="flex flex-col items-center gap-10 rounded-2xl bg-muted px-6 py-16">
            <H2 className="border-0 pb-0 text-3xl font-bold sm:text-4xl lg:text-5xl">
              Get started with viagen
            </H2>
            <Button asChild size="lg" className="rounded-lg text-base px-6">
              <Link to="/request-invite">Request invite</Link>
            </Button>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="mx-auto w-full max-w-6xl px-6 pt-16 pb-24">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {/* Learn */}
          <div className="flex flex-col gap-3">
            <Muted>Learn</Muted>
            <nav className="flex flex-col gap-3">
              <Link
                to="/company"
                className="text-sm font-medium hover:underline"
              >
                Company
              </Link>
              <a
                href="https://viagen.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline"
              >
                Dev server plugin
              </a>
            </nav>
          </div>

          {/* Terms & policies */}
          <div className="flex flex-col gap-3">
            <Muted>Terms &amp; policies</Muted>
            <nav className="flex flex-col gap-3">
              <Link to="/terms" className="text-sm font-medium hover:underline">
                Terms of use
              </Link>
              <Link
                to="/privacy"
                className="text-sm font-medium hover:underline"
              >
                Privacy policy
              </Link>
            </nav>
          </div>

          {/* Copyright */}
          <div className="flex justify-end">
            <Muted>viagen ©2026</Muted>
          </div>
        </div>
      </footer>
    </div>
  );
}
