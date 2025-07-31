import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Zap, Globe, Send, User, Bot, Settings, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ApiService } from "@/apis/apiService";
import { v4 as uuidv4 } from "uuid";

// Import highlight.js styles
import "highlight.js/styles/github-dark.css";

const ChatInterface = ({
	selectedModel,
	currentConversationId,
	onNewChat,
	onSelectConversation,
}) => {
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState("");
	const [selectedTools, setSelectedTools] = useState([]);
	const [availableTools, setAvailableTools] = useState([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [isLoadingTools, setIsLoadingTools] = useState(true);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);

	const messagesEndRef = useRef(null);
	const abortControllerRef = useRef(null);

	useEffect(() => {
		loadAvailableTools();
	}, []);

	useEffect(() => {
		if (currentConversationId) {
			loadConversationHistory(currentConversationId);
		} else {
			setMessages([]);
		}
	}, [currentConversationId]);

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const loadAvailableTools = async () => {
		try {
			setIsLoadingTools(true);
			const response = await ApiService.getTools();

			// Handle different response formats
			let toolsList = [];
			if (Array.isArray(response)) {
				toolsList = response;
			} else if (response.tools && Array.isArray(response.tools)) {
				toolsList = response.tools;
			} else if (typeof response === "object") {
				toolsList = Object.values(response).flat();
			}

			setAvailableTools(toolsList || []);
		} catch (error) {
			console.error("Failed to load tools:", error);
			setAvailableTools([]);
		} finally {
			setIsLoadingTools(false);
		}
	};

	const loadConversationHistory = async (conversationId) => {
		try {
			setIsLoadingHistory(true);
			const response = await ApiService.getConversationHistory(conversationId);

			// Handle different response formats
			let messagesList = [];
			if (Array.isArray(response)) {
				messagesList = response;
			} else if (response.history && Array.isArray(response.history)) {
				// Convert history format to messages format
				messagesList = response.history.map((msg, index) => ({
					id: `${conversationId}-${index}`,
					role: msg.role,
					content: msg.content,
					timestamp: new Date().toISOString(), // API doesn't provide timestamp in history
				}));
			} else if (response.messages && Array.isArray(response.messages)) {
				messagesList = response.messages;
			}

			setMessages(messagesList || []);
		} catch (error) {
			console.error("Failed to load conversation history:", error);
			setMessages([]);
		} finally {
			setIsLoadingHistory(false);
		}
	};

	const handleSendMessage = async (e) => {
		e.preventDefault();

		if (!inputMessage.trim() || isStreaming || !selectedModel) {
			return;
		}

		const userMessage = {
			id: uuidv4(),
			role: "user",
			content: inputMessage.trim(),
			timestamp: new Date().toISOString(),
		};

		const assistantMessage = {
			id: uuidv4(),
			role: "assistant",
			content: "",
			timestamp: new Date().toISOString(),
			isStreaming: true,
		};

		setMessages((prev) => [...prev, userMessage, assistantMessage]);
		setInputMessage("");
		setIsStreaming(true);

		try {
			// Create abort controller for canceling the stream
			abortControllerRef.current = new AbortController();

			const chatData = {
				prompt: userMessage.content,
				model: selectedModel.replace(":", "/"), // Convert colon to forward slash for API
				conversation_id: currentConversationId || undefined,
				tools: selectedTools.length > 0 ? selectedTools : undefined,
			};

			const response = await ApiService.chatStream(chatData);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let accumulatedContent = "";

			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				const chunk = decoder.decode(value);
				const lines = chunk.split("\n");

				for (const line of lines) {
					if (line.startsWith("data: ")) {
						const data = line.slice(6);

						if (data === "[DONE]") {
							continue;
						}

						try {
							const parsed = JSON.parse(data);

							if (parsed.content) {
								accumulatedContent += parsed.content;

								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === assistantMessage.id
											? {
													...msg,
													content: accumulatedContent,
													isStreaming: true,
											  }
											: msg
									)
								);
							}

							// Handle conversation_id for new conversations
							if (parsed.conversation_id && !currentConversationId) {
								onSelectConversation(parsed.conversation_id);
							}
						} catch (parseError) {
							console.warn("Failed to parse streaming data:", parseError);
						}
					}
				}
			}
		} catch (error) {
			console.error("Streaming error:", error);

			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessage.id
						? {
								...msg,
								content: `Error: ${error.message || "Failed to get response"}`,
								isError: true,
						  }
						: msg
				)
			);
		} finally {
			setIsStreaming(false);
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
				)
			);
			abortControllerRef.current = null;
		}
	};

	const handleToolToggle = (toolId) => {
		setSelectedTools((prev) =>
			prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId]
		);
	};

	const getToolDisplayName = (tool) => {
		if (typeof tool === "string") return tool;
		return tool.name || tool.id || tool;
	};

	const getToolValue = (tool) => {
		if (typeof tool === "string") return tool;
		return tool.id || tool.name || tool;
	};

	const formatTimestamp = (timestamp) => {
		return new Date(timestamp).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getModelDisplayName = () => {
		if (!selectedModel) return "";

		// If selectedModel contains ":", split it and show provider - model
		if (selectedModel.includes(":")) {
			const [provider, model] = selectedModel.split(":");
			return `${provider.charAt(0).toUpperCase() + provider.slice(1)} - ${model}`;
		}

		return selectedModel;
	};

	if (!selectedModel) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center p-8">
				<div className="text-center space-y-4">
					<Settings className="h-12 w-12 mx-auto text-gray-400" />
					<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
						Select a Model
					</h2>
					<p className="text-gray-600 dark:text-gray-400">
						Please select a model from the header to start chatting
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col h-full">
			{/* Welcome Section - shown when no conversation */}
			{!currentConversationId && messages.length === 0 && (
				<div className="flex-1 flex flex-col items-center justify-center p-8">
					<div className="max-w-2xl w-full text-center space-y-6">
						<div className="space-y-2">
							<h2 className="text-3xl font-bold text-gray-900 dark:text-white">
								How can I help you today?
							</h2>
							<p className="text-gray-600 dark:text-gray-400">
								Using {getModelDisplayName()} model
							</p>
						</div>

						{/* Feature Cards */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
							<Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
								<CardContent className="text-center space-y-2 p-0">
									<MessageSquare className="h-8 w-8 mx-auto text-blue-500" />
									<h3 className="font-semibold text-gray-900 dark:text-white">
										Natural Conversations
									</h3>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Chat naturally with AI assistance
									</p>
								</CardContent>
							</Card>

							<Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
								<CardContent className="text-center space-y-2 p-0">
									<Zap className="h-8 w-8 mx-auto text-yellow-500" />
									<h3 className="font-semibold text-gray-900 dark:text-white">
										Tool Integration
									</h3>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Access powerful tools and functions
									</p>
								</CardContent>
							</Card>

							<Card className="p-4 hover:shadow-md transition-shadow cursor-pointer">
								<CardContent className="text-center space-y-2 p-0">
									<Globe className="h-8 w-8 mx-auto text-green-500" />
									<h3 className="font-semibold text-gray-900 dark:text-white">
										Web Search
									</h3>
									<p className="text-sm text-gray-600 dark:text-gray-400">
										Get real-time information from the web
									</p>
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			)}

			{/* Chat Messages */}
			{(currentConversationId || messages.length > 0) && (
				<div className="flex-1 overflow-hidden">
					<ScrollArea className="h-full">
						<div className="p-4 space-y-4">
							{isLoadingHistory ? (
								<div className="text-center py-8">
									<Loader2 className="h-6 w-6 animate-spin mx-auto" />
									<p className="mt-2 text-gray-600 dark:text-gray-400">
										Loading conversation...
									</p>
								</div>
							) : (
								messages.map((message) => (
									<div
										key={message.id}
										className={`flex gap-3 ${
											message.role === "user"
												? "justify-end"
												: "justify-start"
										}`}>
										{message.role === "assistant" && (
											<div className="flex-shrink-0">
												<div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
													<Bot className="h-4 w-4 text-white" />
												</div>
											</div>
										)}

										<div
											className={`max-w-[70%] rounded-lg px-4 py-2 ${
												message.role === "user"
													? "bg-blue-500 text-white"
													: message.isError
													? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
													: "bg-gray-100 dark:bg-gray-800"
											}`}>
											{message.role === "user" ? (
												<p className="text-sm">{message.content}</p>
											) : (
												<div className="prose prose-sm max-w-none dark:prose-invert text-gray-900 dark:text-gray-100">
													{message.isStreaming ? (
														// Simple text display during streaming
														<div>
															{message.content}
															<span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
														</div>
													) : (
														// Use ReactMarkdown only when streaming is complete
														<ReactMarkdown
															remarkPlugins={[remarkGfm]}
															rehypePlugins={[rehypeHighlight]}
															components={{
																code: ({
																	node,
																	inline,
																	className,
																	children,
																	...props
																}) => {
																	const match =
																		/language-(\w+)/.exec(
																			className || ""
																		);
																	return !inline && match ? (
																		<pre className="rounded-md overflow-x-auto">
																			<code
																				className={
																					className
																				}
																				{...props}>
																				{children}
																			</code>
																		</pre>
																	) : (
																		<code
																			className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm"
																			{...props}>
																			{children}
																		</code>
																	);
																},
															}}>
															{message.content}
														</ReactMarkdown>
													)}
												</div>
											)}

											<div className="text-xs opacity-70 mt-1">
												{formatTimestamp(message.timestamp)}
											</div>
										</div>

										{message.role === "user" && (
											<div className="flex-shrink-0">
												<div className="w-8 h-8 rounded-full bg-gray-500 flex items-center justify-center">
													<User className="h-4 w-4 text-white" />
												</div>
											</div>
										)}
									</div>
								))
							)}
							<div ref={messagesEndRef} />
						</div>
					</ScrollArea>
				</div>
			)}

			<Separator />

			{/* Input Area */}
			<div className="p-4 bg-white dark:dark:bg-zinc-950">
				{/* Tools Selection */}
				{availableTools.length > 0 && (
					<div className="mb-4">
						<div className="flex items-center gap-2 mb-2">
							<Zap className="h-4 w-4 text-gray-600 dark:text-gray-400" />
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Available Tools:
							</span>
							{isLoadingTools && <Loader2 className="h-3 w-3 animate-spin" />}
						</div>
						<div className="flex flex-wrap gap-2">
							{availableTools.map((tool, index) => {
								const toolId = getToolValue(tool);
								const isSelected = selectedTools.includes(toolId);
								return (
									<Badge
										key={toolId || index}
										variant={isSelected ? "default" : "outline"}
										className="cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 dark:hover:text-white dark:text-black dark:bg-zinc-400"
										onClick={() => handleToolToggle(toolId)}>
										{getToolDisplayName(tool)}
									</Badge>
								);
							})}
						</div>
						{selectedTools.length > 0 && (
							<p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
								Selected tools: {selectedTools.join(", ")}
							</p>
						)}
					</div>
				)}

				{/* Message Input */}
				<form
					onSubmit={handleSendMessage}
					className="flex gap-2 items-center text=gray-900 dark:text-gray-100">
					<Input
						value={inputMessage}
						onChange={(e) => setInputMessage(e.target.value)}
						placeholder="Type your message..."
						disabled={isStreaming}
						className="flex-1"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSendMessage(e);
							}
						}}
					/>

					<Button
						type="submit"
						disabled={!inputMessage.trim() || isStreaming || !selectedModel}
						size="icon">
						{isStreaming ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Send className="h-4 w-4" />
						)}
					</Button>
				</form>
			</div>
		</div>
	);
};

export default ChatInterface;
