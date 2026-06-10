"use client";

import { Button } from "@codeforge/ui";

export default function Error({ error, reset }) {
  return (
    <section className="panel empty-state">
      <h2>Something went wrong</h2>
      <p className="small">{error?.message || "An unexpected error occurred."}</p>
      <div className="mt-8">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      </div>
    </section>
  );
}
