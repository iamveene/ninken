"use client"

import { cn } from "@/lib/utils"
import { Bot, User, Wrench } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { AIMessage } from "@/hooks/use-ai-partner"

export function ChatMessage({ message }: { message: AIMessage }) {
  const isUser = message.role === "user"

  return (
    <div
      className={cn(
        "flex gap-2.5 px-3 py-2",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      <div
        className={cn(
          "max-w-[85%] space-y-1",
          isUser ? "text-right" : "text-left"
        )}
      >
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50"
          )}
        >
          {isUser ? (
            <p className="text-sm">{message.content}</p>
          ) : (
            <div className="space-y-1.5">
              {message.content ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mt-3 mb-1 text-base font-bold">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mt-2 mb-1 text-sm font-bold">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mt-2 mb-1 text-sm font-semibold">{children}</h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="mt-1 mb-0.5 text-sm font-semibold">{children}</h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-sm leading-relaxed mb-1.5 last:mb-0">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="my-1 list-disc pl-4 space-y-0.5 text-sm">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="my-1 list-decimal pl-4 space-y-0.5 text-sm">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm">{children}</li>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em>{children}</em>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {children}
                      </a>
                    ),
                    code: ({ className, children }) => {
                      const isBlock = className?.includes("language-")
                      if (isBlock) {
                        return (
                          <code className="text-xs">{children}</code>
                        )
                      }
                      return (
                        <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                          {children}
                        </code>
                      )
                    },
                    pre: ({ children }) => (
                      <pre className="my-2 overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <div className="my-2 overflow-x-auto">
                        <table className="w-full text-xs border-collapse">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="border-b border-border">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-2 py-1 text-left font-semibold text-muted-foreground">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="px-2 py-1 border-b border-border/50">{children}</td>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="my-1 border-l-2 border-primary/30 pl-3 text-sm text-muted-foreground italic">
                        {children}
                      </blockquote>
                    ),
                    hr: () => (
                      <hr className="my-2 border-border/50" />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : message.isStreaming ? (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="animate-pulse">Thinking</span>
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Tool call indicators */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {message.toolCalls.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-muted/80 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                <Wrench className="h-2.5 w-2.5" />
                {tool.name}
              </span>
            ))}
          </div>
        )}

        {message.isStreaming && message.content && (
          <span className="inline-block h-3 w-0.5 animate-pulse bg-foreground/50" />
        )}
      </div>
    </div>
  )
}
