import { Link } from "react-router";
import { H1, H2, H3, P, Muted } from "~/components/ui/typography";
import { WebsiteHeader } from "~/components/website-header";

export default function TermsPage() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <WebsiteHeader />

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-6 py-16">
        <H1 className="mb-4">Terms of Use</H1>
        <Muted className="mb-12 text-base">
          Effective Date: March 12, 2026
        </Muted>

        {/* ── 1. Acceptance of Terms ──────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">1. Acceptance of Terms</H2>
          <P>
            By accessing or using the viagen platform ("Service"), including our
            website, CLI tool, SDK, and API, you agree to be bound by these
            Terms of Use ("Terms"). If you do not agree to these Terms, you may
            not access or use the Service.
          </P>
          <P>
            These Terms constitute a legally binding agreement between you
            (whether individually or on behalf of an organization) and viagen.
            Your continued use of the Service following the posting of any
            changes to these Terms constitutes acceptance of those changes.
          </P>
        </section>

        {/* ── 2. Description of Service ──────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">2. Description of Service</H2>
          <P>
            viagen is a collaborative software development platform that
            empowers teams — engineers, designers, and product managers — to
            move ideas towards production at the speed of thought. The Service
            includes but is not limited to:
          </P>
          <ul className="my-6 ml-6 list-disc space-y-2 leading-7">
            <li>Project creation and management</li>
            <li>AI-assisted task execution powered by Claude (Anthropic)</li>
            <li>
              Integration with third-party services such as GitHub and Vercel
            </li>
            <li>Deployment management and sandbox environments</li>
            <li>Organization and team collaboration tools</li>
            <li>
              A command-line interface (CLI) and software development kit (SDK)
            </li>
            <li>REST API access for programmatic interaction</li>
          </ul>
          <P>
            We reserve the right to modify, suspend, or discontinue any aspect
            of the Service at any time, with or without notice.
          </P>
        </section>

        {/* ── 3. User Accounts & Authentication ──────────── */}
        <section className="mt-12">
          <H2 className="mb-4">3. User Accounts &amp; Authentication</H2>

          <H3 className="mb-3 mt-6">3.1 Account Creation</H3>
          <P>
            To use the Service, you must authenticate via GitHub OAuth. By
            authenticating, you authorize viagen to access certain information
            from your GitHub account, including your profile information,
            repositories, and related data as permitted by the scopes you
            approve during the OAuth flow.
          </P>

          <H3 className="mb-3 mt-6">3.2 Account Responsibility</H3>
          <P>
            You are responsible for maintaining the security of your account
            credentials, including any API tokens generated through the Service.
            You agree to notify us immediately of any unauthorized access to or
            use of your account. viagen is not liable for any loss or damage
            arising from your failure to protect your account credentials.
          </P>

          <H3 className="mb-3 mt-6">3.3 Organizations</H3>
          <P>
            You may create or join organizations within the Service. If you
            create an organization, you are responsible for managing its members
            and their access levels. Organization administrators are responsible
            for ensuring that all members comply with these Terms.
          </P>
        </section>

        {/* ── 4. Acceptable Use ──────────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">4. Acceptable Use</H2>
          <P>You agree not to use the Service to:</P>
          <ul className="my-6 ml-6 list-disc space-y-2 leading-7">
            <li>
              Violate any applicable local, state, national, or international
              law or regulation
            </li>
            <li>
              Infringe upon or violate the intellectual property rights or
              privacy rights of any third party
            </li>
            <li>
              Upload, transmit, or distribute any malicious code, viruses, or
              harmful software
            </li>
            <li>
              Attempt to gain unauthorized access to the Service, other user
              accounts, or any related systems or networks
            </li>
            <li>
              Interfere with or disrupt the integrity or performance of the
              Service or its infrastructure
            </li>
            <li>
              Use the Service to generate, store, or distribute content that is
              unlawful, harmful, threatening, abusive, or otherwise
              objectionable
            </li>
            <li>
              Reverse engineer, decompile, or disassemble any portion of the
              Service, except as permitted by applicable law
            </li>
            <li>
              Resell, sublicense, or redistribute access to the Service without
              our prior written consent
            </li>
            <li>
              Abuse or circumvent any rate limits, usage quotas, or other
              technical restrictions imposed by the Service
            </li>
          </ul>
          <P>
            We reserve the right to investigate and take appropriate action
            against any violations of this section, including suspension or
            termination of your account.
          </P>
        </section>

        {/* ── 5. Intellectual Property ───────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">5. Intellectual Property</H2>

          <H3 className="mb-3 mt-6">5.1 Your Content</H3>
          <P>
            You retain all ownership rights to the code, projects, and other
            content you create, upload, or manage through the Service ("Your
            Content"). viagen does not claim ownership of Your Content. By using
            the Service, you grant viagen a limited, non-exclusive license to
            access, store, and process Your Content solely as necessary to
            provide and improve the Service.
          </P>

          <H3 className="mb-3 mt-6">5.2 AI-Generated Output</H3>
          <P>
            Code and other output generated by AI features within the Service
            (including Claude-powered task execution) based on your prompts and
            project context are considered part of Your Content. You are solely
            responsible for reviewing, testing, and validating any AI-generated
            output before deploying it to production environments.
          </P>

          <H3 className="mb-3 mt-6">5.3 viagen Intellectual Property</H3>
          <P>
            The Service, including its design, features, documentation, CLI
            tool, SDK, and underlying technology, is the intellectual property
            of viagen and is protected by applicable intellectual property laws.
            These Terms do not grant you any right, title, or interest in the
            Service beyond the limited right to use it in accordance with these
            Terms.
          </P>
        </section>

        {/* ── 6. Third-Party Integrations ────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">6. Third-Party Integrations</H2>
          <P>
            The Service integrates with third-party services to provide its
            functionality. Your use of these integrations is subject to the
            respective terms and policies of each third-party provider:
          </P>

          <H3 className="mb-3 mt-6">6.1 GitHub</H3>
          <P>
            The Service uses GitHub for authentication (OAuth), repository
            access, and version control operations. Your use of GitHub through
            the Service is subject to{" "}
            <a
              href="https://docs.github.com/en/site-policy/github-terms/github-terms-of-service"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-muted-foreground"
            >
              GitHub's Terms of Service
            </a>
            .
          </P>

          <H3 className="mb-3 mt-6">6.2 Vercel</H3>
          <P>
            The Service integrates with Vercel for deployment and hosting. Your
            use of Vercel through the Service is subject to{" "}
            <a
              href="https://vercel.com/legal/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-muted-foreground"
            >
              Vercel's Terms of Service
            </a>
            .
          </P>

          <H3 className="mb-3 mt-6">6.3 Anthropic (Claude)</H3>
          <P>
            The Service uses Anthropic's Claude AI model to power task execution
            and code generation features. Your use of Claude through the Service
            is subject to{" "}
            <a
              href="https://www.anthropic.com/legal/consumer-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-muted-foreground"
            >
              Anthropic's Terms of Service
            </a>
            .
          </P>

          <P>
            viagen is not responsible for the availability, accuracy, or conduct
            of any third-party services. We do not endorse and are not liable
            for any damage or loss caused by your use of or reliance on any
            third-party services.
          </P>
        </section>

        {/* ── 7. API & SDK Usage ─────────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">7. API &amp; SDK Usage</H2>
          <P>
            viagen provides a REST API and SDK for programmatic access to the
            Service. Your use of the API and SDK is subject to the following
            additional terms:
          </P>
          <ul className="my-6 ml-6 list-disc space-y-2 leading-7">
            <li>
              You must authenticate all API requests using valid API tokens
              issued through the Service. You are responsible for keeping these
              tokens secure and must not share them publicly.
            </li>
            <li>
              You agree to comply with any rate limits, usage quotas, or
              technical restrictions we impose on API and SDK usage. We may
              throttle or block requests that exceed these limits.
            </li>
            <li>
              You may not use the API or SDK to build a competing service or to
              replicate the core functionality of the viagen platform without
              our prior written consent.
            </li>
            <li>
              We may modify, deprecate, or discontinue API endpoints or SDK
              features at any time. We will make reasonable efforts to provide
              advance notice of breaking changes.
            </li>
          </ul>
        </section>

        {/* ── 8. Privacy & Data ──────────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">8. Privacy &amp; Data</H2>
          <P>
            Your use of the Service is also governed by our Privacy Policy. By
            using the Service, you consent to the collection, use, and
            processing of your data as described in our Privacy Policy. Data
            collected may include your GitHub profile information, project data,
            API tokens, usage analytics, and other information necessary to
            provide the Service.
          </P>
        </section>

        {/* ── 9. Limitation of Liability ─────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">9. Limitation of Liability</H2>
          <P>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VIAGEN AND ITS
            OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE
            LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
            DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
          </P>
          <ul className="my-6 ml-6 list-disc space-y-2 leading-7">
            <li>
              Your access to or use of (or inability to access or use) the
              Service
            </li>
            <li>Any conduct or content of any third party on the Service</li>
            <li>
              Any AI-generated code or output, including errors, bugs, security
              vulnerabilities, or unintended behavior in such output
            </li>
            <li>
              Unauthorized access, use, or alteration of your transmissions or
              content
            </li>
            <li>
              Any interruption, suspension, or termination of the Service or any
              third-party integrations
            </li>
            <li>
              Any loss or corruption of data, including project data, deployment
              configurations, or sandbox environments
            </li>
          </ul>
          <P>
            THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED,
            INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
            FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </P>
          <P>
            IN NO EVENT SHALL VIAGEN'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS
            ARISING OUT OF OR RELATING TO THESE TERMS OR YOUR USE OF THE SERVICE
            EXCEED THE AMOUNT YOU HAVE PAID TO VIAGEN IN THE TWELVE (12) MONTHS
            PRECEDING THE EVENT GIVING RISE TO THE LIABILITY, OR ONE HUNDRED
            U.S. DOLLARS ($100), WHICHEVER IS GREATER.
          </P>
        </section>

        {/* ── 10. Indemnification ────────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">10. Indemnification</H2>
          <P>
            You agree to indemnify, defend, and hold harmless viagen and its
            officers, directors, employees, and agents from and against any
            claims, liabilities, damages, losses, costs, and expenses (including
            reasonable attorneys' fees) arising out of or in any way connected
            with your access to or use of the Service, your violation of these
            Terms, or your infringement of any intellectual property or other
            rights of any third party.
          </P>
        </section>

        {/* ── 11. Termination ────────────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">11. Termination</H2>
          <P>
            We may suspend or terminate your access to the Service at any time,
            with or without cause, and with or without notice. Upon termination,
            your right to use the Service will immediately cease.
          </P>
          <P>
            You may terminate your account at any time by contacting us or
            through the account settings within the Service. Upon termination of
            your account, we may delete your account data, including project
            configurations and API tokens. We are not obligated to retain your
            data following termination.
          </P>
          <P>
            Sections of these Terms that by their nature should survive
            termination shall survive, including but not limited to Sections 5
            (Intellectual Property), 9 (Limitation of Liability), 10
            (Indemnification), and 13 (Governing Law).
          </P>
        </section>

        {/* ── 12. Changes to Terms ───────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">12. Changes to Terms</H2>
          <P>
            We reserve the right to update or modify these Terms at any time.
            When we make changes, we will update the "Effective Date" at the top
            of this page and, where appropriate, notify you via email or through
            the Service.
          </P>
          <P>
            Your continued use of the Service after any modifications to these
            Terms constitutes your acceptance of the revised Terms. If you do
            not agree to the updated Terms, you must stop using the Service and
            terminate your account.
          </P>
        </section>

        {/* ── 13. Governing Law ──────────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">13. Governing Law</H2>
          <P>
            These Terms shall be governed by and construed in accordance with
            the laws of the State of Delaware, United States, without regard to
            its conflict of law provisions. Any legal action or proceeding
            arising out of or relating to these Terms or the Service shall be
            brought exclusively in the federal or state courts located in
            Delaware, and you consent to the personal jurisdiction of such
            courts.
          </P>
        </section>

        {/* ── 14. Severability ───────────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">14. Severability</H2>
          <P>
            If any provision of these Terms is found to be unenforceable or
            invalid by a court of competent jurisdiction, that provision shall
            be limited or eliminated to the minimum extent necessary so that
            these Terms shall otherwise remain in full force and effect.
          </P>
        </section>

        {/* ── 15. Contact Information ────────────────────── */}
        <section className="mt-12">
          <H2 className="mb-4">15. Contact Information</H2>
          <P>
            If you have any questions about these Terms of Use, please contact
            us at:
          </P>
          <P>
            <a
              href="mailto:legal@viagen.dev"
              className="underline hover:text-muted-foreground"
            >
              legal@viagen.dev
            </a>
          </P>
        </section>

        {/* ── Footer divider ─────────────────────────────── */}
        <div className="mt-16 border-t pt-8">
          <Muted>&copy; 2026 viagen. All rights reserved.</Muted>
        </div>
      </main>
    </div>
  );
}
