"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { resolveSessionShare } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useToast } from "../../../lib/toast-context";

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const { token, ready } = useAuth();
  const toast = useToast();
  const [share, setShare] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const shareId = typeof params.shareId === "string" ? params.shareId : "";

  useEffect(() => {
    if (!ready || !token || !shareId) {
      return;
    }
    setLoading(true);
    resolveSessionShare(token, shareId)
      .then((resolved) => {
        setShare(resolved);
        if (resolved.project_path) {
          localStorage.setItem("codeforge_project_path", resolved.project_path);
        }
        localStorage.setItem("codeforge_resume_session", resolved.session_id);
      })
      .catch((resolveError) => {
        setError(resolveError.message);
        toast.push(resolveError.message);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, token, shareId]);

  function handleOpenChat() {
    if (!share?.session_id) {
      return;
    }
    router.push("/app");
  }

  if (ready && !token) {
    return (
      <div className="login-page">
        <section className="panel login-card">
          <h2>Shared session</h2>
          <p className="small login-tagline">Sign in to open this shared session.</p>
          <Link href={`/login?next=${encodeURIComponent(`/share/${shareId}`)}`} className="small">
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <section className="panel empty-state">
        <h2>Shared session</h2>
        <p className="small">Resolving share link...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel empty-state">
        <h2>Share unavailable</h2>
        <p className="small">{error}</p>
        <Link href="/sessions" className="small">
          Back to sessions
        </Link>
      </section>
    );
  }

  if (!share) {
    return null;
  }

  return (
    <section className="panel">
      <h2>Shared session</h2>
      <p className="small">
        Access level <strong>{share.access_level}</strong> · expires {new Date(share.expires_at).toLocaleString()}
      </p>
      <p className="small">
        Session <strong>{share.session_id}</strong>
      </p>
      <p className="small">Project: {share.project_path}</p>
      <button type="button" onClick={handleOpenChat}>
        Open in chat
      </button>
      <Link href="/sessions" className="small" style={{ display: "block", marginTop: "0.75rem" }}>
        View in session history
      </Link>
    </section>
  );
}
