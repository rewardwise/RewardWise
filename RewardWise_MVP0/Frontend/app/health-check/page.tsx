/** @format */

import Link from "next/link";

export default function HealthCheckPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div
        style={{
          background: "rgba(15, 25, 35, 0.85)",
          border: "1px solid rgba(45, 212, 191, 0.2)",
          borderRadius: "16px",
          padding: "48px 56px",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🩺</div>
        <h1 style={{ color: "#2dd4bf", fontSize: "22px", fontWeight: 700, marginBottom: "12px", letterSpacing: "0.02em" }}>
          Health Check
        </h1>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "20px" }}>
          Coming Soon
        </p>
        <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "15px", lineHeight: 1.6 }}>
          Your points portfolio is about to get a full check-up. We&apos;re building tools to
          diagnose expiring miles, underused cards, and missed opportunities (so your
          rewards stay in peak condition)
        </p>
      </div>

      <Link href="/profile" className="back-link" style={{ marginTop: "24px", color: "rgba(255,255,255,0.5)", fontSize: "14px", textDecoration: "none" }}>
        ← Back to Profile
      </Link>

      <style>{`
        .back-link:hover { color: #2dd4bf; }
      `}</style>
    </div>
  );
}