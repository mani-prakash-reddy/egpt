import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
	MessageSquare,
	Zap,
	Globe,
	Send,
	User,
	Bot,
	Settings,
	Loader2,
	StopCircle,
	Paperclip,
	X,
	FileText,
	File,
	Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import remarkFrontmatter from "remark-frontmatter";
import remarkMath from "remark-math";
import remarkWikiLink from "remark-wiki-link";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { ApiService } from "@/apis/apiService";
import { v4 as uuidv4 } from "uuid";

// Import highlight.js styles and katex styles
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";

const ChatCanvas = ({ selectedModel, currentConversationId, onNewChat, onSelectConversation }) => {
	const [messages, setMessages] = useState([]);
	const [inputMessage, setInputMessage] = useState("");
	const [selectedTools, setSelectedTools] = useState([]);
	const [availableTools, setAvailableTools] = useState([]);
	const [isStreaming, setIsStreaming] = useState(false);
	const [isLoadingTools, setIsLoadingTools] = useState(true);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);

	// Document related states
	const [documents, setDocuments] = useState([]);
	const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
	const [isUploadingDocument, setIsUploadingDocument] = useState(false);
	const [uploadError, setUploadError] = useState(null);

	const messagesEndRef = useRef(null);
	const abortControllerRef = useRef(null);
	const fileInputRef = useRef(null);

	useEffect(() => {
		loadAvailableTools();
	}, []);

	useEffect(() => {
		if (currentConversationId) {
			loadConversationHistory(currentConversationId);
			loadConversationDocuments(currentConversationId);
		} else {
			setMessages([]);
			setDocuments([]);
		}
	}, [currentConversationId]);

	useEffect(() => {
		scrollToBottom();
	}, [messages]);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	// Load documents attached to the current conversation
	const loadConversationDocuments = async (conversationId) => {
		if (!conversationId) return;
		
		try {
			setIsLoadingDocuments(true);
			const response = await ApiService.getConversationDocuments(conversationId);
			
			// Handle different response formats
			let documentsList = [];
			if (Array.isArray(response)) {
				documentsList = response;
			} else if (response && Array.isArray(response.documents)) {
				documentsList = response.documents;
			} else {
				console.warn("Unexpected documents response format:", response);
				documentsList = [];
			}
			
			setDocuments(documentsList);
		} catch (error) {
			console.error("Failed to load conversation documents:", error);
			
			// Don't show error toast for new conversations that might not have the endpoint yet
			if (error.message && !error.message.includes("404")) {
				toast({
					title: "Note",
					description: "Document features are loading...",
					variant: "default",
				});
			}
			
			// Set empty documents list on error
			setDocuments([]);
		} finally {
			setIsLoadingDocuments(false);
		}
	};

	// Handle file selection button click
	const handleFileButtonClick = () => {
		fileInputRef.current?.click();
	};

	// Handle file selection
	const handleFileChange = async (e) => {
		const file = e.target.files?.[0];
		if (!file || !currentConversationId) return;

		// Reset file input to allow selecting the same file again
		e.target.value = null;

		await uploadFile(file);
	};

	// Upload file to conversation
	const uploadFile = async (file) => {
		if (!currentConversationId) {
			toast({
				title: "Error",
				description: "Please start a conversation first",
				variant: "destructive",
			});
			return;
		}

		try {
			setIsUploadingDocument(true);
			setUploadError(null);

			const response = await ApiService.uploadDocumentToConversation(
				currentConversationId,
				file
			);

			// Reload documents to get the updated list
			await loadConversationDocuments(currentConversationId);

			toast({
				title: "Success",
				description: `${file.name} uploaded successfully`,
				variant: "default",
			});
		} catch (error) {
			console.error("Failed to upload document:", error);
			setUploadError(error.message);
			toast({
				title: "Upload Failed",
				description: error.message || "Failed to upload document",
				variant: "destructive",
			});
		} finally {
			setIsUploadingDocument(false);
		}
	};

	// Delete document
	const handleDeleteDocument = async (documentId, documentName) => {
		if (!documentId) return;

		try {
			await ApiService.deleteDocument(documentId);

			// Update local state to remove the deleted document
			setDocuments((prevDocuments) => prevDocuments.filter((doc) => doc.id !== documentId));

			toast({
				title: "Success",
				description: `${documentName} deleted successfully`,
				variant: "default",
			});
		} catch (error) {
			console.error("Failed to delete document:", error);
			toast({
				title: "Error",
				description: "Failed to delete document",
				variant: "destructive",
			});
		}
	};

	const loadAvailableTools = async () => {
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

	const loadConversationHistory = async (conversationId) => {
		try {
			setIsLoadingHistory(true);
			const response = await ApiService.getConversationHistory(conversationId);

			// Handle different response formats
			let historyMessages = [];
			if (Array.isArray(response)) {
				historyMessages = response;
			} else if (response && Array.isArray(response.history)) {
				historyMessages = response.history;
			} else {
				console.warn("Unexpected history response format:", response);
				historyMessages = [];
			}

			// Transform messages to match our format
			const transformedMessages = historyMessages.map((msg) => ({
				id: msg.id || uuidv4(),
				role: msg.role,
				content: msg.content,
				timestamp: msg.timestamp || new Date().toISOString(),
				model: msg.model,
			}));

			setMessages(transformedMessages);
		} catch (error) {
			console.error("Failed to load conversation history:", error);
			setMessages([]);
		} finally {
			setIsLoadingHistory(false);
		}
	};

	const handleSendMessage = async (e) => {
		e.preventDefault();

		if (!inputMessage.trim() || !selectedModel || isStreaming) {
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
			model: selectedModel,
		};

		setMessages((prev) => [...prev, userMessage, assistantMessage]);
		setInputMessage("");
		setIsStreaming(true);

		// Create a new AbortController for this request
		abortControllerRef.current = new AbortController();
		let conversationIdFromResponse = null;

		try {
			// Create the chat request data with conversation ID if available
			const chatData = {
				prompt: userMessage.content,
				model: selectedModel,
				conversation_id: currentConversationId || null,
				tools: selectedTools.length > 0 ? selectedTools : undefined,
			};

			console.log("Sending chat request:", JSON.stringify(chatData));
			console.log("Current conversation ID:", currentConversationId);

			const response = await ApiService.chatStream(chatData);

			// Log all headers to debug
			console.log("Response status:", response.status);
			response.headers.forEach((value, key) => {
				console.log(`Response header: ${key} = ${value}`);
			});

			// Get conversation ID from headers
			conversationIdFromResponse = response.headers.get("x-conversation-id");
			console.log("X-Conversation-ID from response:", conversationIdFromResponse);

			// Store the ID locally first, don't call onSelectConversation yet
			let newConversationId = null;
			if (conversationIdFromResponse && !currentConversationId) {
				console.log("Setting new conversation ID:", conversationIdFromResponse);
				newConversationId = conversationIdFromResponse;
				// We'll call onSelectConversation AFTER streaming is complete
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let streamedContent = "";

			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				if (abortControllerRef.current?.signal.aborted) {
					break;
				}

				const chunk = decoder.decode(value);

				// Try to handle different streaming formats
				if (chunk.includes("data: ")) {
					// SSE format with "data: " prefix
					const lines = chunk.split("\n");

					for (const line of lines) {
						if (line.startsWith("data: ")) {
							const data = line.slice(6);
							if (data === "[DONE]") {
								break;
							}

							try {
								const parsed = JSON.parse(data);
								if (parsed.content) {
									streamedContent += parsed.content;
								} else if (parsed.choices && parsed.choices[0]?.delta?.content) {
									// Handle OpenAI-like format
									streamedContent += parsed.choices[0].delta.content;
								} else if (parsed.text || parsed.message) {
									// Handle other common formats
									streamedContent += parsed.text || parsed.message;
								}
							} catch (err) {
								// Handle non-JSON chunks (plain text streaming)
								if (data.trim()) {
									streamedContent += data;
								}
							}
						}
					}
				} else {
					// Plain text streaming without "data: " prefix
					if (chunk.trim()) {
						try {
							// Try parsing as JSON first
							const parsed = JSON.parse(chunk);
							if (parsed.content) {
								streamedContent += parsed.content;
							} else if (parsed.choices && parsed.choices[0]?.delta?.content) {
								streamedContent += parsed.choices[0].delta.content;
							} else if (parsed.text || parsed.message) {
								streamedContent += parsed.text || parsed.message;
							}
						} catch (err) {
							// If not JSON, treat as plain text
							streamedContent += chunk;
						}
					}
				}

				// Update UI with the current accumulated content
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantMessage.id ? { ...msg, content: streamedContent } : msg
					)
				);
			}
		} catch (error) {
			console.error("Error in chat stream:", error);

			// Update the assistant message to show the error
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessage.id
						? { ...msg, content: `Error: ${error.message}`, isStreaming: false }
						: msg
				)
			);
		} finally {
			// Important: Make sure to check if the current conversation ID is set
			console.log("Final conversation ID after request:", currentConversationId);
			setIsStreaming(false);

			// Update the assistant message to mark streaming as complete
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessage.id ? { ...msg, isStreaming: false } : msg
				)
			);

			// NOW update the conversation ID after streaming is complete
			if (conversationIdFromResponse) {
				setTimeout(() => {
					onSelectConversation(conversationIdFromResponse);

					// Load documents for the new conversation
					if (!currentConversationId) {
						loadConversationDocuments(conversationIdFromResponse);
					}
				}, 100);
			}
			console.log("Streaming complete, conversation ID set:", conversationIdFromResponse);
		}
	};

	const handleStopStreaming = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			setIsStreaming(false);

			// Mark the last assistant message as complete
			setMessages((prev) =>
				prev.map((msg, index) => {
					if (index === prev.length - 1 && msg.role === "assistant" && msg.isStreaming) {
						return { ...msg, isStreaming: false };
					}
					return msg;
				})
			);
		}
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

	const getToolDisplayName = (tool) => {
		if (typeof tool === "string") return tool;
		return tool.display_name || tool.name || tool.id || "Unknown Tool";
	};

	const getToolValue = (tool) => {
		if (typeof tool === "string") return tool;
		return tool.name || tool.id || tool.display_name;
	};

	const formatTimestamp = (timestamp) => {
		try {
			return new Date(timestamp).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return "";
		}
	};

	const getModelDisplayName = () => {
		if (!selectedModel) return "No model selected";

		// If selectedModel contains "/", split it and show provider - model
		if (selectedModel.includes("/")) {
			const [provider, model] = selectedModel.split("/");
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
						{/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
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
                        </div> */}
					</div>
				</div>
			)}

			{/* Chat Messages */}
			{(currentConversationId || messages.length > 0) && (
				<div className="flex-1 overflow-hidden">
					<ScrollArea className="h-full">
						<div className="p-4 space-y-4 pb-32">
							{isLoadingHistory ? (
								<div className="text-center py-8">
									<Loader2 className="h-6 w-6 animate-spin mx-auto" />
									<p className="mt-2 text-gray-600 dark:text-gray-400">
										Loading conversation...
									</p>
								</div>
							) : (
								messages.map((message) => {
									// console.log(
									// 	"Rendering message:",
									// 	message.id,
									// 	message.content,
									// 	message.isStreaming
									// );
									return (
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
														: "bg-neutral-100 dark:bg-neutral-800"
												}`}>
												{message.role === "user" ? (
													<p className="text-sm">{message.content}</p>
												) : (
													<div className="prose prose-sm max-w-none dark:prose-invert text-gray-900 dark:text-gray-100">
														{/* Apply ReactMarkdown for both streaming and complete messages */}
														<div className="relative">
															<ReactMarkdown
																remarkPlugins={[
																	remarkGfm,
																	remarkBreaks,
																	remarkFrontmatter,
																	remarkMath,
																	[
																		remarkWikiLink,
																		{
																			pageResolver: (
																				name
																			) => [
																				name
																					.replace(
																						/ /g,
																						"-"
																					)
																					.toLowerCase(),
																			],
																			hrefTemplate: (
																				permalink
																			) => `#${permalink}`,
																		},
																	],
																]}
																rehypePlugins={[
																	rehypeRaw, // This enables HTML parsing
																	rehypeHighlight,
																	rehypeKatex,
																	[
																		rehypeSanitize,
																		{
																			// Allow HTML tags while sanitizing dangerous content
																			allowDangerousHtml: false,
																			tagNames: [
																				// Standard HTML tags
																				"div",
																				"span",
																				"p",
																				"br",
																				"hr",
																				"h1",
																				"h2",
																				"h3",
																				"h4",
																				"h5",
																				"h6",
																				"strong",
																				"em",
																				"u",
																				"i",
																				"b",
																				"s",
																				"del",
																				"ins",
																				"ul",
																				"ol",
																				"li",
																				"dl",
																				"dt",
																				"dd",
																				"table",
																				"thead",
																				"tbody",
																				"tfoot",
																				"tr",
																				"th",
																				"td",
																				"blockquote",
																				"pre",
																				"code",
																				"a",
																				"img",
																				"sub",
																				"sup",
																				"details",
																				"summary",
																				"mark",
																				"small",
																				// Allow custom elements
																				"section",
																				"article",
																				"aside",
																				"nav",
																				"header",
																				"footer",
																				"main",
																			],
																			attributes: {
																				"*": [
																					"className",
																					"style",
																					"id",
																				],
																				a: [
																					"href",
																					"title",
																					"target",
																					"rel",
																				],
																				img: [
																					"src",
																					"alt",
																					"title",
																					"width",
																					"height",
																				],
																				td: [
																					"colSpan",
																					"rowSpan",
																				],
																				th: [
																					"colSpan",
																					"rowSpan",
																				],
																				details: ["open"],
																			},
																		},
																	],
																]}
																components={{
																	// Enhanced code block handling
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
																			<pre className="rounded-md overflow-x-auto bg-gray-900 p-4">
																				<code
																					className={`${className} text-sm`}
																					{...props}>
																					{children}
																				</code>
																			</pre>
																		) : (
																			<code
																				className="px-1 py-0.5 rounded text-sm bg-gray-200 dark:bg-gray-700"
																				{...props}>
																				{children}
																			</code>
																		);
																	},
																	// Enhanced table styling
																	table: ({
																		children,
																		...props
																	}) => (
																		<div className="overflow-x-auto my-4">
																			<table
																				className="min-w-full border border-gray-300 dark:border-gray-600"
																				{...props}>
																				{children}
																			</table>
																		</div>
																	),
																	th: ({
																		children,
																		...props
																	}) => (
																		<th
																			className="border border-gray-300 dark:border-gray-600 px-4 py-2 bg-gray-100 dark:bg-gray-800 font-semibold text-left"
																			{...props}>
																			{children}
																		</th>
																	),
																	td: ({
																		children,
																		...props
																	}) => (
																		<td
																			className="border border-gray-300 dark:border-gray-600 px-4 py-2"
																			{...props}>
																			{children}
																		</td>
																	),
																	// Enhanced blockquote styling
																	blockquote: ({
																		children,
																		...props
																	}) => (
																		<blockquote
																			className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic text-gray-700 dark:text-gray-300"
																			{...props}>
																			{children}
																		</blockquote>
																	),
																	// Enhanced link styling
																	a: ({
																		children,
																		href,
																		...props
																	}) => (
																		<a
																			href={href}
																			className="text-blue-600 dark:text-blue-400 hover:underline"
																			target={
																				href?.startsWith(
																					"http"
																				)
																					? "_blank"
																					: undefined
																			}
																			rel={
																				href?.startsWith(
																					"http"
																				)
																					? "noopener noreferrer"
																					: undefined
																			}
																			{...props}>
																			{children}
																		</a>
																	),
																	// Enhanced image styling
																	img: ({
																		src,
																		alt,
																		...props
																	}) => (
																		<img
																			src={src}
																			alt={alt}
																			className="max-w-full h-auto rounded-md my-2"
																			{...props}
																		/>
																	),
																	// Task list styling
																	input: ({
																		type,
																		checked,
																		...props
																	}) => {
																		if (type === "checkbox") {
																			return (
																				<input
																					type="checkbox"
																					checked={
																						checked
																					}
																					disabled
																					className="mr-2"
																					{...props}
																				/>
																			);
																		}
																		return (
																			<input
																				type={type}
																				{...props}
																			/>
																		);
																	},
																	// Enhanced heading styling
																	h1: ({
																		children,
																		...props
																	}) => (
																		<h1
																			className="text-2xl font-bold mt-6 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2"
																			{...props}>
																			{children}
																		</h1>
																	),
																	h2: ({
																		children,
																		...props
																	}) => (
																		<h2
																			className="text-xl font-semibold mt-5 mb-3 border-b border-gray-200 dark:border-gray-700 pb-1"
																			{...props}>
																			{children}
																		</h2>
																	),
																	h3: ({
																		children,
																		...props
																	}) => (
																		<h3
																			className="text-lg font-semibold mt-4 mb-2"
																			{...props}>
																			{children}
																		</h3>
																	),
																	h4: ({
																		children,
																		...props
																	}) => (
																		<h4
																			className="text-base font-semibold mt-3 mb-2"
																			{...props}>
																			{children}
																		</h4>
																	),
																	h5: ({
																		children,
																		...props
																	}) => (
																		<h5
																			className="text-sm font-semibold mt-3 mb-2"
																			{...props}>
																			{children}
																		</h5>
																	),
																	h6: ({
																		children,
																		...props
																	}) => (
																		<h6
																			className="text-xs font-semibold mt-3 mb-2"
																			{...props}>
																			{children}
																		</h6>
																	),
																	// Enhanced list styling
																	ul: ({
																		children,
																		...props
																	}) => (
																		<ul
																			className="list-disc list-inside my-2 ml-4"
																			{...props}>
																			{children}
																		</ul>
																	),
																	ol: ({
																		children,
																		...props
																	}) => (
																		<ol
																			className="list-decimal list-inside my-2 ml-4"
																			{...props}>
																			{children}
																		</ol>
																	),
																	li: ({
																		children,
																		...props
																	}) => (
																		<li
																			className="my-1"
																			{...props}>
																			{children}
																		</li>
																	),
																	// Details/Summary for collapsible content
																	details: ({
																		children,
																		...props
																	}) => (
																		<details
																			className="my-4 border border-gray-300 dark:border-gray-600 rounded-md"
																			{...props}>
																			{children}
																		</details>
																	),
																	summary: ({
																		children,
																		...props
																	}) => (
																		<summary
																			className="px-4 py-2 bg-gray-100 dark:bg-gray-800 cursor-pointer font-semibold"
																			{...props}>
																			{children}
																		</summary>
																	),
																	// Horizontal rule styling
																	hr: (props) => (
																		<hr
																			className="my-6 border-gray-300 dark:border-gray-600"
																			{...props}
																		/>
																	),
																}}>
																{message.content}
															</ReactMarkdown>
															{/* Show typing indicator only during streaming */}
															{message.isStreaming && (
																<span className="inline-block w-2 h-4 bg-neutral-400 animate-pulse ml-1" />
															)}
														</div>
													</div>
												)}

												<div className="text-xs opacity-70 mt-1">
													{formatTimestamp(message.timestamp)}
												</div>
											</div>

											{message.role === "user" && (
												<div className="flex-shrink-0">
													<div className="w-8 h-8 rounded-full bg-neutral-500 flex items-center justify-center">
														<User className="h-4 w-4 text-white" />
													</div>
												</div>
											)}
										</div>
									);
								})
							)}
							<div ref={messagesEndRef} />
						</div>
					</ScrollArea>
				</div>
			)}

			<Separator />

			{/* Input Area */}
			<div className="fixed bottom-4 left-1/2 transform -translate-x-2/5 p-4 bg-neutral-900/80 backdrop-blur-lm w-7/12 rounded-lg border border-neutral-700/50 shadow-2xl">
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
										className="cursor-pointer transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
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

				{/* Uploaded Documents */}
				{documents.length > 0 && (
					<div className="mb-4">
						<div className="flex items-center gap-2 mb-2">
							<FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
							<span className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Uploaded Documents:
							</span>
							{isLoadingDocuments && <Loader2 className="h-3 w-3 animate-spin" />}
						</div>
						<div className="flex flex-wrap gap-2">
							{documents.map((doc) => (
								<div
									key={doc.id}
									className="flex items-center gap-1 bg-neutral-800 text-neutral-200 text-xs px-2 py-1 rounded-md">
									<File className="h-3 w-3" />
									<span className="max-w-[120px] truncate">{doc.filename}</span>
									<button
										className="text-neutral-400 hover:text-red-500 transition-colors"
										onClick={() => handleDeleteDocument(doc.id, doc.filename)}
										title="Delete document">
										<Trash2 className="h-3 w-3" />
									</button>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Upload error message */}
				{uploadError && <div className="mb-4 text-red-500 text-xs">{uploadError}</div>}

				{/* Message Input */}
				<form onSubmit={handleSendMessage} className="flex gap-2 items-end">
					<div className="flex-1">
						<Input
							value={inputMessage}
							onChange={(e) => setInputMessage(e.target.value)}
							placeholder={`Message ${getModelDisplayName()}...`}
							disabled={isStreaming}
							className="resize-none"
							autoFocus
						/>
					</div>

					{isStreaming ? (
						<Button
							type="button"
							onClick={handleStopStreaming}
							variant="outline"
							size="sm">
							<StopCircle className="h-4 w-4" />
						</Button>
					) : (
						<Button
							type="submit"
							disabled={!inputMessage.trim() || !selectedModel}
							size="sm">
							<Send className="h-4 w-4" />
						</Button>
					)}

					{/* File upload button */}
					<Button
						type="button"
						onClick={handleFileButtonClick}
						variant="outline"
						size="sm"
						disabled={isStreaming}
						className="flex-shrink-0">
						<Paperclip className="h-4 w-4" />
					</Button>

					{/* Hidden file input */}
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFileChange}
						className="hidden"
						accept=".txt,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.bmp,.svg,.zip,.rar"
					/>
				</form>
			</div>
		</div>
	);
};

export default ChatCanvas;
