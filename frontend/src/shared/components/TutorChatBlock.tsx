/**
 * @fileoverview Componente compartido de la interfaz EduCodeAI (TutorChatBlock).
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
import { queryKeys } from "../query/queryKeys";
import type { BuildRunChatMessage, BuilderReportEntity } from "../../features/builder/types";
import { MarkdownContent } from "./MarkdownContent";

interface TutorChatBlockProps {
  buildRunId: string;
  report: BuilderReportEntity | null | undefined;
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
      setMessages((prev) => {
        // Remove the temp user message if we get the real ones, or just replace/update
        // To be safe and keep dates clean, we can retrieve fresh messages or just append the response
        return [...prev.filter((m) => !m.id.startsWith("temp-")), responseMessage];
      });
    } catch (err: any) {
      if (activeRunIdRef.current !== runIdAtSend) return;
      console.error("Error sending message to tutor:", err);
      setError("No se pudo enviar el mensaje. Inténtalo de nuevo.");
      // Remove temp message on error so state stays clean
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
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

    const hasMustFix = report?.coaching?.mustFix && report.coaching.mustFix.length > 0;
    const hasShouldImprove = report?.coaching?.shouldImprove && report.coaching.shouldImprove.length > 0;

    if (hasMustFix) {
      questions.push("¿Qué significa el bloqueo obligatorio (Must-Fix)?");
    } else if (hasShouldImprove) {
      questions.push("¿Cómo puedo mejorar los aspectos recomendados (Should-Improve)?");
    } else {
      questions.push("¿Qué buenas prácticas puedo aplicar ahora?");
    }

    return questions;
  };

  return (
    <div className="mt-8 overflow-hidden rounded-lg border border-app-border bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-app-border bg-slate-50 px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-50 text-warning-500">
          <RiSparklingLine className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            Tutor de IA Directo
          </h3>
          <p className="text-xs text-slate-500">
            Pregúntame sobre tus errores, advertencias de compilación y cómo mejorar tu nota.
          </p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex h-[400px] flex-col overflow-y-auto bg-slate-50/50 p-6 custom-scrollbar">
        {messages.length === 0 && !isTyping ? (
          <div className="my-auto flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-warning-50 text-warning-500">
              <RiMessage3Line className="h-7 w-7" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">
              ¿En qué puedo ayudarte hoy?
            </h4>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              Inicia una conversación preguntándome sobre esta evaluación en particular o selecciona una sugerencia abajo.
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
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-warning-50 text-warning-500">
                      <RiSparklingLine className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                      isAssistant
                        ? "border border-app-border bg-white text-slate-900"
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
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-slate-50 border border-app-border text-slate-500">
                      <RiUser3Line className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex gap-4 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning-50 text-warning-500">
                  <RiSparklingLine className="h-4 w-4 animate-spin" />
                </div>
                <div className="max-w-[80%] rounded-lg border border-app-border bg-white px-5 py-4">
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="h-2 w-2 rounded-full bg-warning-400"></span>
                    <span className="h-2 w-2 rounded-full bg-warning-400"></span>
                    <span className="h-2 w-2 rounded-full bg-warning-400"></span>
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
        <div className="border-t border-app-border bg-slate-50 px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {getSuggestedQuestions().map((q, idx) => (
              <button
                key={idx}
                onClick={() => void handleSendMessage(q)}
                disabled={isLoading}
                className="rounded-md border border-app-border bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition-all hover:bg-slate-50 hover:text-primary hover:border-primary/30 active:scale-95 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-app-border p-4 bg-slate-50">
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
            placeholder="Pregunta algo sobre tu entrega (ej. ¿Cómo soluciono el segmentation fault?)..."
            className="flex-1 rounded-md border border-app-border bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="submit"
            aria-label="Enviar mensaje"
            disabled={!inputValue.trim() || isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white transition-all hover:bg-primary-hover active:scale-[0.97] disabled:bg-slate-100 disabled:text-slate-400"
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
