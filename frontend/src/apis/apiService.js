export class ApiService {
	static baseURL = `${import.meta.env.VITE_API_BASE_URL || ""}/api/v1`;

	static getAuthHeaders() {
		const token = localStorage.getItem("access_token");
		const tokenType = localStorage.getItem("token_type");

		if (token && tokenType) {
			return {
				Authorization: `${tokenType} ${token}`,
			};
		}
		return {};
	}

	static async request(endpoint, options = {}) {
		const url = `${this.baseURL}${endpoint}`;
		const config = {
			headers: {
				"Content-Type": "application/json",
				...this.getAuthHeaders(),
				...options.headers,
			},
			...options,
		};

		const response = await fetch(url, config);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
		}

		return response.json();
	}

	// Auth endpoints

	// POST /api/v1/signup
	static async signup(userData) {
		return this.request("/signup", {
			method: "POST",
			body: JSON.stringify(userData),
		});
	}

	// POST /api/v1/signin
	static async signin(credentials) {
		const formData = new URLSearchParams({
			username: credentials.username,
			password: credentials.password,
			grant_type: "password",
			scope: credentials.scope || "",
			client_id: credentials.client_id || "",
			client_secret: credentials.client_secret || "",
		});
		return fetch(`${this.baseURL}/signin`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: formData,
		}).then((response) => {
			if (!response.ok) {
				throw new Error("Signin failed");
			}
			return response.json();
		});
	}

	// POST /api/v1/token (login for access token)
	static async loginForAccessToken(credentials) {
		const formData = new URLSearchParams({
			username: credentials.username,
			password: credentials.password,
			grant_type: "password",
			scope: credentials.scope || "",
			client_id: credentials.client_id || "",
			client_secret: credentials.client_secret || "",
		});
		return fetch(`${this.baseURL}/token`, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: formData,
		}).then((response) => {
			if (!response.ok) {
				throw new Error("Login for access token failed");
			}
			return response.json();
		});
	}

	// POST /api/v1/logout
	static async logout() {
		return this.request("/logout", {
			method: "POST",
		});
	}

	// Chat endpoints

	// GET /api/v1/models
	static async getModels() {
		return this.request("/models");
	}

	// GET /api/v1/tools
	static async getTools() {
		return this.request("/tools");
	}

	// POST /api/v1/chat/stream
	static async chatStream(chatData) {
		const url = `${this.baseURL}/chat/stream`;
		const config = {
			method: "POST",
			headers: {
				"Content-Type": "text/stream",
				...this.getAuthHeaders(),
			},
			body: JSON.stringify(chatData),
		};
		const response = await fetch(url, config);
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
		}
		return response; // For streaming
	}

	// GET /api/v1/conversations/{conversation_id}/history
	static async getConversationHistory(conversationId) {
		return this.request(`/conversations/${conversationId}/history`);
	}

	// Additional conversation management methods

	// GET /api/v1/conversations?limit&offset
	static async getConversations({ limit = 50, offset = 0 } = {}) {
		const params = new URLSearchParams({ limit, offset });
		return this.request(`/conversations?${params.toString()}`);
	}

	// DELETE /api/v1/conversations/{conversation_id}
	static async deleteConversation(conversationId) {
		return this.request(`/conversations/${conversationId}`, {
			method: "DELETE",
		});
	}

	// GET /api/v1/health
	static async healthCheck() {
		const url = `${this.baseURL}/health`;
		const response = await fetch(url);
		if (!response.ok) return false;
		return response.json();
	}
}
