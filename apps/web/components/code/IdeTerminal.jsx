"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { ptyWebSocketUrl } from "../../lib/api";

const XtermTerminal = forwardRef(function XtermTerminal(
  { sessionId, token, projectPath, disabled },
  ref,
) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitRef = useRef(null);
  const wsRef = useRef(null);

  useImperativeHandle(ref, () => ({
    writeln(text = "") {
      termRef.current?.writeln(text);
    },
    write(text = "") {
      termRef.current?.write(text);
    },
    clear() {
      termRef.current?.clear();
    },
    focus() {
      termRef.current?.focus();
    },
    runCommand(command = "") {
      const trimmed = command.trim();
      if (!trimmed) {
        return;
      }
      const payload = trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(new TextEncoder().encode(payload));
      }
      termRef.current?.focus();
    },
    reconnect() {
      connectSocket();
    },
  }));

  function sendResize() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !termRef.current) {
      return;
    }
    const cols = termRef.current.cols;
    const rows = termRef.current.rows;
    wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
  }

  function connectSocket() {
    if (!sessionId || !token || disabled) {
      return;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const url = ptyWebSocketUrl(sessionId, token);
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    wsRef.current = socket;

    socket.onopen = () => {
      termRef.current?.writeln("\r\n[connected] Persistent shell ready.\r\n");
      sendResize();
    };
    socket.onmessage = (event) => {
      if (!termRef.current) {
        return;
      }
      if (typeof event.data === "string") {
        termRef.current.write(event.data);
      } else {
        termRef.current.write(new Uint8Array(event.data));
      }
    };
    socket.onclose = () => {
      termRef.current?.writeln("\r\n[disconnected] Shell session ended.\r\n");
    };
    socket.onerror = () => {
      termRef.current?.writeln("\r\n[error] Terminal connection failed.\r\n");
    };
  }

  useEffect(() => {
    let disposed = false;
    let resizeObserver;
    let dataDisposable;

    async function mountTerminal() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      await import("@xterm/xterm/css/xterm.css");

      if (disposed || !containerRef.current) {
        return;
      }

      const terminal = new Terminal({
        theme: {
          background: "#0b1220",
          foreground: "#e2e8f0",
          cursor: "#38bdf8",
          selectionBackground: "#334155aa",
        },
        fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
        fontSize: 13,
        cursorBlink: true,
        scrollback: 5000,
        convertEol: true,
      });
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(containerRef.current);
      fitAddon.fit();

      const prompt = projectPath ? `ubuntu@codeforge:${projectPath}$ ` : "ubuntu@codeforge:~$ ";
      terminal.writeln(`CodeForge PTY terminal — ${prompt}`);
      terminal.writeln("");

      dataDisposable = terminal.onData((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(new TextEncoder().encode(data));
        }
      });

      termRef.current = terminal;
      fitRef.current = fitAddon;

      resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit();
          sendResize();
        } catch {
          // ignore fit errors during teardown
        }
      });
      resizeObserver.observe(containerRef.current);
      connectSocket();
    }

    mountTerminal();

    return () => {
      disposed = true;
      dataDisposable?.dispose?.();
      resizeObserver?.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId, token, projectPath, disabled]);

  return (
    <div className="ide-terminal ide-terminal-pty">
      <div className="ide-terminal-toolbar">
        <span className="small">Terminal (PTY / WebSocket)</span>
        <button type="button" className="ghost-btn small" onClick={connectSocket} disabled={disabled || !sessionId}>
          Reconnect
        </button>
      </div>
      <div className="ide-terminal-xterm ide-terminal-xterm-full" ref={containerRef} />
    </div>
  );
});

export default XtermTerminal;
