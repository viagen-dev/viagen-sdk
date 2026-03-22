import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
} from "react-router";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";

import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <title>viagen</title>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("viagen-theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const is404 = isRouteErrorResponse(error) && error.status === 404;

  if (is404) {
    return (
      <main className="min-h-svh flex flex-col items-center justify-center gap-8 px-4 bg-background text-foreground select-none">
        {/* Glitchy big number */}
        <div className="relative">
          <span className="text-[10rem] font-black leading-none tracking-tighter text-muted-foreground/10 select-none">
            404
          </span>
          <span className="absolute inset-0 flex items-center justify-center text-[10rem] font-black leading-none tracking-tighter text-foreground/5 blur-sm select-none">
            404
          </span>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="text-5xl">🤖</span>
            <span className="text-sm font-medium text-muted-foreground">
              lost in the void
            </span>
          </div>
        </div>

        {/* Copy */}
        <div className="flex flex-col items-center gap-2 text-center max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">
            Nothing to see here
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page you're looking for has either moved, been deleted, or never
            existed in the first place. Classic.
          </p>
        </div>

        {/* CTA */}
        <Link
          to="/tasks"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-80 transition-opacity"
        >
          ← Back to my tasks
        </Link>
      </main>
    );
  }

  // Generic error fallback
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  if (isRouteErrorResponse(error)) {
    details = error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">
        Something went wrong
      </h1>
      <p className="mt-2 text-muted-foreground">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-auto rounded-md border bg-muted p-4 text-left text-sm">
          <code className="font-mono">{stack}</code>
        </pre>
      )}
      <Link
        to="/tasks"
        className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back to my tasks
      </Link>
    </main>
  );
}
