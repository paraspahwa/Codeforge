"use client";

export default function ProblemsPanel({ problems, onOpenAt }) {
  return (
    <div className="ide-problems-panel">
      {problems.length === 0 ? (
        <p className="small muted">No problems detected.</p>
      ) : (
        <ul className="ide-problems-list">
          {problems.map((problem, index) => (
            <li key={`${problem.path}-${problem.line}-${index}`}>
              <button type="button" className="ide-problem-item" onClick={() => onOpenAt?.(problem.path, problem.line)}>
                <span className={`ide-problem-sev ide-problem-${problem.severity || "warning"}`}>
                  {(problem.severity || "warning")[0].toUpperCase()}
                </span>
                <span>{problem.message}</span>
                <span className="small muted">
                  {problem.path}:{problem.line}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
