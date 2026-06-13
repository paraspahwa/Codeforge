"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { FEATURE_CATEGORIES, queueChatGoal } from "../lib/product-features";

export default function FeatureCatalog({ variant = "page", onStartGoal }) {
  const router = useRouter();

  function handleGoal(feature) {
    if (onStartGoal) {
      onStartGoal(feature);
      return;
    }
    queueChatGoal({ prompt: feature.starterPrompt, planMode: feature.planMode });
    router.push("/");
  }

  return (
    <div className={`feature-catalog feature-catalog-${variant}`}>
      {FEATURE_CATEGORIES.map((category, catIndex) => (
        <section
          key={category.id}
          className="feature-category cf-animate-in"
          style={{ animationDelay: `${catIndex * 80}ms` }}
        >
          <header className="feature-category-header">
            <span className="feature-category-emoji cf-bounce-gentle" aria-hidden>
              {category.emoji}
            </span>
            <div>
              <h2>{category.title}</h2>
              <p className="small">{category.description}</p>
            </div>
          </header>

          <div className="feature-card-grid">
            {category.features.map((feature, featIndex) => (
              <article
                key={feature.id}
                className="feature-card cf-animate-in cf-hover-lift"
                style={{ animationDelay: `${catIndex * 80 + featIndex * 50}ms` }}
              >
                <div className="feature-card-glow" aria-hidden />
                <span className="feature-card-icon cf-wiggle-hover" aria-hidden>
                  {feature.icon}
                </span>
                <h3>{feature.title}</h3>
                <p className="small feature-card-desc">{feature.description}</p>
                <div className="feature-card-actions">
                  {feature.action === "goal" ? (
                    <button
                      type="button"
                      className="feature-card-btn feature-card-btn-primary"
                      onClick={() => handleGoal(feature)}
                    >
                      <span className="feature-card-btn-spark" aria-hidden>✦</span>
                      Start
                    </button>
                  ) : (
                    <Link href={feature.href} className="feature-card-btn feature-card-btn-primary">
                      <span className="feature-card-btn-spark" aria-hidden>→</span>
                      Open
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
