import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bot, User } from "lucide-react"

export function MessageBubble({ content, sender, timestamp }) {
  const isUser = sender === "user"

  return (
    <div className={cn("flex gap-3 mb-4", isUser && "flex-row-reverse")}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarFallback
          className={cn(isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div className={cn("flex flex-col max-w-[80%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-lg px-4 py-2 text-sm leading-relaxed",
            isUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground border",
          )}
        >
          {isUser ? content : (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          )}
        </div>
        <span className="text-xs text-muted-foreground mt-1 px-1">
          {new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}
