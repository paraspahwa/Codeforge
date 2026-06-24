"use client";

import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

const QUOTES = [
  {
    text: "CodeForge helped us go from napkin sketch to MVP in two weeks — without hiring a full dev team.",
    author: "Priya S., Founder, Bangalore",
  },
  {
    text: "The agent patterns for security review and PRD writing alone saved us months of back-and-forth.",
    author: "Rahul M., CTO, Pune startup",
  },
  {
    text: "INR pricing and Razorpay integration made it a no-brainer for our India-first product.",
    author: "Ananya K., Product lead, Mumbai",
  },
  {
    text: "Finally an AI coding tool that understands product thinking, not just autocomplete.",
    author: "Vikram T., Indie hacker",
  },
  {
    text: "We replaced three separate tools with CodeForge — chat, IDE, and automations in one place.",
    author: "Deepa R., Engineering manager",
  },
];

export default function LandingTestimonials() {
  const track = [...QUOTES, ...QUOTES];

  return (
    <section className="landing-testimonials landing-section-block">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Testimonials</span>
          <h2>The new way to build software</h2>
          <p>Early builders using CodeForge to ship faster and smarter.</p>
        </ScrollReveal>
      </LandingContainer>

      <div className="landing-marquee-wrap">
        <div className="landing-testimonial-track">
          {track.map((quote, index) => (
            <figure key={`${quote.author}-${index}`} className="landing-testimonial-card landing-glass">
              <blockquote>&ldquo;{quote.text}&rdquo;</blockquote>
              <cite>— {quote.author}</cite>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
