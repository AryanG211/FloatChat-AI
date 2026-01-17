import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageCircle, Zap, Shield, Clock } from "lucide-react"

export function HomeTab() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to AI Chat</h1>
        <p className="text-lg text-muted-foreground">Your intelligent conversation partner powered by advanced AI</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <MessageCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Natural Conversations</CardTitle>
            <CardDescription>Engage in natural, flowing conversations with our AI assistant</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-12 w-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-2">
              <Zap className="h-6 w-6 text-secondary" />
            </div>
            <CardTitle className="text-lg">Lightning Fast</CardTitle>
            <CardDescription>Get instant responses powered by cutting-edge AI technology</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-12 w-12 bg-accent/10 rounded-lg flex items-center justify-center mb-2">
              <Shield className="h-6 w-6 text-accent" />
            </div>
            <CardTitle className="text-lg">Secure & Private</CardTitle>
            <CardDescription>Your conversations are protected with enterprise-grade security</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                1
              </div>
              <div>
                <div className="font-medium">Start a Conversation</div>
                <div className="text-muted-foreground">
                  Click on the "Chatbot Tab" to begin chatting with our AI assistant
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                2
              </div>
              <div>
                <div className="font-medium">Ask Anything</div>
                <div className="text-muted-foreground">
                  Type your questions or thoughts in the message box and press Enter
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                3
              </div>
              <div>
                <div className="font-medium">Explore Features</div>
                <div className="text-muted-foreground">Discover the full potential of AI-powered conversations</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
