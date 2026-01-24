import type { Did } from "@atcute/lexicons";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";

interface HandleLinkProps {
	did: Did;
	/** Text to show before the handle (e.g., "by") */
	prefix?: string;
	/** Whether to wrap in a Link to the profile. Default true. */
	link?: boolean;
	/** Additional classes for the link/span */
	className?: string;
}

/**
 * Displays a user's handle with optional link to their profile.
 * Shows skeleton while loading, falls back to DID on error.
 */
export function HandleLink({
	did,
	prefix,
	link = true,
	className,
}: HandleLinkProps) {
	const { data: didDoc, isPending } = useQuery(didDocumentQueryOptions(did));
	const handle = extractHandle(didDoc ?? null);

	const prefixText = prefix ? `${prefix} ` : "";

	// Still loading
	if (isPending) {
		return (
			<>
				{prefixText}
				<span className="inline-block h-4 w-20 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse align-middle" />
			</>
		);
	}

	// Error or no handle found - fall back to DID
	const displayText = handle ? `@${handle}` : did;

	if (link) {
		return (
			<>
				{prefixText}
				<Link
					to="/profile/$did"
					params={{ did }}
					className={
						className ?? "hover:text-cyan-600 dark:hover:text-cyan-400"
					}
				>
					{displayText}
				</Link>
			</>
		);
	}

	return (
		<span className={className}>
			{prefixText}
			{displayText}
		</span>
	);
}
