import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingShell from "../../components/marketing/MarketingShell";

export const metadata = {
  title: "Privacy Policy — CodeForge",
  description: "How CodeForge collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <LandingContainer>
        <article className="marketing-legal">
          <h1>Privacy Policy</h1>
          <p className="small marketing-legal-updated">Last updated: June 2026</p>

          <section>
            <h2>Overview</h2>
            <p>
              CodeForge (&quot;we&quot;, &quot;us&quot;) provides an AI-assisted software development platform. This policy
              describes what data we collect, how we use it, and your rights under applicable law including India&apos;s
              Digital Personal Data Protection Act (DPDP).
            </p>
          </section>

          <section>
            <h2>Data we collect</h2>
            <ul>
              <li>
                <strong>Account data:</strong> email, name, and authentication identifiers from your sign-in provider
                (Supabase Auth or enterprise SSO).
              </li>
              <li>
                <strong>Usage data:</strong> chat sessions, API request counts, billing status, and feature usage for
                quota enforcement.
              </li>
              <li>
                <strong>Workspace data:</strong> project files, git history, and automation outputs you create in your
                workspace.
              </li>
              <li>
                <strong>Payment data:</strong> processed by Razorpay; we store order references, not full card numbers.
              </li>
            </ul>
          </section>

          <section>
            <h2>How we use data</h2>
            <p>
              We use your data to provide the service, enforce plan limits, improve reliability, and comply with legal
              obligations. Prompts and workspace content may be sent to third-party AI model providers (e.g. OpenAI,
              Anthropic, DeepSeek) to generate responses. Do not submit sensitive personal data you are not authorized to
              share.
            </p>
          </section>

          <section>
            <h2>Retention &amp; security</h2>
            <p>
              We retain account and usage data while your account is active and for a reasonable period thereafter.
              Workspace data is stored on infrastructure you configure (self-hosted or managed). We use encryption in
              transit (TLS) and industry-standard access controls.
            </p>
          </section>

          <section>
            <h2>Your rights</h2>
            <p>
              You may request access, correction, or deletion of your personal data by contacting{" "}
              <a href="mailto:privacy@codeforge.app">privacy@codeforge.app</a>. You may withdraw consent where processing
              is consent-based, subject to contractual or legal requirements.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions about this policy: <a href="mailto:privacy@codeforge.app">privacy@codeforge.app</a>
            </p>
          </section>
        </article>
      </LandingContainer>
    </MarketingShell>
  );
}
