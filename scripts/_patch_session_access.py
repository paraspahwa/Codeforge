from __future__ import annotations

import re
from pathlib import Path

path = Path("services/api/app/main.py")
text = path.read_text(encoding="utf-8")

write_session_ids = {
    "post_message",
    "create_cowork_plan",
    "create_cowork_job",
    "extract_cowork_data",
    "rebuild_project_knowledge",
    "upload_project_knowledge",
    "attach_context_pack",
    "session_git_stage",
    "session_git_commit",
    "session_git_branch",
    "session_git_worktree_create",
    "session_git_conflict_assist_apply",
    "session_shell_stream",
    "session_workflow_compact",
    "session_workflow_ultrareview",
    "session_workflow_create_plan",
    "session_workflow_execute_plan",
    "session_workflow_rollback_plan",
    "session_agent_loop",
    "create_session_artifact_endpoint",
    "stream_session",
    "decide_proposal",
}

pattern = re.compile(
    r"(?P<indent>    )session = get_session_for_user\(session_id=(?P<sid>session_id|payload\.session_id), user_id=user\.user_id\)\n"
    r"    if session is None:\n"
    r"        raise HTTPException\(status_code=404, detail=\"Session not found\"\)\n",
)

current_fn: str | None = None
lines = text.splitlines(keepends=True)
out: list[str] = []
i = 0
while i < len(lines):
    line = lines[i]
    fn_match = re.match(r"^def (\w+)\(", line)
    if fn_match:
        current_fn = fn_match.group(1)
    if i + 2 < len(lines):
        block = line + lines[i + 1] + lines[i + 2]
        if "get_session_for_user(session_id=share" in line:
            out.extend(lines[i : i + 3])
            i += 3
            continue
        m = pattern.match(block)
        if m:
            if current_fn in {"create_session_share"}:
                out.extend(lines[i : i + 3])
                i += 3
                continue
            write = current_fn in write_session_ids
            sid = m.group("sid")
            out.append(f"    session = _require_session({sid}, user, write={str(write)})\n")
            i += 3
            continue
        if line.strip() == "if payload.session_id:" and i + 3 < len(lines):
            inner = lines[i + 1] + lines[i + 2] + lines[i + 3]
            m = pattern.match(inner)
            if m:
                out.append(line)
                out.append("        session = _require_session(payload.session_id, user, write=True)\n")
                i += 4
                continue
    out.append(line)
    i += 1

new_text = "".join(out)
new_text = new_text.replace(
    "    project_path = _session_project_path(session_id, user)\n    resolved = resolve_repo_path(project_path, payload.path)",
    "    project_path = _session_project_path(session_id, user, write=True)\n    resolved = resolve_repo_path(project_path, payload.path)",
)
path.write_text(new_text, encoding="utf-8")
print("patched main.py")
