import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

class ChatErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, errorInfo) {
		console.error("Chat Error Boundary caught an error:", error, errorInfo);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex-1 flex flex-col items-center justify-center p-8">
					<div className="text-center space-y-4 max-w-md">
						<AlertCircle className="h-12 w-12 mx-auto text-red-500" />
						<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
							Something went wrong
						</h2>
						<p className="text-gray-600 dark:text-gray-400">
							The chat interface encountered an error. Please try refreshing or
							contact support if the problem persists.
						</p>
						<div className="space-y-2">
							<Button onClick={this.handleReset} className="w-full">
								<RefreshCw className="h-4 w-4 mr-2" />
								Try Again
							</Button>
							<Button
								variant="outline"
								onClick={() => window.location.reload()}
								className="w-full">
								Refresh Page
							</Button>
						</div>
						{process.env.NODE_ENV === "development" && (
							<details className="mt-4 text-left">
								<summary className="cursor-pointer text-sm text-gray-500">
									Error Details (Development)
								</summary>
								<pre className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-auto">
									{this.state.error?.toString()}
								</pre>
							</details>
						)}
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ChatErrorBoundary;
