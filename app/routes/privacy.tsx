import { Link } from "react-router";
import { H1, H2, P, Muted } from "~/components/ui/typography";
import { WebsiteHeader } from "~/components/website-header";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <WebsiteHeader />

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-6 py-16">
        <H1 className="mb-4">Privacy Policy</H1>
        <Muted className="mb-12 text-base">
          Last updated: February 14, 2026
        </Muted>

        {/* ── Overview ─────────────────────────────────────── */}
        <H2 className="mt-12 mb-6">Overview</H2>
        <P>
          Viagen is an open-source Vite dev server plugin that connects your
          local development environment to Claude Code. This privacy policy
          describes how data is handled when using viagen, including the Vercel
          Sandbox integration.
        </P>

        {/* ── What viagen does ─────────────────────────────── */}
        <H2 className="mt-12 mb-6">What viagen does</H2>
        <P>
          Viagen runs as a Vite plugin inside your dev server. It provides a
          chat interface that sends your messages to Claude Code (via the
          Anthropic API) and applies code changes to your project. When deployed
          to a Vercel Sandbox, viagen runs your dev server in an isolated,
          ephemeral virtual machine.
        </P>

        {/* ── Data we collect ──────────────────────────────── */}
        <H2 className="mt-12 mb-6">Data we collect</H2>
        <P>
          Viagen itself does not collect, store, or transmit any personal data
          or telemetry. The plugin runs entirely within your local machine or
          your Vercel Sandbox instance.
        </P>

        {/* ── Data processed during use ────────────────────── */}
        <H2 className="mt-12 mb-6">Data processed during use</H2>
        <P>
          When you use viagen, the following data is processed in the course of
          normal operation:
        </P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>
            <strong>Chat messages</strong> — Messages you send through the chat
            panel are forwarded to the Anthropic API (Claude) for processing.
            These are subject to{" "}
            <a
              href="https://www.anthropic.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Anthropic&apos;s Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Source code</strong> — Claude Code reads and edits files in
            your project directory as part of its normal operation. File
            contents may be sent to the Anthropic API as context for your
            requests.
          </li>
          <li>
            <strong>Authentication tokens</strong> — OAuth tokens (for Claude
            Max/Pro) or API keys are stored in your local .env file and passed
            to the sandbox environment. These are used solely to authenticate
            API requests and are never shared with third parties.
          </li>
          <li>
            <strong>Git information</strong> — When deploying a sandbox with git
            integration, your repository URL, branch name, and git user identity
            are used to configure the sandbox environment.
          </li>
        </ul>

        {/* ── Vercel Sandbox integration ───────────────────── */}
        <H2 className="mt-12 mb-6">Vercel Sandbox integration</H2>
        <P>
          When you deploy to a Vercel Sandbox, your project code is transmitted
          to Vercel&apos;s infrastructure to run in an isolated environment.
          Sandbox instances are ephemeral and are automatically destroyed after
          the configured timeout. Data processed within a sandbox is subject to{" "}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Vercel&apos;s Privacy Policy
          </a>
          .
        </P>

        {/* ── Third-party services ─────────────────────────── */}
        <H2 className="mt-12 mb-6">Third-party services</H2>
        <P>Viagen integrates with the following third-party services:</P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>
            <strong>Anthropic (Claude API)</strong> — For AI-powered code
            assistance.{" "}
            <a
              href="https://www.anthropic.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong>Vercel</strong> — For sandbox hosting and deployment.{" "}
            <a
              href="https://vercel.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <strong>GitHub</strong> — For git operations when a GitHub token is
            configured.{" "}
            <a
              href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Privacy Policy
            </a>
          </li>
        </ul>

        {/* ── Data storage ─────────────────────────────────── */}
        <H2 className="mt-12 mb-6">Data storage</H2>
        <P>
          Viagen stores configuration data (API keys, OAuth tokens) exclusively
          in your project&apos;s local .env file. A .viagen/ directory is
          created in your project root to store dev server logs and plugin
          configuration. No data is sent to viagen-operated servers — there are
          none.
        </P>

        {/* ── Sandbox authentication ───────────────────────── */}
        <H2 className="mt-12 mb-6">Sandbox authentication</H2>
        <P>
          Sandbox instances are protected by a randomly generated authentication
          token. Access requires this token, which is provided as a URL
          parameter on first visit and stored as an HTTP-only session cookie.
          Unauthenticated requests to sandbox endpoints receive a 401 response.
        </P>

        {/* ── Open source ──────────────────────────────────── */}
        <H2 className="mt-12 mb-6">Open source</H2>
        <P>
          Viagen is open-source software licensed under the MIT License. You can
          review the complete source code at{" "}
          <a
            href="https://github.com/viagen-dev/viagen"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            github.com/viagen-dev/viagen
          </a>{" "}
          to verify these privacy practices.
        </P>

        {/* ── Contact ──────────────────────────────────────── */}
        <H2 className="mt-12 mb-6">Contact</H2>
        <P>
          For questions about this privacy policy, please{" "}
          <a
            href="https://github.com/viagen-dev/viagen/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            open an issue
          </a>{" "}
          on the GitHub repository.
        </P>

        {/* ── Footer ──────────────────────────────────────── */}
        <div className="mt-16 border-t pt-8">
          <Muted>
            © 2026 viagen. All rights reserved.{" "}
            <Link to="/" className="underline hover:text-foreground">
              Return to homepage
            </Link>
          </Muted>
        </div>
      </main>
    </div>
  );
}
