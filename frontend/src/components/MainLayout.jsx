import React, { useState } from "react";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import ChatSidebar from "@/components/ChatSidebar";
import ChatHeader from "@/components/ChatHeader";
import ChatCanvas from "@/components/ChatCanvas";

const MainLayout = () => {
	const [selectedModel, setSelectedModel] = useState("");
	const [currentConversationId, setCurrentConversationId] = useState(null);
	const [refreshTrigger, setRefreshTrigger] = useState(0);

	const handleNewChat = () => {
		setCurrentConversationId(null);
		// Trigger refresh of conversations list
		setRefreshTrigger((prev) => prev + 1);
	};

	const handleSelectConversation = (conversationId) => {
		setCurrentConversationId(conversationId);
		// Trigger refresh when a new conversation is created and selected
		if (conversationId && conversationId !== currentConversationId) {
			setRefreshTrigger((prev) => prev + 1);
		}
	};

	const handleModelChange = (model) => {
		setSelectedModel(model);
	};

	return (
		<SidebarProvider>
			<div className="flex h-screen w-full bg-neutral-900 text-white">
				<Sidebar>
					<ChatSidebar
						onNewChat={handleNewChat}
						onSelectConversation={handleSelectConversation}
						currentConversationId={currentConversationId}
						refreshTrigger={refreshTrigger}
					/>
				</Sidebar>

				<SidebarInset>
					<div className="flex h-full flex-col">
						<ChatHeader
							selectedModel={selectedModel}
							onModelChange={handleModelChange}
						/>
						<ChatCanvas
							selectedModel={selectedModel}
							currentConversationId={currentConversationId}
							onNewChat={handleNewChat}
							onSelectConversation={handleSelectConversation}
						/>
					</div>
				</SidebarInset>
			</div>
		</SidebarProvider>
	);
};

export default MainLayout;
