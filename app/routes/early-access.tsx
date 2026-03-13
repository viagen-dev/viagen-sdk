import { useState } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { H1, Lead, Muted, P } from "~/components/ui/typography";
import { WebsiteHeader } from "~/components/website-header";

export default function EarlyAccessPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // TODO: wire up to an API endpoint or email service
    console.log("[request-invite] Email submitted:", email);
    setSubmitted(true);
  }

  return (
    <div className="min-h-svh flex flex-col bg-background text-foreground">
      <WebsiteHeader />

      <main className="flex-1">
        {/* ── Hero ────────────────────────────────────────────── */}
        <section className="mx-auto max-w-2xl px-6 pt-20 pb-24">
          <div className="flex flex-col gap-12">
            <H1 className="text-5xl leading-[1.1] sm:text-6xl lg:text-7xl">
              Request
              <br />
              an invite
            </H1>
            <Lead className="text-2xl leading-relaxed">
              viagen is currently invite-only. Request an invite to be among the
              first to experience a new way of building software together.
            </Lead>
            <div className="w-full rounded-2xl bg-muted p-8 sm:p-10">
              {submitted ? (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-foreground text-background">
                    ✓
                  </div>
                  <h3 className="text-xl font-bold">You're on the list</h3>
                  <P className="text-muted-foreground">
                    We'll reach out to <strong>{email}</strong> when your invite
                    is ready.
                  </P>
                  <Button asChild variant="outline" size="sm" className="mt-2">
                    <Link to="/">Back to home</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="mb-2 text-xl font-bold tracking-tight">
                    Request invite
                  </h3>
                  <p className="mb-8 text-sm text-muted-foreground">
                    Enter your work email and we'll be in touch.
                  </p>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                    <Button type="submit" size="lg" className="w-full">
                      Request invite
                    </Button>
                    <Muted className="text-center text-xs">
                      No spam. We'll only email you about your invite.
                    </Muted>
                  </form>
                </>
              )}
            </div>
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
