import { ExternalLink, Pencil } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { ProseMirrorEditor } from "@/components/richtext/ProseMirrorEditor";
import { RichtextRenderer } from "@/components/richtext/RichtextRenderer";
import { schema } from "@/components/richtext/schema";
import type { Profile } from "@/lib/profile-queries";
import { lexiconToTree, treeToLexicon } from "@/lib/richtext-convert";
import { type PMDocJSON, useProseMirror } from "@/lib/useProseMirror";

interface ProfileHeaderProps {
	profile: Profile | null;
	handle: string | null;
	did: string;
	isOwner: boolean;
	onUpdate: (profile: Profile) => void;
	isSaving: boolean;
	showHandleLink: boolean;
}

export function ProfileHeader({
	profile,
	handle,
	did,
	isOwner,
	onUpdate,
	isSaving,
	showHandleLink,
}: ProfileHeaderProps) {
	const pronounsId = useId();
	const [isEditing, setIsEditing] = useState(false);
	const [editedPronouns, setEditedPronouns] = useState(profile?.pronouns ?? "");

	const displayHandle = handle ? `@${handle}` : did;

	// Convert lexicon to PM tree for editing
	const initialPMDoc = useMemo(() => {
		if (!profile?.bio) return undefined;
		return lexiconToTree(profile.bio).toJSON();
	}, [profile?.bio]);

	const handleSaveBio = useCallback(
		(pmDocJSON: PMDocJSON) => {
			const pmNode = schema.nodeFromJSON(pmDocJSON);
			const lexicon = treeToLexicon(pmNode);
			onUpdate({
				bio: lexicon,
				pronouns: editedPronouns.trim() || undefined,
				createdAt: profile?.createdAt ?? new Date().toISOString(),
			});
		},
		[onUpdate, editedPronouns, profile?.createdAt],
	);

	const { doc, onChange, isDirty, trigger, save } = useProseMirror({
		initialDoc: initialPMDoc,
		onSave: handleSaveBio,
		saveDebounceMs: 1500,
	});

	const handlePronounsChange = (value: string) => {
		setEditedPronouns(value);
		trigger(); // Schedule debounced save (callback has current pronouns via closure)
	};

	const handleDone = () => {
		save(); // Flush any pending save
		setIsEditing(false);
	};

	const handleStartEdit = () => {
		setEditedPronouns(profile?.pronouns ?? "");
		setIsEditing(true);
	};

	const hasContent =
		profile?.bio?.content?.some((block) => {
			if ("text" in block && block.text) return true;
			if ("items" in block && block.items.length > 0) return true;
			return false;
		}) ?? false;

	const handleUrl = handle ? `https://${handle}` : null;

	if (isEditing) {
		return (
			<div className="mb-8 space-y-4">
				{/* Handle (not editable) */}
				<div className="flex items-center gap-3">
					<h1
						className="text-3xl font-semibold text-gray-900 dark:text-white"
						style={{ fontVariationSettings: "'MONO' 0.5, 'CASL' 0.3" }}
					>
						{displayHandle}
					</h1>
					{showHandleLink && handleUrl && (
						<a
							href={handleUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-gray-400 hover:text-cyan-500 dark:text-zinc-400 dark:hover:text-cyan-400 transition-colors"
							title={`Visit ${handleUrl}`}
						>
							<ExternalLink className="w-6 h-6" />
						</a>
					)}
				</div>

				{/* Pronouns input */}
				<div>
					<label
						htmlFor={pronounsId}
						className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1"
					>
						Pronouns
					</label>
					<input
						id={pronounsId}
						type="text"
						value={editedPronouns}
						onChange={(e) => handlePronounsChange(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleDone();
							}
						}}
						placeholder="e.g. she/her, they/them"
						maxLength={64}
						className="px-3 py-2 w-full max-w-xs bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500"
					/>
				</div>

				{/* Bio editor */}
				<div>
					<span className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
						Bio
					</span>
					<ProseMirrorEditor
						defaultValue={doc}
						onChange={onChange}
						placeholder="Write something about yourself..."
					/>
				</div>

				{/* Save status and done button */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-300">
						{isSaving && <span>Saving...</span>}
						{!isSaving && isDirty && <span>Unsaved changes</span>}
						{!isSaving && !isDirty && hasContent && <span>Saved</span>}
					</div>
					<button
						type="button"
						onClick={handleDone}
						className="px-4 py-2 text-sm font-medium rounded-lg bg-cyan-400 hover:bg-cyan-300 text-gray-900"
					>
						Done
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="mb-8 space-y-2">
			{/* Handle row */}
			<div className="flex items-center gap-3">
				<h1
					className="text-3xl font-semibold text-gray-900 dark:text-white"
					style={{ fontVariationSettings: "'MONO' 0.5, 'CASL' 0.3" }}
				>
					{displayHandle}
				</h1>
				{showHandleLink && handleUrl && (
					<a
						href={handleUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-gray-400 hover:text-cyan-500 dark:text-zinc-400 dark:hover:text-cyan-400 transition-colors"
						title={`Visit ${handleUrl}`}
					>
						<ExternalLink className="w-6 h-6" />
					</a>
				)}
			</div>
			{/* Pronouns */}
			{profile?.pronouns && (
				<p className="text-sm text-gray-500 dark:text-zinc-300">
					{profile.pronouns}
				</p>
			)}

			{/* Bio */}
			{hasContent && profile?.bio && (
				<RichtextRenderer
					doc={profile.bio}
					className="text-gray-700 dark:text-zinc-300"
				/>
			)}

			{/* Edit button for owner */}
			{isOwner && (
				<button
					type="button"
					onClick={handleStartEdit}
					className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300"
				>
					<Pencil className="w-4 h-4" />
					{hasContent || profile?.pronouns ? "Edit profile" : "Add bio"}
				</button>
			)}
		</div>
	);
}
