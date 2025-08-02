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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LogOut, User, Settings, Wrench, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/apis/apiService";

const ChatHeader = ({ selectedModel, onModelChange }) => {
	const [providers, setProviders] = useState({});
	const [isLoadingModels, setIsLoadingModels] = useState(true);
	const [availableTools, setAvailableTools] = useState([]);
	const [selectedTools, setSelectedTools] = useState([]);
	const [isLoadingTools, setIsLoadingTools] = useState(true);
	const [toolSearchQuery, setToolSearchQuery] = useState("");
	const { logout } = useAuth();

	useEffect(() => {
		loadModels();
		loadTools();
	}, []);

	const loadModels = async () => {
		try {
			setIsLoadingModels(true);
			const response = await ApiService.getAvailableModels();

			// Handle different response formats
			let groupedProviders = {};

			if (Array.isArray(response)) {
				// Handle array format (legacy)
				response.forEach((model) => {
					const provider = model.provider || "unknown";
					if (!groupedProviders[provider]) {
						groupedProviders[provider] = [];
					}
					groupedProviders[provider].push({
						id: `${provider}/${model.model_name}`,
						name: model.display_name || model.model_name,
						description: model.description || "",
					});
				});
			} else if (response && response.models && Array.isArray(response.models)) {
				// Handle {models: [...]} format
				response.models.forEach((model) => {
					const provider = model.provider || "unknown";
					if (!groupedProviders[provider]) {
						groupedProviders[provider] = [];
					}
					groupedProviders[provider].push({
						id: `${provider}/${model.model_name}`,
						name: model.display_name || model.model_name,
						description: model.description || "",
					});
				});
			} else if (response && typeof response === "object") {
				// Handle the standard backend format: { "provider_name": ["model1", "model2", ...] }
				Object.entries(response).forEach(([providerName, models]) => {
					if (Array.isArray(models)) {
						groupedProviders[providerName] = models.map((modelName) => ({
							id: `${providerName}/${modelName}`,
							name: modelName,
							description: "",
						}));
					}
				});
			} else {
				console.warn("Unexpected models response format:", response);
				groupedProviders = {};
			}

			setProviders(groupedProviders);

			// Set default model if none selected
			if (!selectedModel && Object.keys(groupedProviders).length > 0) {
				const firstProvider = Object.keys(groupedProviders)[0];
				const firstModel = groupedProviders[firstProvider][0];
				onModelChange(firstModel.id);
			}
		} catch (error) {
			console.error("Failed to load models:", error);
			setProviders({});
		} finally {
			setIsLoadingModels(false);
		}
	};

	const loadTools = async () => {
		try {
			setIsLoadingTools(true);
			const response = await ApiService.getTools();

			// Handle different response formats
			let toolsList = [];
			if (Array.isArray(response)) {
				toolsList = response;
			} else if (response && Array.isArray(response.tools)) {
				toolsList = response.tools;
			} else {
				console.warn("Unexpected tools response format:", response);
				toolsList = [];
			}

			setAvailableTools(toolsList);
		} catch (error) {
			console.error("Failed to load tools:", error);
			setAvailableTools([]);
		} finally {
			setIsLoadingTools(false);
		}
	};

	const handleLogout = async () => {
		try {
			await logout();
		} catch (error) {
			console.error("Logout failed:", error);
		}
	};

	const getSelectedModelDisplay = () => {
		if (!selectedModel) return "Select Model";

		// If selectedModel contains "/", split it and show provider - model
		if (selectedModel.includes("/")) {
			const [provider, model] = selectedModel.split("/");
			return `${provider.charAt(0).toUpperCase() + provider.slice(1)} - ${model}`;
		}

		return selectedModel;
	};

	const handleToolToggle = (toolName) => {
		setSelectedTools((prev) => {
			if (prev.includes(toolName)) {
				return prev.filter((t) => t !== toolName);
			} else {
				return [...prev, toolName];
			}
		});
	};

	const filteredTools = availableTools.filter((tool) => {
		const toolName = typeof tool === "string" ? tool : tool.name || tool.id || "";
		return toolName.toLowerCase().includes(toolSearchQuery.toLowerCase());
	});

	const getToolDisplayName = (tool) => {
		if (typeof tool === "string") return tool;
		return tool.display_name || tool.name || tool.id || "Unknown Tool";
	};

	return (
		<header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-neutral-900">
			{/* Left side - App name and model selection */}
			<div className="flex items-center gap-4">
				<h1 className="text-xl font-bold text-gray-900 dark:text-white">GPT Assistant</h1>

				<div className="flex items-center gap-2">
					{/* Model Selection */}
					<Select
						value={selectedModel}
						onValueChange={onModelChange}
						disabled={isLoadingModels}>
						<SelectTrigger className="w-[200px]">
							<SelectValue
								placeholder={
									isLoadingModels ? "Loading..." : getSelectedModelDisplay()
								}
							/>
						</SelectTrigger>
						<SelectContent>
							{isLoadingModels ? (
								<SelectItem value="loading" disabled>
									<div className="flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading models...
									</div>
								</SelectItem>
							) : (
								Object.entries(providers).map(([provider, models]) => (
									<SelectGroup key={provider}>
										<SelectLabel className="capitalize">{provider}</SelectLabel>
										{models.map((model) => (
											<SelectItem
												key={model.id}
												value={model.id}
												className="cursor-pointer">
												<div className="flex flex-col">
													<span>{model.name}</span>
													{model.description && (
														<span className="text-xs text-gray-500 dark:text-gray-400">
															{model.description}
														</span>
													)}
												</div>
											</SelectItem>
										))}
									</SelectGroup>
								))
							)}
						</SelectContent>
					</Select>

					{/* Tools Button */}
					<Sheet>
						<SheetTrigger asChild>
							<Button variant="outline" size="sm" className="gap-2">
								<Wrench className="h-4 w-4" />
								<span className="hidden sm:inline">Tools</span>
								{selectedTools.length > 0 && (
									<span className="bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.5rem] h-5 flex items-center justify-center">
										{selectedTools.length}
									</span>
								)}
							</Button>
						</SheetTrigger>
						<SheetContent className="w-[400px] sm:w-[540px]">
							<SheetHeader>
								<SheetTitle>Available Tools</SheetTitle>
								<SheetDescription>
									Select tools to enhance your chat experience
								</SheetDescription>
							</SheetHeader>

							<div className="space-y-4 mt-6">
								{/* Search Bar */}
								<div className="relative">
									<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
									<Input
										placeholder="Search tools..."
										value={toolSearchQuery}
										onChange={(e) => setToolSearchQuery(e.target.value)}
										className="pl-10"
									/>
								</div>

								{/* Tools List */}
								<ScrollArea className="h-[400px]">
									{isLoadingTools ? (
										<div className="flex items-center justify-center py-8">
											<Loader2 className="h-6 w-6 animate-spin" />
											<span className="ml-2">Loading tools...</span>
										</div>
									) : filteredTools.length === 0 ? (
										<div className="text-center py-8 text-gray-500 dark:text-gray-400">
											{toolSearchQuery
												? "No tools found matching your search"
												: "No tools available"}
										</div>
									) : (
										<div className="space-y-3">
											{filteredTools.map((tool, index) => {
												const toolName =
													typeof tool === "string"
														? tool
														: tool.name || tool.id || `tool-${index}`;
												const isSelected = selectedTools.includes(toolName);

												return (
													<div
														key={toolName}
														className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
														<div className="flex-1">
															<h4 className="font-medium text-gray-900 dark:text-white">
																{getToolDisplayName(tool)}
															</h4>
															{typeof tool === "object" &&
																tool.description && (
																	<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
																		{tool.description}
																	</p>
																)}
														</div>
														<Switch
															checked={isSelected}
															onCheckedChange={() =>
																handleToolToggle(toolName)
															}
														/>
													</div>
												);
											})}
										</div>
									)}
								</ScrollArea>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>

			{/* Right side - User menu */}
			<div className="flex items-center gap-2">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="relative h-8 w-8 rounded-full">
							<Avatar className="h-8 w-8">
								<AvatarFallback className="bg-neutral-200 dark:bg-neutral-700">
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
							onClick={handleLogout}
							className="flex items-center gap-2 text-red-600 dark:text-red-400">
							<LogOut className="h-4 w-4" />
							<span>Logout</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
};

export default ChatHeader;
