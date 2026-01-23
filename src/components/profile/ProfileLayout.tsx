import type { Did } from "@atcute/lexicons";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { didDocumentQueryOptions, extractHandle } from "@/lib/did-to-handle";
import {
	getProfileQueryOptions,
	useUpdateProfileMutation,
} from "@/lib/profile-queries";
import { useAuth } from "@/lib/useAuth";

interface DoHResponse {
	Answer?: { type: number; data: string }[];
}

async function requireDnsRecord(
	handle: string,
	type: "A" | "AAAA" | "CNAME",
): Promise<true> {
	const response = await fetch(
		`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(handle)}&type=${type}`,
		{ headers: { Accept: "application/dns-json" } },
	);
	if (!response.ok) throw new Error("DNS query failed");
	const data: DoHResponse = await response.json();
	if ((data.Answer?.length ?? 0) === 0) throw new Error("No records");
	return true;
}

export const domainResolvesQueryOptions = (handle: string | null) =>
	queryOptions({
		queryKey: ["domain-resolves", handle] as const,
		queryFn: async (): Promise<boolean> => {
			if (!handle) return false;
			try {
				await Promise.any([
					requireDnsRecord(handle, "A"),
					requireDnsRecord(handle, "AAAA"),
					requireDnsRecord(handle, "CNAME"),
				]);
				return true;
			} catch {
				return false;
			}
		},
		staleTime: 10 * 60 * 1000, // 10 minutes
	});

interface ProfileLayoutProps {
	did: string;
	children: React.ReactNode;
}

export function ProfileLayout({ did, children }: ProfileLayoutProps) {
	const { session } = useAuth();
	const { data: didDocument } = useQuery(didDocumentQueryOptions(did as Did));
	const { data: profileData } = useQuery(getProfileQueryOptions(did as Did));
	const updateProfileMutation = useUpdateProfileMutation();

	const handle = extractHandle(didDocument ?? null);
	const { data: domainResolves } = useQuery(domainResolvesQueryOptions(handle));
	const isOwner = session?.info.sub === did;

	return (
		<div className="min-h-screen bg-white dark:bg-zinc-900">
			<div className="max-w-7xl mx-auto px-6 py-16">
				{/* Profile Header */}
				<ProfileHeader
					profile={profileData?.profile ?? null}
					handle={handle}
					did={did}
					isOwner={isOwner}
					onUpdate={(profile) => updateProfileMutation.mutate(profile)}
					isSaving={updateProfileMutation.isPending}
					showHandleLink={domainResolves ?? false}
				/>

				{/* Tab Navigation */}
				<nav className="flex border-b border-gray-200 dark:border-zinc-600 mb-6">
					<Link
						to="/profile/$did"
						params={{ did }}
						activeOptions={{ exact: true }}
						className="px-4 py-2 font-medium text-sm border-b-2 transition-colors text-gray-500 dark:text-zinc-300 hover:text-gray-700 dark:hover:text-zinc-300 border-transparent hover:border-gray-300 dark:hover:border-zinc-600 [&.active]:border-cyan-500 [&.active]:text-cyan-700 dark:[&.active]:text-cyan-400"
					>
						Decks
					</Link>
					<Link
						to="/profile/$did/lists"
						params={{ did }}
						className="px-4 py-2 font-medium text-sm border-b-2 transition-colors text-gray-500 dark:text-zinc-300 hover:text-gray-700 dark:hover:text-zinc-300 border-transparent hover:border-gray-300 dark:hover:border-zinc-600 [&.active]:border-cyan-500 [&.active]:text-cyan-700 dark:[&.active]:text-cyan-400"
					>
						Lists
					</Link>
				</nav>

				{/* Tab content */}
				{children}
			</div>
		</div>
	);
}
