import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectGroup,
	SelectLabel,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/apis/apiService";

const Header = ({ selectedModel, onModelChange }) => {
	const [providers, setProviders] = useState({});
	const [isLoadingModels, setIsLoadingModels] = useState(true);
	const { logout } = useAuth();

	useEffect(() => {
		loadModels();
	}, []);

	const loadModels = async () => {
		try {
			setIsLoadingModels(true);
			const response = await ApiService.getAvailableModels();

			// Handle different response formats
			let providersData = {};
			if (typeof response === "object" && !Array.isArray(response)) {
				// Response is in the expected format: { "openai": [...], "ollama": [...] }
				providersData = response;
			} else if (Array.isArray(response)) {
				// Fallback: if it's just an array, put it under "default" provider
				providersData = { default: response };
			} else if (response.models && typeof response.models === "object") {
				providersData = response.models;
			}

			setProviders(providersData);

			// Set default model if none selected
			if (!selectedModel && Object.keys(providersData).length > 0) {
				const firstProvider = Object.keys(providersData)[0];
				const firstModel = providersData[firstProvider][0];
				if (firstModel) {
					onModelChange(`${firstProvider}:${firstModel}`);
				}
			}
		} catch (error) {
			console.error("Failed to load models:", error);
			setProviders({});
		} finally {
			setIsLoadingModels(false);
		}
	};

	const handleLogout = async () => {
		await logout();
	};

	const getSelectedModelDisplay = () => {
		if (!selectedModel) return "";

		// If selectedModel contains ":", split it
		if (selectedModel.includes(":")) {
			const [provider, model] = selectedModel.split(":");
			return `${provider} - ${model}`;
		}

		return selectedModel;
	};

	const capitalizeProvider = (provider) => {
		return provider.charAt(0).toUpperCase() + provider.slice(1);
	};

	return (
		<header className="bg-white dark:bg-zinc-950 border-b border-gray-200 dark:border-gray-700 px-4 py-3 dark:text-gray-200">
			<div className="flex items-center justify-between">
				{/* Left side - Model Selector */}
				<div className="flex items-center gap-4">
					<h1 className="text-lg font-semibold text-gray-900 dark:text-white">
						Enterprise GPT
					</h1>

					<div className="flex items-center gap-2">
						<span className="text-sm text-gray-600 dark:text-gray-400">Model:</span>
						<Select
							value={selectedModel}
							onValueChange={onModelChange}
							disabled={isLoadingModels}>
							<SelectTrigger className="w-[250px]">
								<SelectValue
									placeholder={
										isLoadingModels ? "Loading models..." : "Select a model"
									}>
									{selectedModel && getSelectedModelDisplay()}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{Object.keys(providers).length === 0 && !isLoadingModels ? (
									<SelectItem value="no-models" disabled>
										No models available
									</SelectItem>
								) : (
									Object.entries(providers).map(([provider, models]) => (
										<SelectGroup key={provider}>
											<SelectLabel className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
												{capitalizeProvider(provider)}
											</SelectLabel>
											{Array.isArray(models) &&
												models.map((model, index) => (
													<SelectItem
														key={`${provider}:${model}`}
														value={`${provider}:${model}`}
														className="pl-6 text-gray-800 dark:text-zinc-400">
														{model}
													</SelectItem>
												))}
										</SelectGroup>
									))
								)}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Right side - User Profile */}
				<div className="flex items-center gap-2">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="relative h-8 w-8 rounded-full">
								<Avatar className="h-8 w-8">
									<AvatarFallback className="bg-gray-200 dark:bg-gray-700">
										<User className="h-4 w-4" />
									</AvatarFallback>
								</Avatar>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent className="w-56" align="end" forceMount>
							<DropdownMenuItem className="flex items-center gap-2">
								<User className="h-4 w-4" />
								<span>Profile</span>
							</DropdownMenuItem>
							<DropdownMenuItem className="flex items-center gap-2">
								<Settings className="h-4 w-4" />
								<span>Settings</span>
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="flex items-center gap-2 text-red-600 dark:text-red-400"
								onClick={handleLogout}>
								<LogOut className="h-4 w-4" />
								<span>Log out</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
};

export default Header;
