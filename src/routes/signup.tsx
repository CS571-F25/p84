import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, Info, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { DEFAULT_PDS_HOST, PDS_HOSTS } from "@/lib/pds-hosts";
import { RETURN_TO_KEY, useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/signup")({
	component: SignUp,
	head: () => ({
		meta: [{ title: "Create Account | DeckBelcher" }],
	}),
});

function SignUp() {
	const [selectedPds, setSelectedPds] = useState(DEFAULT_PDS_HOST.url);
	const [customPdsUrl, setCustomPdsUrl] = useState("");
	const [isSigningUp, setIsSigningUp] = useState(false);
	const [showOtherHosts, setShowOtherHosts] = useState(false);
	const [acknowledgedPolicy, setAcknowledgedPolicy] = useState(false);
	const { signUp, session } = useAuth();
	const navigate = useNavigate();
	const customPdsId = useId();

	const otherHosts = PDS_HOSTS.slice(1);
	const selectedHost = PDS_HOSTS.find((h) => h.url === selectedPds);
	const needsAcknowledgment = selectedHost?.learnMoreUrl != null;

	const handleSignUp = async (e: React.FormEvent) => {
		e.preventDefault();
		const pdsUrl = selectedPds === "custom" ? customPdsUrl.trim() : selectedPds;
		if (!pdsUrl || isSigningUp) return;

		setIsSigningUp(true);
		try {
			await signUp(pdsUrl);
		} catch (error) {
			console.error("Sign up error:", error);
			setIsSigningUp(false);
		}
	};

	if (session) {
		const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
		sessionStorage.removeItem(RETURN_TO_KEY);
		navigate({ to: returnTo || "/", replace: true });
		return null;
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-900 px-4 py-8">
			<div className="max-w-md w-full bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg shadow-lg p-8">
				<div className="flex items-center justify-center mb-6">
					<div className="p-3 bg-emerald-600 rounded-full">
						<UserPlus size={32} className="text-white" />
					</div>
				</div>
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-2 font-display">
					Create Account
				</h1>
				<p className="text-gray-600 dark:text-zinc-300 text-center mb-6">
					New to the Atmosphere? Create an account on a PDS host.
				</p>

				<form onSubmit={handleSignUp}>
					{/* Default host - always visible */}
					<label
						className={`block mb-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
							selectedPds === DEFAULT_PDS_HOST.url
								? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
								: "border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800"
						}`}
					>
						<div className="flex items-center gap-3">
							<input
								type="radio"
								name="pds-host"
								value={DEFAULT_PDS_HOST.url}
								checked={selectedPds === DEFAULT_PDS_HOST.url}
								onChange={(e) => {
									setSelectedPds(e.target.value);
									setAcknowledgedPolicy(false);
								}}
								className="text-emerald-600 focus:ring-emerald-500"
							/>
							<div className="flex-1">
								<div className="font-medium text-gray-900 dark:text-white">
									{DEFAULT_PDS_HOST.name}
								</div>
								<div className="text-sm text-gray-600 dark:text-zinc-300">
									{DEFAULT_PDS_HOST.description}
								</div>
							</div>
						</div>
					</label>

					{/* Other hosts - collapsible */}
					<div className="border-t border-gray-200 dark:border-zinc-600 pt-4 mb-4">
						<button
							type="button"
							onClick={() => setShowOtherHosts(!showOtherHosts)}
							className="w-full flex items-center justify-between text-sm text-gray-600 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white"
						>
							<span>Other hosting options</span>
							<ChevronDown
								size={16}
								className={`motion-safe:transition-transform ${showOtherHosts ? "rotate-180" : ""}`}
							/>
						</button>

						{showOtherHosts && (
							<div className="mt-3 space-y-2">
								{otherHosts.map((host) => (
									<label
										key={host.url}
										className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
											selectedPds === host.url
												? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
												: "border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800"
										}`}
									>
										<div className="flex items-center gap-3">
											<input
												type="radio"
												name="pds-host"
												value={host.url}
												checked={selectedPds === host.url}
												onChange={(e) => {
													setSelectedPds(e.target.value);
													setAcknowledgedPolicy(false);
												}}
												className="text-emerald-600 focus:ring-emerald-500"
											/>
											<div className="flex-1">
												<div className="font-medium text-gray-900 dark:text-white">
													{host.name}
												</div>
												<div className="text-sm text-gray-600 dark:text-zinc-300">
													{host.description}
												</div>
											</div>
										</div>
									</label>
								))}
								<label
									className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
										selectedPds === "custom"
											? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
											: "border-gray-300 dark:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800"
									}`}
								>
									<div className="flex items-center gap-3">
										<input
											type="radio"
											name="pds-host"
											value="custom"
											checked={selectedPds === "custom"}
											onChange={(e) => {
												setSelectedPds(e.target.value);
												setAcknowledgedPolicy(false);
											}}
											className="text-emerald-600 focus:ring-emerald-500"
										/>
										<div className="flex-1">
											<div className="font-medium text-gray-900 dark:text-white">
												Other...
											</div>
											<div className="text-sm text-gray-600 dark:text-zinc-300">
												Enter a custom PDS URL
											</div>
										</div>
									</div>
								</label>

								{selectedPds === "custom" && (
									<div className="ml-6 mt-2">
										<label
											htmlFor={customPdsId}
											className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2"
										>
											PDS URL
										</label>
										<input
											id={customPdsId}
											type="url"
											value={customPdsUrl}
											onChange={(e) => setCustomPdsUrl(e.target.value)}
											placeholder="https://pds.example.com"
											className="w-full px-4 py-3 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
											required
										/>
									</div>
								)}
							</div>
						)}
					</div>

					{/* Acknowledgment checkbox for hosts with policy links */}
					{needsAcknowledgment && (
						<label className="flex items-start gap-3 mb-4 p-3 bg-amber-50 dark:bg-zinc-800 border border-amber-200 dark:border-amber-700/50 rounded-lg cursor-pointer">
							<input
								type="checkbox"
								checked={acknowledgedPolicy}
								onChange={(e) => setAcknowledgedPolicy(e.target.checked)}
								className="mt-0.5 text-amber-600 focus:ring-amber-500"
							/>
							<span className="text-sm text-gray-700 dark:text-zinc-300">
								I've read the{" "}
								<a
									href={selectedHost?.learnMoreUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 underline"
									onClick={(e) => e.stopPropagation()}
								>
									handle policy
								</a>{" "}
								and will choose an appropriate handle during signup.
							</span>
						</label>
					)}

					<button
						type="submit"
						disabled={
							isSigningUp ||
							(selectedPds === "custom" && !customPdsUrl.trim()) ||
							(needsAcknowledgment && !acknowledgedPolicy)
						}
						className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-lg flex items-center justify-center gap-2"
					>
						{isSigningUp ? (
							<>
								<div className="inline-block h-5 w-5 animate-spin rounded-full border-3 border-solid border-white border-r-transparent" />
								<span>Redirecting...</span>
							</>
						) : selectedPds === DEFAULT_PDS_HOST.url ? (
							"Create Account"
						) : (
							<>Create Account on {selectedHost?.name || "Custom PDS"}</>
						)}
					</button>
				</form>

				{selectedHost && selectedPds !== "custom" && (
					<div className="mt-4 p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-600 rounded-lg">
						<div className="text-sm text-gray-600 dark:text-zinc-300">
							Available handles on {selectedHost.name}:
						</div>
						<div className="mt-1.5 flex flex-wrap gap-1">
							{selectedHost.handles.map((handle) => (
								<span
									key={handle}
									className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300 rounded-full"
								>
									.{handle}
								</span>
							))}
							<span className="px-2 py-0.5 text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full">
								custom domain
							</span>
						</div>
					</div>
				)}

				<div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex gap-2">
					<Info
						size={16}
						className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
					/>
					<p className="text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
						Each host has its own policies and backup systems. Your data lives
						on the host you choose, but you can migrate later.
						{selectedHost &&
							(selectedHost.tosUrl || selectedHost.privacyUrl) && (
								<>
									{" "}
									Read {selectedHost.name}'s{" "}
									{selectedHost.tosUrl && (
										<a
											href={selectedHost.tosUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 underline"
										>
											terms of service
										</a>
									)}
									{selectedHost.tosUrl && selectedHost.privacyUrl && " and "}
									{selectedHost.privacyUrl && (
										<a
											href={selectedHost.privacyUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 underline"
										>
											privacy policy
										</a>
									)}
									.
								</>
							)}
					</p>
				</div>

				<p className="mt-6 text-center text-gray-600 dark:text-zinc-300">
					Already have an account?{" "}
					<Link
						to="/signin"
						className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium"
					>
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
