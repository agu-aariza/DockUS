/**
 * @fileoverview Chat del tutor dentro del flujo de Builder (TutorChatBlock).
 *
 * @module TutorChatBlock
 */

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  RiSparklingLine,
  RiSendPlaneFill,
  RiMessage3Line,
  RiUser3Line,
} from "react-icons/ri";
import { builderApi } from "../api/builderApi";
import { queryKeys } from "../../shared/query/queryKeys";
import type {
  BuildRunChatMessage,
  BuilderReportEntity,
  StudentReportView,
} from "../../features/builder/types";
import { MarkdownContent } from "../../shared/components/MarkdownContent";

type TutorReportContext = BuilderReportEntity | StudentReportView;

interface TutorChatBlockProps {
  buildRunId: string;
  report: TutorReportContext | null | undefined;
}

export function TutorChatBlock({ buildRunId, report }: TutorChatBlockProps) {
  const [messages, setMessages] = useState<BuildRunChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeRunIdRef = useRef(buildRunId);

  useEffect(() => {
    activeRunIdRef.current = buildRunId;
    setMessages([]);
    setError(null);
  }, [buildRunId]);

  // Solo la carga inicial del historial pasa por React Query; el flujo de
  // enviar/recibir mensajes en vivo sigue siendo estado local (no es cacheable).
  const chatHistoryQuery = useQuery({
    queryKey: queryKeys.builderChat.messages(buildRunId),
    queryFn: () => builderApi.getChatMessages(buildRunId),
  });

  useEffect(() => {
    if (chatHistoryQuery.data) setMessages(chatHistoryQuery.data);
  }, [chatHistoryQuery.data]);

  useEffect(() => {
    if (chatHistoryQuery.isError) {
      console.error("Error fetching tutor chat history:", chatHistoryQuery.error);
    }
  }, [chatHistoryQuery.isError, chatHistoryQuery.error]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const runIdAtSend = buildRunId;
    setError(null);
    setIsLoading(true);
    setInputValue("");

    // Optimistic user message update
    const tempUserMessage: BuildRunChatMessage = {
      id: `temp-user-${Date.now()}`,
      buildRunId: runIdAtSend,
      sender: "user",
      message: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    // Trigger typing state after user message is added
    setIsTyping(true);

    try {
      const responseMessage = await builderApi.sendChatMessage(runIdAtSend, text);
      if (activeRunIdRef.current !== runIdAtSend) return;
      setMessages((prev) => [...prev, responseMessage]);
    } catch (err: any) {
      if (activeRunIdRef.current !== runIdAtSend) return;
      console.error("Error sending message to tutor:", err);
      setError("No se pudo enviar el mensaje. Inténtalo de nuevo.");
      // Remove temp message on error so state stays clean
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
      // Restablecer el texto para que el alumno no pierda su consulta
      setInputValue(text);
    } finally {
      if (activeRunIdRef.current === runIdAtSend) {
        setIsLoading(false);
        setIsTyping(false);
      }
    }
  };

  const getSuggestedQuestions = () => {
    const questions = [
      "¿Cómo soluciono los errores principales?",
      "Explicación didáctica de mis fallos",
    ];

    const coaching = report && "coaching" in report ? report.coaching : undefined;
    const hasMustFix = Boolean(coaching?.mustFix && coaching.mustFix.length > 0);
    const hasShouldImprove = Boolean(
      coaching?.shouldImprove && coaching.shouldImprove.length > 0,
    );
    const hasStudentBlockers = Boolean(
      report && "blockers" in report && report.blockers.length > 0,
    );
    const hasStudentNextSteps = Boolean(
      report && "nextSteps" in report && report.nextSteps.length > 0,
    );

    if (hasMustFix || hasStudentBlockers) {
      questions.push("¿Qué significa el bloqueo obligatorio (Must-Fix)?");
    } else if (hasShouldImprove || hasStudentNextSteps) {
      questions.push("¿Cómo puedo mejorar los aspectos recomendados (Should-Improve)?");
    } else {
      questions.push("¿Qué buenas prácticas puedo aplicar ahora?");
    }

    return questions;
  };

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-primary/20 bg-app-surface shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-app-border bg-primary-subtle/60 px-5 py-4 sm:px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
          <RiSparklingLine className="h-5 w-5" />
        </div>
        <div>
          <p className="ui-label text-primary">Acompañamiento</p>
          <h3 className="mt-1 text-base font-semibold text-app-text">
            Tutor IA
          </h3>
          <p className="text-xs leading-5 text-app-text-secondary">
            Pregunta sobre esta evaluación y recibe orientación para tu siguiente intento.
          </p>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        className="flex h-[400px] flex-col overflow-y-auto bg-app-bg-subtle/35 p-5 custom-scrollbar sm:p-6"
        aria-live="polite"
        aria-label="Conversación con el Tutor IA"
      >
        {messages.length === 0 && !isTyping ? (
          <div className="my-auto flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-subtle text-primary">
              <RiMessage3Line className="h-7 w-7" />
            </div>
            <h4 className="text-base font-semibold text-app-text">
              ¿En qué puedo ayudarte hoy?
            </h4>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-app-text-secondary">
              Pregunta sobre esta entrega o selecciona una de las sugerencias para empezar.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => {
              const isAssistant = msg.sender === "assistant";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-4 ${
                    isAssistant ? "justify-start" : "justify-end"
                  }`}
                >
                  {isAssistant && (
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl bg-primary-subtle text-primary">
                      <RiSparklingLine className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                      isAssistant
                        ? "border border-app-border bg-app-surface text-app-text"
                        : "bg-primary text-white"
                    }`}
                  >
                    {isAssistant ? (
                      <MarkdownContent content={msg.message} />
                    ) : (
                      <p className="whitespace-pre-wrap leading-6">{msg.message}</p>
                    )}
                  </div>
                  {!isAssistant && (
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-text-muted">
                      <RiUser3Line className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex justify-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
                  <RiSparklingLine className="h-4 w-4 animate-pulse" />
                </div>
                <div className="max-w-[80%] rounded-xl border border-app-border bg-app-surface px-5 py-4">
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-primary"></span>
                    <span className="h-2 w-2 rounded-full bg-primary"></span>
                    <span className="h-2 w-2 rounded-full bg-primary"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Suggested Questions */}
      {messages.length === 0 && (
        <div className="border-t border-app-border bg-app-bg-subtle/50 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {getSuggestedQuestions().map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => void handleSendMessage(q)}
                disabled={isLoading}
                className="rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-text-secondary transition-all hover:border-primary/30 hover:bg-primary-subtle hover:text-primary active:scale-95 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-app-border bg-app-bg-subtle/50 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSendMessage(inputValue);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            placeholder="Pregunta algo sobre tu entrega…"
            className="input-field flex-1"
          />
          <button
            type="submit"
            aria-label="Enviar mensaje"
            disabled={!inputValue.trim() || isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white transition-all hover:bg-primary-hover active:scale-[0.97] disabled:bg-app-bg-subtle disabled:text-app-text-muted"
          >
            <RiSendPlaneFill className="h-5 w-5" />
          </button>
        </form>
        {error && (
          <p className="mt-2 text-xs font-semibold text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
