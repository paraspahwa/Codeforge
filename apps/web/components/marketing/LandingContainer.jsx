export default function LandingContainer({ children, className = "", wide = false }) {
  return (
    <div className={`landing-container ${wide ? "landing-container--wide" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
