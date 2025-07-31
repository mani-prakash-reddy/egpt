import React, { useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import ChatErrorBoundary from "@/components/ChatErrorBoundary";

const MainLayout = ({ children }) => {
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
		<div className="flex h-screen bg-gray-50 dark:bg-zinc-950">
			{/* Sidebar */}
			<Sidebar
				onNewChat={handleNewChat}
				onSelectConversation={handleSelectConversation}
				currentConversationId={currentConversationId}
				refreshTrigger={refreshTrigger}
			/>

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col overflow-hidden">
				{/* Header */}
				<Header selectedModel={selectedModel} onModelChange={handleModelChange} />

				{/* Main Content */}
				<main className="flex-1 overflow-hidden">
					<ChatErrorBoundary>
						{React.cloneElement(children, {
							selectedModel,
							currentConversationId,
							onNewChat: handleNewChat,
							onSelectConversation: handleSelectConversation,
						})}
					</ChatErrorBoundary>
				</main>
			</div>
		</div>
	);
};

export default MainLayout;
