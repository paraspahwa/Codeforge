"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

function isInViewport(node) {
  const rect = node.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function buildRevealClassName({ animate, visible, extra = "" }) {
  return [
    "landing-reveal",
    animate ? "landing-reveal--animate" : "",
    visible ? "is-visible" : "",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function useScrollReveal(options = {}) {
  const {
    immediate = false,
    once = true,
    threshold = 0.12,
    rootMargin = "0px 0px -40px 0px",
  } = options;

  const ref = useRef(null);
  const [visible, setVisible] = useState(immediate);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    if (immediate || prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    if (isInViewport(node)) {
      setVisible(true);
      return;
    }

    setAnimate(true);
  }, [immediate]);

  useEffect(() => {
    if (!animate || visible || immediate) {
      return undefined;
    }

    const node = ref.current;
    if (!node) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once !== false) {
            observer.disconnect();
          }
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [animate, visible, immediate, once, threshold, rootMargin]);

  return {
    ref,
    visible,
    animate,
    className: buildRevealClassName({ animate, visible }),
  };
}

export function ScrollReveal({ children, className = "", delayClass = "", immediate = false }) {
  const { ref, animate, visible } = useScrollReveal({ immediate });

  return (
    <div
      ref={ref}
      className={buildRevealClassName({ animate, visible, extra: `${delayClass} ${className}`.trim() })}
    >
      {children}
    </div>
  );
}
