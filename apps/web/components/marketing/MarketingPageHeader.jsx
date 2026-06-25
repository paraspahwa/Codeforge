"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

export default function MarketingPageHeader({ eyebrow, title, lead, children }) {
  return (
    <section className="mkt-page-hero">
      <LandingContainer>
        <ScrollReveal>
          {eyebrow ? <p className="mkt-eyebrow">{eyebrow}</p> : null}
          <h1 className="mkt-page-title">{title}</h1>
          {lead ? <p className="mkt-page-lead">{lead}</p> : null}
          {children}
        </ScrollReveal>
      </LandingContainer>
    </section>
  );
}
