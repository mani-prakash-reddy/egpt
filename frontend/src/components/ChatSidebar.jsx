import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	SidebarContent,
	SidebarHeader,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { ApiService } from "@/apis/apiService";

const ChatSidebar = ({
	onNewChat,
	onSelectConversation,
	currentConversationId,
	refreshTrigger,
}) => {
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
				console.warn("Unexpected response format:", response);
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
		e.stopPropagation();

		if (!window.confirm("Are you sure you want to delete this conversation?")) {
			return;
		}

		try {
			await ApiService.deleteConversation(conversationId);
			await loadConversations();

			// If the deleted conversation was currently selected, clear it
			if (currentConversationId === conversationId) {
				onSelectConversation(null);
			}
		} catch (error) {
			console.error("Failed to delete conversation:", error);
			alert("Failed to delete conversation. Please try again.");
		}
	};

	const formatConversationTitle = (conversation) => {
		if (conversation.title) {
			return conversation.title;
		}

		// Generate a title based on conversation ID or created date
		if (conversation.conversation_id || conversation.id) {
			return `Chat ${(conversation.conversation_id || conversation.id).slice(-8)}`;
		}

		return "Untitled Chat";
	};

	const formatDate = (dateString) => {
		if (!dateString) return "";

		const date = new Date(dateString);
		const now = new Date();
		const diffTime = now - date;
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
		} else if (diffDays === 1) {
			return "Yesterday";
		} else if (diffDays < 7) {
			return date.toLocaleDateString([], { weekday: "short" });
		} else {
			return date.toLocaleDateString([], { month: "short", day: "numeric" });
		}
	};

	return (
		<>
			<SidebarHeader>
				<Button
					onClick={onNewChat}
					className="w-full justify-start gap-2 bg-blue-500 text-white hover:bg-neutral-600 bg-neutral-800 transition-colors"
					size="sm">
					<Plus className="h-4 w-4" />
					New Chat
				</Button>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<ScrollArea className="h-[calc(100vh-120px)]">
							{isLoading ? (
								<div className="space-y-2 p-2">
									{[...Array(5)].map((_, i) => (
										<div
											key={i}
											className="h-12 p-2 bg-neutral-700 rounded-md animate-pulse"
										/>
									))}
								</div>
							) : !Array.isArray(conversations) || conversations.length === 0 ? (
								<div className="text-center text-gray-500 dark:text-gray-400 mt-8 p-4">
									<MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
									<p className="text-sm">No conversations yet</p>
									<p className="text-xs opacity-75">
										Start a new chat to get going
									</p>
								</div>
							) : (
								<SidebarMenu>
									{conversations.map((conversation) => (
										<SidebarMenuItem
											key={conversation.conversation_id || conversation.id}
											className="group relative py-3 border-b border-neutral-700 hover:bg-neutral-800 transition-colors">
											<SidebarMenuButton
												isActive={
													currentConversationId ===
													(conversation.conversation_id ||
														conversation.id)
												}
												onClick={() =>
													onSelectConversation(
														conversation.conversation_id ||
															conversation.id
													)
												}
												className="w-full ">
												<div className="flex items-center gap-2 flex-1 min-w-0">
													<MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
													<div className="min-w-0 flex-1">
														<p className="text-sm font-medium truncate">
															{formatConversationTitle(conversation)}
														</p>
														{conversation.updated_at && (
															<p className="text-xs text-muted-foreground">
																{formatDate(
																	conversation.updated_at
																)}
															</p>
															
														)}
													</div>
												</div>
											</SidebarMenuButton>

											<div className="absolute top-1/2 right-2 -translate-y-1/2">
												<Button
													variant="ghost"
													size="sm"
													className="opacity-0 group-hover:opacity-100 transition-opacity p-1 h-6 w-6 text-gray-400 hover:text-red-500"
													onClick={(e) =>
														handleDeleteConversation(
															conversation.conversation_id ||
																conversation.id,
															e
														)
													}>
													<Trash2 className="h-3 w-3" />
												</Button>
											</div>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							)}
						</ScrollArea>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</>
	);
};

export default ChatSidebar;
