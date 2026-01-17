"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageBubble } from "./message-bubble"
import { Send, Loader2, Mic } from "lucide-react"
import Dashboard from '../dashboard/Dashboard'
import { bg } from "date-fns/locale"

export function ChatWindow({ messages, onSendMessage, loading }) {
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const programmaticSetRef = useRef(false)
  // Keep caret at end only when text was set programmatically
  useEffect(() => {
    if (programmaticSetRef.current && inputRef.current) {
      const el = inputRef.current
      try {
        el.selectionStart = el.selectionEnd = el.value.length
      } catch {}
      programmaticSetRef.current = false
    }
  }, [inputMessage])

  // Expose a global setter so the map can populate this input directly
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__setChatInput = (text) => {
        programmaticSetRef.current = true
        setInputMessage(text)
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.__setChatInput = undefined
      }
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || loading) return

    const message = inputMessage.trim()
    setIsTyping(true)

    try {
      await onSendMessage(message)
      setInputMessage("")
    } finally {
      setIsTyping(false)
      inputRef.current?.focus()
    }
  }

  // Allow external trigger to submit current chat input (used after map sets coords)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__submitChatInput = async () => {
        if (!inputMessage.trim() || loading) return
        const message = inputMessage.trim()
        setInputMessage("")
        setIsTyping(true)
        try {
          await onSendMessage(message)
        } finally {
          setIsTyping(false)
          inputRef.current?.focus()
        }
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.__submitChatInput = undefined
      }
    }
  }, [inputMessage, loading, onSendMessage])

  const handleKeyDown = (e) => {
    // Enter submits, Shift+Enter inserts newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
      return
    }
    // Do not auto-move caret on Backspace; let browser manage it naturally
    if (e.key === "Backspace") {
      // no-op: default caret behavior preserved
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toggle Button */}
      {/* <div className="p-4 border-b flex justify-end">
        <Button onClick={() => setShowDashboard(!showDashboard)}>
          {showDashboard ? "Switch to Chat" : "Switch to Dashboard"}
        </Button>
      </div> */}

      {/* Conditional Rendering */}
      {showDashboard ? (
        <div className="p-4 overflow-hidden">
          <Dashboard />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="text-muted-foreground">
                <div className="text-lg font-medium mb-2">Welcome to AI Chat!</div>
                <div className="text-sm">Start a conversation by typing a message below.</div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  content={message.content}
                  sender={message.sender}
                  timestamp={message.timestamp}
                />
              ))}
              {isTyping && (
                <div className="flex gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="bg-card text-card-foreground border rounded-lg px-4 py-2 text-sm">AI is typing...</div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Area (only visible in chat mode) */}
      {!showDashboard && (
        <div className="border-t bg-background p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type message. Shift+Enter for newline, Enter to send."
                disabled={loading}
                className="pr-12 min-h-16"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 cursor-pointer"
                disabled={loading}
              >
                <Mic 
                  className="h-4 w-4"
                  

                />
              </Button>
            </div>
            <Button className="cursor-pointer" type="submit" disabled={loading || !inputMessage.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}