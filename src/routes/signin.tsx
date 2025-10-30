import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useId, useState } from "react";
import { useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/signin")({
	component: SignIn,
});

function SignIn() {
	const [handle, setHandle] = useState("");
	const { signIn, session } = useAuth();
	const navigate = useNavigate();
	const handleId = useId();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (handle.trim()) {
			await signIn(handle.trim());
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
					Sign in with your Bluesky account to continue
				</p>
				<form onSubmit={handleSubmit}>
					<label
						htmlFor={handleId}
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
					>
						Bluesky Handle
					</label>
					<input
						id={handleId}
						type="text"
						value={handle}
						onChange={(e) => setHandle(e.target.value)}
						placeholder="alice.bsky.social"
						className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-600 mb-6"
						required
					/>
					<button
						type="submit"
						className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors font-medium text-lg"
					>
						Continue
					</button>
				</form>
			</div>
		</div>
	);
}
