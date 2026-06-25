"use client";

import IdeShell from "../../components/ide/IdeShell";
import { useLocalIde } from "../../lib/use-local-ide";

export default function EditorPage() {
  const ws = useLocalIde();
  return <IdeShell ws={ws} />;
}
