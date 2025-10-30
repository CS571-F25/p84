import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import { useAuth } from "@/lib/useAuth";

export default function UserMenu() {
	const [isOpen, setIsOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const { session, signOut } = useAuth();

	const { data: handle } = useQuery({
		...didDocumentQueryOptions(session?.info.sub),
		enabled: !!session,
		select: extractHandle,
	});

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	if (!session) return null;

	return (
		<div className="relative" ref={menuRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 px-3 py-2 bg-gray-700 dark:bg-gray-800 rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
				aria-label="User menu"
				aria-expanded={isOpen}
			>
				<User size={16} />
				<span className="text-sm">
					{handle ? `@${handle}` : session.info.sub}
				</span>
				<ChevronDown
					size={16}
					className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-50">
					<button
						type="button"
						onClick={() => {
							signOut();
							setIsOpen(false);
						}}
						className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-900 dark:text-white text-sm"
					>
						<LogOut size={16} />
						<span>Sign Out</span>
					</button>
				</div>
			)}
		</div>
	);
}
