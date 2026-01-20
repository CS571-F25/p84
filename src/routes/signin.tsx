import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { searchActorsQueryOptions } from "@/lib/actor-search";
import { RETURN_TO_KEY, useAuth } from "@/lib/useAuth";

export const Route = createFileRoute("/signin")({
	component: SignIn,
	head: () => ({
		meta: [{ title: "Sign In | DeckBelcher" }],
	}),
});

function SignIn() {
	const [handle, setHandle] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [isFocused, setIsFocused] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const { signIn, session } = useAuth();
	const navigate = useNavigate();
	const handleId = useId();
	const listboxId = useId();
	const dropdownRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

	// Debounce the search query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(handle);
		}, 150);
		return () => clearTimeout(timer);
	}, [handle]);

	const { data: results = [], isFetching } = useQuery({
		...searchActorsQueryOptions(debouncedQuery),
		enabled: debouncedQuery.length >= 2 && isFocused,
	});

	const showDropdown =
		isFocused &&
		debouncedQuery.length >= 2 &&
		results.length > 0 &&
		!(
			results.length === 1 &&
			results[0].handle.toLowerCase() === handle.toLowerCase().trim()
		);

	// Scroll selected option into view
	useEffect(() => {
		if (selectedIndex >= 0 && optionRefs.current[selectedIndex]) {
			optionRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			});
		}
	}, [selectedIndex]);

	// Click outside handler
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				inputRef.current &&
				!inputRef.current.contains(event.target as Node)
			) {
				setIsFocused(false);
			}
		};

		if (isFocused) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isFocused]);

	const selectResult = (selectedHandle: string) => {
		setHandle(selectedHandle);
		setIsFocused(false);
		setSelectedIndex(-1);
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!showDropdown) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setSelectedIndex((prev) =>
					prev < results.length - 1 ? prev + 1 : prev,
				);
				break;
			case "ArrowUp":
				e.preventDefault();
				setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
				break;
			case "Enter":
				if (selectedIndex >= 0) {
					e.preventDefault();
					selectResult(results[selectedIndex].handle);
				}
				break;
			case "Escape":
				e.preventDefault();
				setIsFocused(false);
				setSelectedIndex(-1);
				break;
		}
	};

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
		const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
		sessionStorage.removeItem(RETURN_TO_KEY);
		navigate({ to: returnTo || "/", replace: true });
		return null;
	}

	return (
		<div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900 px-4 py-8">
			<div className="max-w-md w-full bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg shadow-lg p-8">
				<div className="flex items-center justify-center mb-6">
					<div className="p-3 bg-cyan-600 rounded-full">
						<LogIn size={32} className="text-white" />
					</div>
				</div>
				<h1 className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-2 font-display">
					Sign In
				</h1>
				<p className="text-gray-600 dark:text-gray-400 text-center mb-8">
					Sign in with an Atmosphere account to continue
				</p>

				<form onSubmit={handleSubmit}>
					<label
						htmlFor={handleId}
						className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
					>
						Handle
					</label>
					<div className="relative mb-6">
						<input
							ref={inputRef}
							id={handleId}
							type="text"
							value={handle}
							onChange={(e) => {
								setHandle(e.target.value);
								setSelectedIndex(-1);
							}}
							onFocus={() => setIsFocused(true)}
							onKeyDown={handleKeyDown}
							placeholder="alice.bsky.social"
							className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
							disabled={isLoading}
							required
							role="combobox"
							aria-autocomplete="list"
							aria-expanded={showDropdown}
							aria-controls={showDropdown ? listboxId : undefined}
							aria-activedescendant={
								selectedIndex >= 0 ? `${listboxId}-${selectedIndex}` : undefined
							}
						/>
						{showDropdown && (
							<div
								ref={dropdownRef}
								id={listboxId}
								role="listbox"
								aria-labelledby={handleId}
								className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
							>
								{results.map((result, index) => (
									<button
										key={result.did}
										ref={(el) => {
											optionRefs.current[index] = el;
										}}
										type="button"
										id={`${listboxId}-${index}`}
										role="option"
										aria-selected={index === selectedIndex}
										onClick={() => selectResult(result.handle)}
										className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
											index === selectedIndex
												? "bg-cyan-100 dark:bg-cyan-900/30"
												: ""
										}`}
									>
										{result.avatar ? (
											<img
												src={result.avatar}
												alt=""
												className="w-10 h-10 rounded-full"
											/>
										) : (
											<div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600" />
										)}
										<div className="flex-1 min-w-0">
											{result.displayName && (
												<div className="font-medium text-gray-900 dark:text-white truncate">
													{result.displayName}
												</div>
											)}
											<div className="text-sm text-gray-600 dark:text-gray-400 truncate">
												@{result.handle}
											</div>
										</div>
									</button>
								))}
							</div>
						)}
						{isFetching && debouncedQuery.length >= 2 && (
							<div className="absolute right-3 top-3">
								<div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-cyan-600 border-r-transparent" />
							</div>
						)}
						<output className="sr-only" aria-live="polite">
							{showDropdown &&
								`${results.length} ${results.length === 1 ? "result" : "results"} available`}
						</output>
					</div>
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

				<p className="mt-6 text-center text-gray-600 dark:text-gray-400">
					Don't have an account?{" "}
					<Link
						to="/signup"
						className="text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium"
					>
						Create one
					</Link>
				</p>
			</div>
		</div>
	);
}
