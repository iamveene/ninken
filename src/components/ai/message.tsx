"use client"

import { cn } from "@/lib/utils"
import { Bot, User, Wrench } from "lucide-react"
import type { AIMessage } from "@/hooks/use-ai-partner"

/**
 * Basic markdown rendering: bold, italic, code, code blocks, links, lists.
 * Keeps it lightweight without a full markdown parser dependency.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  const blocks = text.split(/\n{2,}/)
  const nodes: React.ReactNode[] = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim()
    if (!block) continue

    // Code blocks
    if (block.startsWith("```")) {
      const endIdx = block.indexOf("```", 3)
      const code = endIdx > 3 ? block.slice(block.indexOf("\n", 3) + 1, endIdx) : block.slice(3)
      nodes.push(
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-md bg-muted/50 p-3 text-xs"
        >
          <code>{code.trim()}</code>
        </pre>
      )
      continue
    }

    // Headers
    if (block.startsWith("### ")) {
      nodes.push(
        <h4 key={i} className="mt-2 mb-1 text-sm font-semibold">
          {block.slice(4)}
        </h4>
      )
      continue
    }
    if (block.startsWith("## ")) {
      nodes.push(
        <h3 key={i} className="mt-2 mb-1 font-semibold">
          {block.slice(3)}
        </h3>
      )
      continue
    }

    // List blocks
    if (/^[-*] /.test(block)) {
      const items = block.split(/\n/).filter((l) => l.trim())
      nodes.push(
        <ul key={i} className="my-1 list-disc pl-4 space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="text-sm">
              {renderInline(item.replace(/^[-*]\s+/, ""))}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list blocks
    if (/^\d+\.\s/.test(block)) {
      const items = block.split(/\n/).filter((l) => l.trim())
      nodes.push(
        <ol key={i} className="my-1 list-decimal pl-4 space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="text-sm">
              {renderInline(item.replace(/^\d+\.\s+/, ""))}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Regular paragraph
    nodes.push(
      <p key={i} className="text-sm leading-relaxed">
        {renderInline(block)}
      </p>
    )
  }

  return nodes
}

/** Inline markdown: bold, italic, code, links */
function renderInline(text: string): React.ReactNode {
  // Split into parts to handle inline code, bold, italic, links
  const parts: React.ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/)
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
    // Italic
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/)
    // Link
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)

    // Find the earliest match
    const matches = [
      codeMatch ? { type: "code", match: codeMatch } : null,
      boldMatch ? { type: "bold", match: boldMatch } : null,
      italicMatch ? { type: "italic", match: italicMatch } : null,
      linkMatch ? { type: "link", match: linkMatch } : null,
    ]
      .filter(Boolean)
      .sort((a, b) => (a!.match.index ?? 0) - (b!.match.index ?? 0))

    if (matches.length === 0) {
      parts.push(remaining)
      break
    }

    const first = matches[0]!
    const idx = first.match.index ?? 0

    // Add text before the match
    if (idx > 0) {
      parts.push(remaining.slice(0, idx))
    }

    switch (first.type) {
      case "code":
        parts.push(
          <code
            key={key++}
            className="rounded bg-muted px-1 py-0.5 text-xs font-mono"
          >
            {first.match[1]}
          </code>
        )
        break
      case "bold":
        parts.push(
          <strong key={key++} className="font-semibold">
            {first.match[1]}
          </strong>
        )
        break
      case "italic":
        parts.push(<em key={key++}>{first.match[1]}</em>)
        break
      case "link":
        parts.push(
          <a
            key={key++}
            href={first.match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {first.match[1]}
          </a>
        )
        break
    }

    remaining = remaining.slice(idx + first.match[0].length)
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

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
                renderMarkdown(message.content)
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
