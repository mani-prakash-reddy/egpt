import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiService } from "@/apis/apiService";
import DarkVeil from "@/reactBits/Backgrounds/DarkVeil/DarkVeil";

const AuthForm = ({ onSuccess }) => {
	const [isLogin, setIsLogin] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [formData, setFormData] = useState({
		username: "",
		email: "",
		password: "",
	});

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			if (isLogin) {
				// Use signin endpoint which returns access_token
				const response = await ApiService.signin({
					username: formData.username,
					password: formData.password,
				});

				// Store the token in localStorage
				localStorage.setItem("access_token", response.access_token);
				localStorage.setItem("token_type", response.token_type);

				if (onSuccess) {
					onSuccess(response);
				}
			} else {
				// Signup first
				await ApiService.signup({
					username: formData.username,
					email: formData.email,
					password: formData.password,
				});

				// Then automatically sign in
				const response = await ApiService.signin({
					username: formData.username,
					password: formData.password,
				});

				// Store the token in localStorage
				localStorage.setItem("access_token", response.access_token);
				localStorage.setItem("token_type", response.token_type);

				if (onSuccess) {
					onSuccess(response);
				}
			}
		} catch (err) {
			setError(err.message || "Authentication failed");
		} finally {
			setIsLoading(false);
		}
	};

	const toggleMode = () => {
		setIsLogin(!isLogin);
		setError("");
		setFormData({
			username: "",
			email: "",
			password: "",
		});
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-zinc-950 px-4 dark:text-gray-200 relative overflow-hidden">
			{/* Animated background */}
			<div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
				<DarkVeil
					hueShift={30}
					noiseIntensity={0.08}
					scanlineIntensity={0.12}
					scanlineFrequency={0.8}
					warpAmount={0.08}
					speed={0.5}
					resolutionScale={1}
				/>
			</div>
			{/* Auth Card */}
			<div className="relative z-10 w-full max-w-md">
				<Card className="w-full bg-white/60 dark:bg-zinc-950/60  backdrop-blur-none shadow-lg">
					<CardHeader className="space-y-1">
						<CardTitle className="text-2xl font-bold text-center">
							{isLogin ? "Welcome back" : "Create account"}
						</CardTitle>
						<CardDescription className="text-center">
							{isLogin
								? "Enter your credentials to access your account"
								: "Enter your details to create a new account"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form onSubmit={handleSubmit} className="space-y-4">
							{error && (
								<div className="p-3 text-sm text-red-600 bg-red-900 dark:bg-red-900/10 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md">
									{error}
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="username">Username</Label>
								<Input
									id="username"
									name="username"
									type="text"
									value={formData.username}
									onChange={handleInputChange}
									placeholder="Enter your username"
									required
								/>
							</div>

							{!isLogin && (
								<div className="space-y-2">
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										name="email"
										type="email"
										value={formData.email}
										onChange={handleInputChange}
										placeholder="Enter your email"
										required
									/>
								</div>
							)}

							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									name="password"
									type="password"
									value={formData.password}
									onChange={handleInputChange}
									placeholder="Enter your password"
									required
								/>
							</div>

							<Button type="submit" className="w-full" disabled={isLoading}>
								{isLoading
									? isLogin
										? "Signing in..."
										: "Creating account..."
									: isLogin
									? "Sign in"
									: "Create account"}
							</Button>
						</form>

						<div className="mt-6 text-center">
							<p className="text-sm text-gray-600 dark:text-gray-400">
								{isLogin ? "Don't have an account?" : "Already have an account?"}
								<button
									type="button"
									onClick={toggleMode}
									className="ml-1 text-primary hover:underline font-medium">
									{isLogin ? "Sign up" : "Sign in"}
								</button>
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default AuthForm;
