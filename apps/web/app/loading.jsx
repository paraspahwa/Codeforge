import { Skeleton } from "@codeforge/ui";

export default function Loading() {
  return (
    <section className="panel page-loading">
      <Skeleton style={{ height: "2rem", width: "40%", marginBottom: "1rem" }} />
      <Skeleton style={{ height: "12rem" }} />
    </section>
  );
}
