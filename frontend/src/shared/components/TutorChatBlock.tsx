import { useState, useEffect, useRef } from "react";
import {
  RiSparklingLine,
  RiSendPlaneFill,
  RiMessage3Line,
  RiUser3Line,
} from "react-icons/ri";
import { builderApi } from "../api/builderApi";
import type { BuildRunChatMessage, BuilderReportEntity } from "../types";
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

  // Fetch initial history
  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      try {
        const history = await builderApi.getChatMessages(buildRunId);
        if (active) {
          setMessages(history);
        }
      } catch (err) {
        console.error("Error fetching tutor chat history:", err);
      }
    };
    fetchHistory();
    return () => {
      active = false;
    };
  }, [buildRunId]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);
    setInputValue("");
    
    // Optimistic user message update
    const tempUserMessage: BuildRunChatMessage = {
      id: `temp-user-${Date.now()}`,
      buildRunId,
      sender: "user",
      message: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);
    
    // Trigger typing state after user message is added
    setIsTyping(true);

    try {
      const responseMessage = await builderApi.sendChatMessage(buildRunId, text);
      setMessages((prev) => {
        // Remove the temp user message if we get the real ones, or just replace/update
        // To be safe and keep dates clean, we can retrieve fresh messages or just append the response
        return [...prev.filter((m) => !m.id.startsWith("temp-")), responseMessage];
      });
    } catch (err: any) {
      console.error("Error sending message to tutor:", err);
      setError("No se pudo enviar el mensaje. Inténtalo de nuevo.");
      // Remove temp message on error so state stays clean
      setMessages((prev) => prev.filter((m) => !m.id.startsWith("temp-")));
    } finally {
      setIsLoading(false);
      setIsTyping(false);
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
    <div className="mt-8 overflow-hidden rounded-2xl border border-academic-outline/25 bg-white shadow-academic">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-academic-outline/10 bg-academic-surface-container-low px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold shadow-sm">
          <RiSparklingLine className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <h3 className="font-bold text-academic-on-surface text-base">
            Tutor de IA Directo
          </h3>
          <p className="text-xs text-academic-on-surface-variant">
            Pregúntame sobre tus errores, advertencias de compilación y cómo mejorar tu nota.
          </p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex h-[400px] flex-col overflow-y-auto bg-academic-surface/40 p-6 custom-scrollbar">
        {messages.length === 0 && !isTyping ? (
          <div className="my-auto flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold/10 text-brand-gold shadow-sm">
              <RiMessage3Line className="h-7 w-7" />
            </div>
            <h4 className="font-bold text-academic-on-surface text-base">
              ¿En qué puedo ayudarte hoy?
            </h4>
            <p className="mx-auto mt-2 max-w-sm text-sm text-academic-on-surface-variant">
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
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold shadow-sm">
                      <RiSparklingLine className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isAssistant
                        ? "border border-academic-outline/15 bg-white text-academic-on-surface"
                        : "bg-brand-blue text-white shadow-md shadow-brand-blue/10"
                    }`}
                  >
                    {isAssistant ? (
                      <MarkdownContent content={msg.message} />
                    ) : (
                      <p className="whitespace-pre-wrap leading-6">{msg.message}</p>
                    )}
                  </div>
                  {!isAssistant && (
                    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-academic-surface-container border border-academic-outline-variant text-academic-on-surface-variant">
                      <RiUser3Line className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex gap-4 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-gold/10 text-brand-gold">
                  <RiSparklingLine className="h-4 w-4 animate-spin" />
                </div>
                <div className="max-w-[80%] rounded-2xl border border-academic-outline/15 bg-white px-5 py-4">
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-gold [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-gold [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-brand-gold"></span>
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
        <div className="border-t border-academic-outline/10 bg-academic-surface-container-low px-6 py-3">
          <div className="flex flex-wrap gap-2">
            {getSuggestedQuestions().map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={isLoading}
                className="rounded-xl border border-academic-outline/20 bg-white px-3 py-1.5 text-xs font-bold text-academic-on-surface-variant transition-all hover:bg-academic-surface hover:text-brand-blue hover:border-brand-blue/30 active:scale-95 disabled:opacity-50 shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-academic-outline/15 p-4 bg-academic-surface-container-lowest">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputValue);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            placeholder="Pregunta algo sobre tu entrega (ej. ¿Cómo soluciono el segmentation fault?)..."
            className="flex-1 rounded-xl border border-academic-outline/35 bg-white px-4 py-3 text-sm text-academic-on-surface placeholder:text-academic-on-surface-variant/50 focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:bg-academic-surface disabled:text-academic-on-surface-variant/40"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue text-white transition-all hover:bg-brand-blue-dark active:scale-[0.97] disabled:bg-academic-surface-container disabled:text-academic-on-surface-variant/30 shadow-md shadow-brand-blue/10"
          >
            <RiSendPlaneFill className="h-5 w-5" />
          </button>
        </form>
        {error && (
          <p className="mt-2 text-xs font-semibold text-academic-error">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
