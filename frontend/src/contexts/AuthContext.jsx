import React, { createContext, useContext, useState, useEffect } from "react";
import { ApiService } from "@/apis/apiService";

const AuthContext = createContext(null);

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}
	return context;
};

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	useEffect(() => {
		// Check if user is already logged in on app start
		const token = localStorage.getItem("access_token");
		const tokenType = localStorage.getItem("token_type");

		if (token && tokenType) {
			setIsAuthenticated(true);
			// Optionally, you could validate the token here by making a request to a protected endpoint
		}

		setIsLoading(false);
	}, []);

	const login = (tokenData) => {
		localStorage.setItem("access_token", tokenData.access_token);
		localStorage.setItem("token_type", tokenData.token_type);
		setIsAuthenticated(true);
		setUser({ token: tokenData.access_token });
	};

	const logout = async () => {
		try {
			// Call the logout endpoint if authenticated
			if (isAuthenticated) {
				await ApiService.logout();
			}
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			// Clear local storage and state regardless of API call success
			localStorage.removeItem("access_token");
			localStorage.removeItem("token_type");
			setIsAuthenticated(false);
			setUser(null);
		}
	};

	const value = {
		user,
		isLoading,
		isAuthenticated,
		login,
		logout,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
