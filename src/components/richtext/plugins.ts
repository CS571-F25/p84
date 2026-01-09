import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

/**
 * Plugin that calls a callback on every state update.
 * Used to trigger React re-renders for toolbar state.
 */
export function createUpdatePlugin(onUpdate: (view: EditorView) => void) {
	return new Plugin({
		key: new PluginKey("reactUpdate"),
		view() {
			return {
				update(view) {
					onUpdate(view);
				},
			};
		},
	});
}
