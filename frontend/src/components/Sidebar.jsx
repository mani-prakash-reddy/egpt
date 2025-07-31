import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import { ApiService } from "@/apis/apiService";

const Sidebar = ({ onNewChat, onSelectConversation, currentConversationId, refreshTrigger }) => {
	const [conversations, setConversations] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		loadConversations();
	}, []);

	// Refresh conversations when refreshTrigger changes
	useEffect(() => {
		if (refreshTrigger) {
			loadConversations();
		}
	}, [refreshTrigger]);

	const loadConversations = async () => {
		try {
			setIsLoading(true);
			const response = await ApiService.getUserConversations();

			// Ensure response is always an array
			if (Array.isArray(response)) {
				setConversations(response);
			} else if (response && Array.isArray(response.conversations)) {
				setConversations(response.conversations);
			} else {
				console.warn("API response is not an array:", response);
				setConversations([]);
			}
		} catch (error) {
			console.error("Failed to load conversations:", error);
			setConversations([]);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDeleteConversation = async (conversationId, e) => {
		e.stopPropagation(); // Prevent selecting the conversation

		try {
			await ApiService.deleteConversation(conversationId);
			setConversations((prev) => {
				// Ensure prev is an array before filtering
				if (!Array.isArray(prev)) {
					console.warn("Previous conversations state is not an array:", prev);
					return [];
				}
				return prev.filter(
					(conv) => conv && (conv.conversation_id || conv.id) !== conversationId
				);
			});

			// If we deleted the current conversation, trigger new chat
			if (currentConversationId === conversationId) {
				onNewChat();
			}
		} catch (error) {
			console.error("Failed to delete conversation:", error);
		}
	};

	const formatConversationTitle = (conversation) => {
		// Use the title from API response first
		if (conversation.title && conversation.title.trim()) {
			return conversation.title.length > 30
				? conversation.title.substring(0, 30) + "..."
				: conversation.title;
		}
		// Fallback to first message if no title
		if (conversation.messages && conversation.messages.length > 0) {
			const firstMessage = conversation.messages[0].content;
			return firstMessage.length > 30 ? firstMessage.substring(0, 30) + "..." : firstMessage;
		}
		return "New Conversation";
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffInHours = (now - date) / (1000 * 60 * 60);

		if (diffInHours < 24) {
			return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		} else if (diffInHours < 24 * 7) {
			return date.toLocaleDateString([], { weekday: "short" });
		} else {
			return date.toLocaleDateString([], { month: "short", day: "numeric" });
		}
	};

	return (
		<div className="w-64 bg-gray-50 dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 flex flex-col h-full">
			{/* New Chat Button */}
			<div className="p-4">
				<Button
					onClick={onNewChat}
					className="w-full justify-start gap-2 bg-blue-500 text-white hover:bg-blue-600 transition-colors dark:bg-zinc-700 dark:hover:bg-zinc-600"
					variant="outline">
					<Plus className="h-4 w-4" />
					New Chat
				</Button>
			</div>

			<Separator />

			{/* Conversations List */}
			<div className="flex-1 overflow-hidden">
				<ScrollArea className="h-full">
					<div className="p-2">
						{isLoading ? (
							<div className="space-y-2">
								{[...Array(5)].map((_, i) => (
									<div
										key={i}
										className="h-12 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"
									/>
								))}
							</div>
						) : !Array.isArray(conversations) || conversations.length === 0 ? (
							<div className="text-center text-gray-500 dark:text-gray-400 mt-8">
								<MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
								<p className="text-sm">No conversations yet</p>
								<p className="text-xs opacity-75">Start a new chat to get going</p>
							</div>
						) : (
							<div className="space-y-1">
								{conversations.map((conversation) => (
									<div
										key={conversation.conversation_id || conversation.id}
										className={`group relative flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
											currentConversationId ===
											(conversation.conversation_id || conversation.id)
												? "bg-gray-100 dark:bg-gray-800 border-l-2 border-blue-500"
												: ""
										}`}
										onClick={() =>
											onSelectConversation(
												conversation.conversation_id || conversation.id
											)
										}>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
												<div className="min-w-0 flex-1">
													<p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
														{formatConversationTitle(conversation)}
													</p>
													{conversation.updated_at && (
														<p className="text-xs text-gray-500 dark:text-gray-400">
															{formatDate(conversation.updated_at)}
														</p>
													)}
												</div>
											</div>
										</div>

										{/* Delete Button */}
										<Button
											variant="ghost"
											size="sm"
											className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 text-gray-400 hover:text-red-500"
											onClick={(e) =>
												handleDeleteConversation(
													conversation.conversation_id || conversation.id,
													e
												)
											}>
											<Trash2 className="h-3 w-3" />
										</Button>
									</div>
								))}
							</div>
						)}
					</div>
				</ScrollArea>
			</div>
		</div>
	);
};

export default Sidebar;
