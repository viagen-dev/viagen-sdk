import { useState } from "react";
import { Link } from "react-router";
import { redirect } from "react-router";
import { getSessionUser } from "~/lib/session.server";
import { Button } from "~/components/ui/button";
import { H1, H2, Lead, Muted } from "~/components/ui/typography";
import { CheckSquare, Bot, UserCheck, ShieldCheck } from "lucide-react";
import { WebsiteHeader } from "~/components/website-header";

export async function loader({ request }: { request: Request }) {
  const session = await getSessionUser(request);
  if (session && session.memberships.length > 0) {
    throw redirect("/dashboard");
  }
  return null;
}

export default function HomePage() {
  const [videoLoaded, setVideoLoaded] = useState(false);

  return (
    <div className="min-h-svh flex flex-col bg-background text-foreground">
      <WebsiteHeader />

      {/* ── Hero ────────────────────────────────────────────── */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16">
          <div className="grid grid-cols-1 items-end gap-12 md:grid-cols-2">
            <H1 className="text-5xl leading-[1.1] sm:text-6xl lg:text-7xl">
              Make
              <br />
              software
              <br />
              together
            </H1>
            <Lead className="text-2xl leading-relaxed">
              viagen is a platform that empowers every team to move ideas
              towards production at the speed of thought.
            </Lead>
          </div>

          {/* Hero video */}
          <div className="relative mt-16">
            {/* Skeleton loader */}
            <div
              className={`absolute inset-0 rounded-2xl bg-muted transition-opacity duration-700 ${
                videoLoaded ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
            >
              <div className="flex h-full items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
              </div>
            </div>
            {/* Gradient overlay */}
            <div
              className={`absolute inset-0 z-[5] rounded-2xl bg-gradient-to-t from-black/70 via-black/20 to-transparent transition-opacity duration-700 ${
                videoLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
            {/* Overlay text */}
            <div
              className={`absolute inset-0 z-10 flex items-end rounded-2xl p-8 sm:p-12 transition-opacity duration-700 ${
                videoLoaded ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="max-w-lg text-6xl font-bold text-white">
                Donny says this is going to be good.
              </p>
            </div>
            <video
              autoPlay
              loop
              muted
              playsInline
              onCanPlayThrough={() => setVideoLoaded(true)}
              className={`aspect-[16/9] w-full rounded-2xl bg-muted object-cover transition-opacity duration-700 ${
                videoLoaded ? "opacity-100" : "opacity-0"
              }`}
            >
              <source src="/hero-video.mp4" type="video/mp4" />
            </video>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 justify-items-center">
            {[
              { icon: CheckSquare, label: "Task\nmanagement" },
              { icon: Bot, label: "AI\nautomation" },
              { icon: UserCheck, label: "Sane access\ncontrol" },
              { icon: ShieldCheck, label: "QA &\nsafety" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-4">
                <Icon
                  className="size-14 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-2xl font-bold leading-tight whitespace-pre-line">
                  {label}
                </span>
              </div>
            ))}
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
