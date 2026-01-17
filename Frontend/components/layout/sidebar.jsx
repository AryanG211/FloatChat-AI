"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { MessageCircle, LogOut, User, Waves } from "lucide-react"

export function Sidebar({ activeTab, onTabChange }) {
  const { user, logout } = useAuth()

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col min-h-0 h-full">
      {/* Header */}
      <div className="p-4 pb-4 border-b flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Waves className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="font-semibold text-sidebar-foreground">Float Chat</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4 overflow-auto mt-1">
        <nav className="space-y-2">
          <Button
            variant={activeTab === "chat" ? "default" : "ghost"}
            className={cn(
              "w-full justify-start",
              activeTab === "chat" && "bg-sidebar-primary text-sidebar-primary-foreground",
            )}
            onClick={() => onTabChange("chat")}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Chatbot Tab
          </Button>
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 bg-sidebar-accent rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "User"}</div>
            <div className="text-xs text-sidebar-foreground/70 truncate">{user?.email}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}