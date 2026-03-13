import { Link } from "react-router";
import { H1, H2, H3, P, Muted } from "~/components/ui/typography";
import { WebsiteHeader } from "~/components/website-header";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <WebsiteHeader />

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-6 py-16">
        <H1 className="mb-4">Privacy Policy</H1>
        <Muted className="mb-12">Effective Date: March 12, 2026</Muted>

        <P>
          Welcome to viagen. This Privacy Policy explains how viagen
          (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses,
          shares, and protects your personal information when you use our
          platform, CLI tool, SDK, and related services (collectively, the
          &quot;Service&quot;). By using the Service, you agree to the
          collection and use of information in accordance with this policy.
        </P>

        {/* ── 1. Information We Collect ─────────────────────── */}
        <H2 className="mt-12 mb-6">1. Information We Collect</H2>

        <H3 className="mt-8 mb-4">1.1 Account Information</H3>
        <P>
          When you sign up for viagen, you authenticate via GitHub OAuth. During
          this process, we collect the following information from your GitHub
          profile:
        </P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>Your name and display name</li>
          <li>Your email address</li>
          <li>Your GitHub username</li>
          <li>Your profile avatar / photo URL</li>
          <li>Your GitHub account identifier</li>
        </ul>

        <H3 className="mt-8 mb-4">1.2 Project and Task Data</H3>
        <P>
          When you use viagen to manage projects, we collect and store data
          related to your work, including:
        </P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>Project names, descriptions, and configuration</li>
          <li>Task descriptions, statuses, and execution logs</li>
          <li>Code repository references and deployment metadata</li>
          <li>Sandbox environment configurations</li>
          <li>Organization and team membership information</li>
        </ul>

        <H3 className="mt-8 mb-4">1.3 Usage Data</H3>
        <P>
          We automatically collect certain information about how you interact
          with the Service, including:
        </P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>Pages viewed and features used</li>
          <li>Timestamps of actions taken within the platform</li>
          <li>API call frequency and patterns (via CLI, SDK, or web)</li>
          <li>Browser type, device information, and IP address</li>
        </ul>

        <H3 className="mt-8 mb-4">1.4 Cookies and Session Data</H3>
        <P>
          We use cookies and similar technologies to maintain your authenticated
          session and provide a seamless experience. This includes:
        </P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>Session cookies to keep you logged in</li>
          <li>API tokens you generate for CLI and SDK access</li>
          <li>Preferences and settings you configure within the platform</li>
        </ul>

        {/* ── 2. How We Use Information ─────────────────────── */}
        <H2 className="mt-12 mb-6">2. How We Use Your Information</H2>
        <P>We use the information we collect to:</P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>
            Provide, operate, and maintain the Service, including project
            management, task execution, and deployment workflows
          </li>
          <li>Authenticate your identity and manage your account</li>
          <li>
            Enable collaboration between team members within organizations
          </li>
          <li>
            Process tasks through our AI-powered systems to generate code,
            deployments, and other outputs
          </li>
          <li>
            Communicate with you about updates, security alerts, and
            administrative messages
          </li>
          <li>
            Monitor and analyze usage trends to improve the Service&apos;s
            performance and reliability
          </li>
          <li>
            Detect, prevent, and address technical issues, fraud, and abuse
          </li>
          <li>Comply with legal obligations</li>
        </ul>

        {/* ── 3. Third-Party Services ──────────────────────── */}
        <H2 className="mt-12 mb-6">3. Third-Party Services</H2>
        <P>
          viagen integrates with the following third-party services. Each
          integration involves sharing specific data necessary for the
          integration to function:
        </P>

        <H3 className="mt-8 mb-4">3.1 GitHub</H3>
        <P>
          We use GitHub for authentication (via OAuth) and for managing source
          code repositories linked to your projects. When you connect your
          GitHub account, we access your profile information, repository
          metadata, and perform actions on repositories (such as creating
          branches and pull requests) on your behalf. GitHub&apos;s use of your
          data is governed by{" "}
          <a
            href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            GitHub&apos;s Privacy Statement
          </a>
          .
        </P>

        <H3 className="mt-8 mb-4">3.2 Vercel</H3>
        <P>
          We integrate with Vercel to manage deployments for your projects. When
          you connect your Vercel account, we share project configuration and
          deployment metadata with Vercel to provision and manage your
          deployments. Vercel&apos;s use of your data is governed by{" "}
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

        <H3 className="mt-8 mb-4">3.3 Anthropic (Claude AI)</H3>
        <P>
          We use Anthropic&apos;s Claude AI to power task execution within the
          platform. When you create and run tasks, relevant project context,
          task descriptions, and code may be sent to Anthropic&apos;s API for
          processing. Anthropic&apos;s use of your data is governed by{" "}
          <a
            href="https://www.anthropic.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Anthropic&apos;s Privacy Policy
          </a>
          .
        </P>

        <P className="mt-4">
          We do not sell your personal information to any third party. We only
          share data with third-party services as described above and as
          necessary to provide the Service.
        </P>

        {/* ── 4. Data Storage & Security ───────────────────── */}
        <H2 className="mt-12 mb-6">4. Data Storage &amp; Security</H2>
        <P>
          We take the security of your data seriously. We implement
          industry-standard technical and organizational measures to protect
          your personal information, including:
        </P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>Encryption of data in transit using TLS/SSL</li>
          <li>Encryption of sensitive data at rest</li>
          <li>
            Secure storage of API tokens and secrets using hashed or encrypted
            representations
          </li>
          <li>
            Access controls limiting who within our organization can access your
            data
          </li>
          <li>Regular security reviews and updates to our infrastructure</li>
        </ul>
        <P>
          While we strive to protect your information, no method of transmission
          over the internet or electronic storage is 100% secure. We cannot
          guarantee absolute security, but we are committed to promptly
          notifying affected users in the event of a data breach.
        </P>

        {/* ── 5. Data Retention ────────────────────────────── */}
        <H2 className="mt-12 mb-6">5. Data Retention</H2>
        <P>
          We retain your personal information for as long as your account is
          active or as needed to provide the Service. Specifically:
        </P>
        <ul className="my-4 ml-6 list-disc space-y-2 text-base leading-7">
          <li>
            <strong>Account data</strong> is retained for the lifetime of your
            account and deleted within 30 days of account deletion.
          </li>
          <li>
            <strong>Project and task data</strong> is retained for as long as
            the associated project exists and is deleted when the project is
            permanently removed.
          </li>
          <li>
            <strong>Usage and log data</strong> is retained for up to 90 days
            for operational purposes, after which it is aggregated or deleted.
          </li>
          <li>
            <strong>Session cookies</strong> expire according to their
            configured lifetime and are removed from your browser accordingly.
          </li>
        </ul>
        <P>
          We may retain certain information as required by law or for legitimate
          business purposes, such as resolving disputes or enforcing our
          agreements.
        </P>

        {/* ── 6. Your Rights ──────────────────────────────── */}
        <H2 className="mt-12 mb-6">6. Your Rights</H2>
        <P>
          You have the following rights regarding your personal information:
        </P>

        <H3 className="mt-8 mb-4">6.1 Access</H3>
        <P>
          You can access and review the personal information we hold about you
          at any time through your account settings or by contacting us. The
          platform provides a data export feature within the settings page.
        </P>

        <H3 className="mt-8 mb-4">6.2 Deletion</H3>
        <P>
          You may request deletion of your account and all associated personal
          data. Upon receiving a deletion request, we will remove your data
          within 30 days, except where retention is required by law. To request
          account deletion, visit your account settings or contact us directly.
        </P>

        <H3 className="mt-8 mb-4">6.3 Data Export</H3>
        <P>
          You may request a copy of your data in a portable, machine-readable
          format. This includes your profile information, project metadata, and
          task history. You can initiate an export from your account settings or
          by contacting us.
        </P>

        <H3 className="mt-8 mb-4">6.4 Correction</H3>
        <P>
          If you believe any personal information we hold about you is
          inaccurate, you can update it directly through your account profile or
          by contacting us to request a correction.
        </P>

        <H3 className="mt-8 mb-4">6.5 Objection &amp; Restriction</H3>
        <P>
          Where applicable by law, you may object to or request restriction of
          certain data processing activities. Contact us to exercise these
          rights.
        </P>

        {/* ── 7. Children's Privacy ───────────────────────── */}
        <H2 className="mt-12 mb-6">7. Children&apos;s Privacy</H2>
        <P>
          The Service is not intended for use by individuals under the age of
          13. We do not knowingly collect personal information from children
          under 13. If we become aware that a child under 13 has provided us
          with personal information, we will take steps to delete that
          information promptly. If you believe a child under 13 has provided us
          with personal data, please contact us immediately.
        </P>

        {/* ── 8. International Data Transfers ─────────────── */}
        <H2 className="mt-12 mb-6">8. International Data Transfers</H2>
        <P>
          Your information may be transferred to and processed in countries
          other than your country of residence. These countries may have data
          protection laws that differ from those of your jurisdiction. By using
          the Service, you consent to the transfer of your information to such
          countries.
        </P>
        <P>
          Where required by applicable law, we ensure that appropriate
          safeguards are in place for international data transfers, including
          standard contractual clauses or other legally recognized transfer
          mechanisms.
        </P>

        {/* ── 9. Changes to This Policy ───────────────────── */}
        <H2 className="mt-12 mb-6">9. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy from time to time to reflect changes
          in our practices, technologies, legal requirements, or other factors.
          When we make material changes, we will notify you by posting the
          updated policy on this page and updating the &quot;Effective
          Date&quot; at the top.
        </P>
        <P>
          We encourage you to review this Privacy Policy periodically to stay
          informed about how we protect your data. Your continued use of the
          Service after changes are posted constitutes your acceptance of the
          revised policy.
        </P>

        {/* ── 10. Contact Information ─────────────────────── */}
        <H2 className="mt-12 mb-6">10. Contact Information</H2>
        <P>
          If you have any questions, concerns, or requests regarding this
          Privacy Policy or our data practices, please contact us at:
        </P>
        <P>
          <a
            href="mailto:privacy@viagen.dev"
            className="underline hover:text-foreground"
          >
            privacy@viagen.dev
          </a>
        </P>
        <P>We will respond to your inquiry within 30 days of receipt.</P>

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
