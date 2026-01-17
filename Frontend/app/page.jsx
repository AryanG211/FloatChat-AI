"use client"

import { useState, useEffect } from "react"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/auth/login-form"
import { SignupForm } from "@/components/auth/signup-form"
import { Sidebar } from "@/components/layout/sidebar"
import { ChatWindow } from "@/components/chat/chat-window"
import Dashboard from "@/components/dashboard/Dashboard" // Import Dashboard
import { Button } from "@/components/ui/button" // Assuming Button is from a UI library like shadcn
import { Menu, X, PanelLeftIcon } from "lucide-react" // Icons for toggle button

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isLogin ? (
          <LoginForm onToggleMode={() => setIsLogin(false)} />
        ) : (
          <SignupForm onToggleMode={() => setIsLogin(true)} />
        )}
      </div>
    </div>
  )
}

function ChatApp() {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [isSplitView, setIsSplitView] = useState(false) // State for split view
  const [isSidebarVisible, setIsSidebarVisible] = useState(true) // State for sidebar visibility
  const [dashData, setDashData] = useState([]) // Data to visualize in Dashboard

  // Simulate loading chat history
  useEffect(() => {
    const loadChatHistory = async () => {
      const mockHistory = [
        {
          id: "1",
          content: "Hello! How can I help you today?",
          sender: "bot",
          timestamp: new Date().toISOString(),
        },
      ]
      setMessages(mockHistory)
    }

    loadChatHistory() // Load chat history by default
  }, [])

  const handleSendMessage = async (content) => {
    const userMessage = {
      id: Date.now().toString(),
      content,
      sender: "user",
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      const res = await fetch(base + '/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content })
      })
      if (!res.ok) throw new Error('Backend error')
      const data = await res.json()

      if (data.type === 'answer') {
        const botResponse = {
          id: (Date.now() + 1).toString(),
          content: data.answer,
          sender: 'bot',
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, botResponse])
      } else if (data.type === 'visualization') {
        // Open dashboard split view and pass data down
        setIsSplitView(true)
        setDashData(data.data || [])
        // If backend also sent a textual answer, show it as a bot message
        if (data.answer) {
          const textBotResponse = {
            id: (Date.now() + 1).toString(),
            content: data.answer,
            sender: 'bot',
            timestamp: new Date().toISOString(),
          }
          setMessages((prev) => [...prev, textBotResponse])
        }
        const botResponse = {
          id: (Date.now() + 2).toString(),
          content: 'Received data for visualization. Opened dashboard (filtered to requested condition).',
          sender: 'bot',
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, botResponse])
      } else if (data.type === 'table') {
        // Render a compact, screen-fitting table
        const rows = data.data || []
        const columns = rows.length ? Object.keys(rows[0]) : []
        const possibleConds = ["temperature", "salinity", "pressure"]
        const condCols = possibleConds.filter(c => columns.includes(c))
        // Preferred order without year/month
        const preferredOrder = ["float_id", ...condCols, "latitude", "longitude", "depth_min", "depth_max"]
        const orderedColumns = [
          ...preferredOrder.filter(c => columns.includes(c)),
          ...columns.filter(c => !preferredOrder.includes(c)),
        ]
        const tableHtml = `
          <div class="overflow-x-auto w-full">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr>
                  ${orderedColumns.map(c => `<th class="text-left font-medium border-b p-2">${c}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => `
                  <tr>
                    ${orderedColumns.map(c => `<td class="border-b p-2 whitespace-nowrap">${r[c] ?? ''}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `
        const botResponse = {
          id: (Date.now() + 1).toString(),
          content: tableHtml,
          sender: 'bot',
          timestamp: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, botResponse])
      }
    } catch (error) {
      console.error("Failed to send message:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen min-h-screen bg-background">
      <div
        className={`transition-all duration-100 ${
          isSidebarVisible ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <Sidebar activeTab="chat" onTabChange={() => {}} />
      </div>
      <main className="flex-1 flex flex-col">
        <div className="p-3.5 border-b flex justify-between items-center">
          <Button
            className="cursor-pointer"
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarVisible(!isSidebarVisible)}
          >
            {isSidebarVisible ? <PanelLeftIcon className="h-4 w-4  group-hover:sidebar-primary-foreground" /> : <Menu className="h-4 w-4  group-hover:sidebar-primary" />}
          </Button>
          <Button className="cursor-pointer mr-5"
            onClick={() => setIsSplitView(!isSplitView)}
          >
            {isSplitView ? "Back to Chat" : "Go to Dashboard"}
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          {isSplitView ? (
            <div className="flex h-full">
              {/* Chat Window (left side) */}
              <div className="w-1/2 h-full border-r">
                <ChatWindow messages={messages} onSendMessage={handleSendMessage} loading={loading} />
              </div>
              {/* Dashboard (right side) */}
              <div className="w-1/2 h-full p-4 overflow-auto">
                <Dashboard data={dashData} />
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <ChatWindow messages={messages} onSendMessage={handleSendMessage} loading={loading} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function Page() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  return user ? <ChatApp /> : <AuthPage />
}