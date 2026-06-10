import { useState } from "react";

import { useToast } from "./toast-context";

export function useDesktopNotify() {
  const toast = useToast();
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function reportError(message) {
    setErrorMessage(message);
    if (message) {
      toast.push(message);
    }
  }

  function reportSuccess(message) {
    setStatusMessage(message);
    if (message) {
      toast.push(message, "success");
    }
  }

  return { statusMessage, errorMessage, reportError, reportSuccess };
}
