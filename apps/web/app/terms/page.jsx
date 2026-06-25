import LandingContainer from "../../components/marketing/LandingContainer";
import MarketingShell from "../../components/marketing/MarketingShell";

export const metadata = {
  title: "Terms of Service — CodeForge",
  description: "Terms governing use of the CodeForge platform.",
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <section className="mkt-page-hero">
        <LandingContainer>
          <p className="mkt-eyebrow">Legal</p>
          <h1 className="mkt-page-title">Terms of Service</h1>
          <p className="mkt-page-lead">Last updated: June 2026</p>
        </LandingContainer>
      </section>

      <LandingContainer>
        <article className="marketing-legal mkt-prose mkt-legal-body">
          <section>
            <h2>Agreement</h2>
            <p>
              By accessing or using CodeForge, you agree to these Terms. If you use the service on behalf of an
              organization, you represent that you have authority to bind that organization.
            </p>
          </section>

          <section>
            <h2>Service</h2>
            <p>
              CodeForge provides AI-assisted development tools including chat, agents, code editing, and automations. The
              service is provided &quot;as is&quot; and may change as we improve the product. AI outputs may be inaccurate;
              you are responsible for reviewing code before production use.
            </p>
          </section>

          <section>
            <h2>Acceptable use</h2>
            <ul>
              <li>Do not use the service for illegal activity, malware, or harassment.</li>
              <li>Do not attempt to bypass rate limits, authentication, or billing controls.</li>
              <li>Do not submit content you do not have rights to use.</li>
              <li>Comply with third-party model provider terms when using AI features.</li>
            </ul>
          </section>

          <section>
            <h2>Billing</h2>
            <p>
              Paid plans are billed monthly in INR through Razorpay. Subscriptions renew automatically unless cancelled.
              Refunds are handled per our billing policy and applicable consumer protection law.
            </p>
          </section>

          <section>
            <h2>Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, CodeForge is not liable for indirect, incidental, or consequential
              damages arising from use of the service or reliance on AI-generated output.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Legal inquiries: <a href="mailto:legal@codeforge.app">legal@codeforge.app</a>
            </p>
          </section>
        </article>
      </LandingContainer>
    </MarketingShell>
  );
}
