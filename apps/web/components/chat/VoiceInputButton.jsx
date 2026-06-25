"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@codeforge/ui";

export default function VoiceInputButton({ disabled, onTranscript }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSupported(Boolean(SpeechRecognition));
    if (!SpeechRecognition) {
      return undefined;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript?.(transcript);
      }
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      recognition.abort();
    };
  }, [onTranscript]);

  if (!supported) {
    return null;
  }

  function toggleListen() {
    if (disabled || !recognitionRef.current) {
      return;
    }
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    setListening(true);
    recognitionRef.current.start();
  }

  return (
    <button
      type="button"
      className={`cf-icon-btn cf-composer-voice ${listening ? "is-active" : ""}`}
      onClick={toggleListen}
      disabled={disabled}
      aria-label={listening ? "Stop voice input" : "Start voice input"}
      title="Voice input"
    >
      <Icon name="Mic" size={16} />
    </button>
  );
}
