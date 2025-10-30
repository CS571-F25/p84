import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useId, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/signin")({
	component: SignIn,
});

function SignIn() {
	const [handle, setHandle] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const { signIn, session } = useAuth();
	const navigate = useNavigate();
	const handleId = useId();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (handle.trim() && !isLoading) {
			setIsLoading(true);
			try {
				await signIn(handle.trim());
			} catch (error) {
				console.error("Sign in error:", error);
				setIsLoading(false);
			}
		}
	};

	if (session) {
		navigate({ to: "/" });
		return null;
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900 p-4">
			<div className="max-w-md w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg shadow-lg p-8">
				<div className="flex items-center justify-center mb-6">
					<div className="p-3 bg-cyan-600 rounded-full">
						<LogIn size={32} className="text-white" />
					</div>
				</div>
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-2">
					Sign In
				</h1>
				<p className="text-gray-600 dark:text-gray-400 text-center mb-8">
					Sign in with an Atmosphere account to continue
				</p>

				<div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
					<p className="text-sm text-gray-700 dark:text-gray-300">
						For example, if you have a Bluesky account, enter the handle of that account!
						You'll use that same identity and handle on Deckbelcher.
						Bluesky and Deckbelcher are both built on AT Protocol—there's a whole Atmosphere of other apps that can interact.
					</p>
				</div>

				<form onSubmit={handleSubmit}>
					<label
						htmlFor={handleId}
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
					>
						Handle
					</label>
					<input
						id={handleId}
						type="text"
						value={handle}
						onChange={(e) => setHandle(e.target.value)}
						placeholder="alice.bsky.social"
						className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-600 mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={isLoading}
						required
					/>
					<button
						type="submit"
						disabled={isLoading}
						className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg flex items-center justify-center gap-2"
					>
						{isLoading ? (
							<>
								<div className="inline-block h-5 w-5 animate-spin rounded-full border-3 border-solid border-white border-r-transparent" />
								<span>Signing in...</span>
							</>
						) : (
							"Continue"
						)}
					</button>
				</form>
			</div>
		</div>
	);
}
