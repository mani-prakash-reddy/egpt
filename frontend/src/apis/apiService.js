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

	// POST /api/v1/signin - Updated to match OpenAPI spec
	static async signin(credentials) {
		const formData = new URLSearchParams({
			username: credentials.username,
			password: credentials.password,
			grant_type: "password",
			scope: credentials.scope || "",
			client_id: credentials.client_id || "",
			client_secret: credentials.client_secret || "",
		});

		const url = `${this.baseURL}/signin`;
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: formData,
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || "Signin failed");
		}

		return response.json();
	}

	// Chat endpoints

	// GET /api/v1/models
	static async getAvailableModels() {
		return this.request("/models");
	}

	// GET /api/v1/models (alias for compatibility)
	static async getModels() {
		return this.getAvailableModels();
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
				"Content-Type": "application/json",
				...this.getAuthHeaders(),
			},
			body: JSON.stringify(chatData),
		};

		const response = await fetch(url, config);

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
		}

		return response; // Return response for streaming
	}

	// GET /api/v1/conversations/{conversation_id}/history
	static async getConversationHistory(conversationId) {
		return this.request(`/conversations/${conversationId}/history`);
	}

	// GET /api/v1/conversations?limit&offset
	static async getUserConversations({ limit = 50, offset = 0 } = {}) {
		const params = new URLSearchParams({
			limit: limit.toString(),
			offset: offset.toString(),
		});
		return this.request(`/conversations?${params.toString()}`);
	}

	// GET /api/v1/conversations?limit&offset (alias for compatibility)
	static async getConversations({ limit = 50, offset = 0 } = {}) {
		return this.getUserConversations({ limit, offset });
	}

	// DELETE /api/v1/conversations/{conversation_id}
	static async deleteConversation(conversationId) {
		return this.request(`/conversations/${conversationId}`, {
			method: "DELETE",
		});
	}

	// Document management endpoints

	// POST /api/v1/conversations/{conversation_id}/documents
	static async uploadDocumentToConversation(conversationId, file) {
		const url = `${this.baseURL}/conversations/${conversationId}/documents`;

		const formData = new FormData();
		formData.append("file", file);

		const response = await fetch(url, {
			method: "POST",
			headers: {
				...this.getAuthHeaders(),
				// Don't set Content-Type here as it will be set automatically with boundary
			},
			body: formData,
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
		}

		return response.json();
	}

	// GET /api/v1/conversations/{conversation_id}/documents
	static async getConversationDocuments(conversationId) {
		return this.request(`/conversations/${conversationId}/documents`);
	}

	// DELETE /api/v1/documents/{document_id}
	static async deleteDocument(documentId) {
		return this.request(`/documents/${documentId}`, {
			method: "DELETE",
		});
	}

	// GET /api/v1/health
	static async healthCheck() {
		try {
			const response = await this.request("/health");
			return response;
		} catch (error) {
			return false;
		}
	}

	// POST /api/v1/logout (optional - not in OpenAPI spec but commonly needed)
	static async logout() {
		// Since the API doesn't specify a logout endpoint, we'll just return success
		// The actual logout logic is handled by clearing tokens in AuthContext
		return Promise.resolve();
	}
}
