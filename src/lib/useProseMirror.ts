import type { Node as ProseMirrorNode } from "prosemirror-model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { schema } from "@/components/richtext/schema";
import { useImperativeDebounce } from "./useDebounce";

/**
 * ProseMirror document JSON (what we store in the lexicon)
 */
export interface PMDocJSON {
	type: "doc";
	content?: PMNodeJSON[];
}

interface PMNodeJSON {
	type: string;
	content?: PMNodeJSON[];
	text?: string;
	marks?: PMMarkJSON[];
	attrs?: Record<string, unknown>;
}

interface PMMarkJSON {
	type: string;
	attrs?: Record<string, unknown>;
}

export interface UseProseMirrorOptions {
	initialDoc?: PMDocJSON;
	onSave?: (doc: PMDocJSON) => void | Promise<void>;
	saveDebounceMs?: number;
}

export interface UseProseMirrorResult {
	doc: ProseMirrorNode;
	docJSON: PMDocJSON;
	onChange: (newDoc: ProseMirrorNode) => void;
	isDirty: boolean;
	save: () => void;
}

function createEmptyDoc(): ProseMirrorNode {
	return schema.node("doc", null, [schema.node("paragraph")]);
}

function docFromJSON(json: PMDocJSON | undefined): ProseMirrorNode {
	if (!json) return createEmptyDoc();
	try {
		return schema.nodeFromJSON(json);
	} catch {
		return createEmptyDoc();
	}
}

function docToJSON(doc: ProseMirrorNode): PMDocJSON {
	return doc.toJSON() as PMDocJSON;
}

/**
 * React hook for managing ProseMirror editor state with debounced autosave.
 *
 * @warn Changing `initialDoc` resets the editor and discards unsaved edits.
 * Only pass a new value when you intend to reset (e.g., loading a different record).
 */
export function useProseMirror({
	initialDoc,
	onSave,
	saveDebounceMs = 1500,
}: UseProseMirrorOptions = {}): UseProseMirrorResult {
	// Track saved state as a node for efficient .eq() comparison
	const savedNodeRef = useRef<ProseMirrorNode>(docFromJSON(initialDoc));
	const onSaveRef = useRef(onSave);
	onSaveRef.current = onSave;

	const [doc, setDoc] = useState<ProseMirrorNode>(() =>
		docFromJSON(initialDoc),
	);
	const [saveState, setSaveState] = useState<"saved" | "dirty">("saved");

	const docJSON = useMemo(() => docToJSON(doc), [doc]);

	const debounce = useImperativeDebounce(
		doc,
		saveDebounceMs,
		(value: ProseMirrorNode) => {
			if (!value.eq(savedNodeRef.current) && onSaveRef.current) {
				onSaveRef.current(docToJSON(value));
				savedNodeRef.current = value;
			}
			setSaveState("saved");
		},
	);

	const onChange = useCallback(
		(newDoc: ProseMirrorNode) => {
			setDoc(newDoc);
			if (!newDoc.eq(savedNodeRef.current)) {
				setSaveState("dirty");
			}
			debounce.update(newDoc);
		},
		[debounce],
	);

	const save = useCallback(() => {
		debounce.flush();
	}, [debounce]);

	useEffect(() => {
		const newNode = docFromJSON(initialDoc);
		setDoc(newNode);
		savedNodeRef.current = newNode;
		setSaveState("saved");
	}, [initialDoc]);

	return {
		doc,
		docJSON,
		onChange,
		isDirty: saveState === "dirty",
		save,
	};
}
