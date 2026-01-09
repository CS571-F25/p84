import {
	InputRule,
	inputRules,
	textblockTypeInputRule,
	wrappingInputRule,
} from "prosemirror-inputrules";
import type { MarkType, NodeType, Schema } from "prosemirror-model";

/**
 * Build input rules for markdown-style shortcuts
 */
export function buildInputRules(schema: Schema) {
	const rules: InputRule[] = [];

	// Bold: **text**
	// Lookbehind ensures we don't match inside an existing bold sequence
	// Pattern: not-star or line-start, then **, content, **
	if (schema.marks.strong) {
		rules.push(
			markInputRule(/(?:^|[^*])(\*\*([^*]+)\*\*)$/, schema.marks.strong, 2),
		);
	}

	// Italic: *text*
	// Must not be preceded by * (would be bold) or followed by * (incomplete bold)
	if (schema.marks.em) {
		rules.push(markInputRule(/(?:^|[^*])(\*([^*]+)\*)$/, schema.marks.em, 2));
	}

	// Inline code: `text`
	if (schema.marks.code) {
		rules.push(markInputRule(/(?:^|[^`])(`([^`]+)`)$/, schema.marks.code, 2));
	}

	// Code block: ``` at start of line
	if (schema.nodes.code_block) {
		rules.push(
			textblockTypeInputRule(/^```$/, schema.nodes.code_block as NodeType),
		);
	}

	// Blockquote: > at start of line
	if (schema.nodes.blockquote) {
		rules.push(
			wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote as NodeType),
		);
	}

	// Heading: # at start of line (levels 1-6)
	if (schema.nodes.heading) {
		for (let level = 1; level <= 6; level++) {
			const pattern = new RegExp(`^(#{${level}})\\s$`);
			rules.push(
				textblockTypeInputRule(pattern, schema.nodes.heading as NodeType, {
					level,
				}),
			);
		}
	}

	return inputRules({ rules });
}

/**
 * Create an input rule that applies a mark when a pattern matches.
 *
 * Based on the standard pattern from:
 * https://discuss.prosemirror.net/t/input-rules-for-wrapping-marks/537
 *
 * @param pattern - Regex with capture groups: group 1 = full match to delete,
 *                  group `textGroup` = the text to keep and mark
 * @param markType - The mark type to apply
 * @param textGroup - Which capture group contains the text (default 1)
 */
function markInputRule(
	pattern: RegExp,
	markType: MarkType,
	textGroup = 1,
): InputRule {
	return new InputRule(pattern, (state, match, start, _end) => {
		const fullMatch = match[1];
		const text = match[textGroup];
		if (!fullMatch || !text) return null;

		const tr = state.tr;

		// Calculate where the full match (including delimiters) starts
		const matchStart = start + match[0].indexOf(fullMatch);
		const matchEnd = matchStart + fullMatch.length;

		// Delete the matched text (including markers)
		tr.delete(matchStart, matchEnd);

		// Insert the text without markers
		tr.insertText(text, matchStart);

		// Apply the mark to the inserted text
		tr.addMark(matchStart, matchStart + text.length, markType.create());

		// Remove stored mark so next typed text isn't marked
		tr.removeStoredMark(markType);

		return tr;
	});
}
