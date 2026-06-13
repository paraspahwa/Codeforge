from __future__ import annotations

import asyncio
import fcntl
import os
import pty
import struct
import subprocess
import termios
from pathlib import Path

from .shell_ops import ShellError, _normalize_project_path


class PtySession:
    def __init__(self, project_path: str) -> None:
        self.project_root = _normalize_project_path(project_path)
        self.master_fd, slave_fd = pty.openpty()
        self._set_winsize(24, 120)
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["PS1"] = r"\u@\h:\w$ "
        self.process = subprocess.Popen(
            ["/bin/bash", "--login"],
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            cwd=str(self.project_root),
            preexec_fn=os.setsid,
            env=env,
            close_fds=True,
        )
        os.close(slave_fd)

    def _set_winsize(self, rows: int, cols: int) -> None:
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)

    def resize(self, rows: int, cols: int) -> None:
        rows = max(2, min(rows, 200))
        cols = max(20, min(cols, 500))
        self._set_winsize(rows, cols)

    def write(self, data: bytes) -> None:
        if data:
            os.write(self.master_fd, data)

    def read(self, size: int = 4096) -> bytes:
        try:
            return os.read(self.master_fd, size)
        except OSError:
            return b""

    def is_alive(self) -> bool:
        return self.process.poll() is None

    def close(self) -> None:
        try:
            if self.is_alive():
                self.process.terminate()
                try:
                    self.process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    self.process.kill()
        finally:
            try:
                os.close(self.master_fd)
            except OSError:
                pass


async def bridge_pty_websocket(websocket, session: PtySession) -> None:
    loop = asyncio.get_running_loop()
    closed = asyncio.Event()

    async def pump_pty_to_ws() -> None:
        while not closed.is_set() and session.is_alive():
            try:
                data = await loop.run_in_executor(None, session.read, 4096)
            except Exception:
                break
            if not data:
                await asyncio.sleep(0.02)
                if not session.is_alive():
                    break
                continue
            await websocket.send_bytes(data)

    async def pump_ws_to_pty() -> None:
        while not closed.is_set():
            message = await websocket.receive()
            msg_type = message.get("type")
            if msg_type == "websocket.disconnect":
                break
            if msg_type != "websocket.receive":
                continue
            if message.get("bytes"):
                session.write(message["bytes"])
            elif message.get("text"):
                text = message["text"]
                if text.startswith("{"):
                    try:
                        import json

                        payload = json.loads(text)
                        if payload.get("type") == "resize":
                            session.resize(int(payload.get("rows", 24)), int(payload.get("cols", 120)))
                            continue
                    except Exception:
                        pass
                session.write(text.encode("utf-8", errors="ignore"))

    reader = asyncio.create_task(pump_pty_to_ws())
    writer = asyncio.create_task(pump_ws_to_pty())
    try:
        await asyncio.wait({reader, writer}, return_when=asyncio.FIRST_COMPLETED)
    finally:
        closed.set()
        reader.cancel()
        writer.cancel()
        session.close()


def open_pty_session(project_path: str) -> PtySession:
    try:
        return PtySession(project_path)
    except ShellError as exc:
        raise RuntimeError(str(exc)) from exc
