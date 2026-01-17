// API service layer for FastAPI backend integration

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

class ApiService {
  getAuthHeaders() {
    const token = sessionStorage.getItem("auth_token")
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  async login(data) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error("Login failed")
    }

    return response.json()
  }

  async signup(data) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error("Signup failed")
    }

    return response.json()
  }

  async getChatHistory() {
    const response = await fetch(`${API_BASE_URL}/chat/history`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch chat history")
    }

    return response.json()
  }

  async sendMessage(data) {
    const response = await fetch(`${API_BASE_URL}/chat/send`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error("Failed to send message")
    }

    return response.json()
  }

  async getUserProfile() {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch user profile")
    }

    return response.json()
  }

  async updateUserProfile(data) {
    const response = await fetch(`${API_BASE_URL}/user/profile`, {
      method: "PUT",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error("Failed to update user profile")
    }

    return response.json()
  }

  async getConversations() {
    const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch conversations")
    }

    return response.json()
  }

  async createConversation(title) {
    const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ title }),
    })

    if (!response.ok) {
      throw new Error("Failed to create conversation")
    }

    return response.json()
  }

  async deleteConversation(conversationId) {
    const response = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to delete conversation")
    }
  }

  async getConversationMessages(conversationId) {
    const response = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages`, {
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to fetch conversation messages")
    }

    return response.json()
  }

  async refreshToken() {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to refresh token")
    }

    return response.json()
  }

  async logout() {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: this.getAuthHeaders(),
    })

    if (!response.ok) {
      throw new Error("Failed to logout")
    }
  }
}

export const apiService = new ApiService()
