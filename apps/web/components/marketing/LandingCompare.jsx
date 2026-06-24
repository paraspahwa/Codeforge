"use client";

import Link from "next/link";

import { COMPARISON_ROWS, COMPARISON_COLUMNS } from "../../lib/product-roadmap";
import LandingContainer from "./LandingContainer";
import { ScrollReveal } from "./useScrollReveal";

export default function LandingCompare() {
  return (
    <section className="landing-compare landing-section-block" aria-labelledby="landing-compare-heading">
      <LandingContainer>
        <ScrollReveal className="landing-section-header">
          <span className="landing-section-eyebrow">Honest comparison</span>
          <h2 id="landing-compare-heading">How CodeForge fits the landscape</h2>
          <p>
            We&apos;re not trying to be Cursor or Claude Code — we&apos;re building the affordable, India-first path from
            idea to shipped product. Here&apos;s where we stand today.
          </p>
        </ScrollReveal>

        <ScrollReveal delayClass="landing-reveal-delay-1">
          <div className="landing-compare-table-wrap landing-glass">
            <table className="landing-compare-table">
              <thead>
                <tr>
                  <th scope="col">Area</th>
                  {COMPARISON_COLUMNS.map((column) => (
                    <th key={column.id} scope="col">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.area}>
                    <th scope="row">{row.area}</th>
                    {COMPARISON_COLUMNS.map((column) => (
                      <td key={column.id}>{row[column.id]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="landing-compare-note">
            <Link href="/roadmap">See the full public roadmap →</Link> — what&apos;s shipped, in progress, and planned.
          </p>
        </ScrollReveal>
      </LandingContainer>
    </section>
  );
}
