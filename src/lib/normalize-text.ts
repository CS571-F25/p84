/**
 * Text normalization for search
 *
 * Strips diacritical marks from text for search matching (ö→o, û→u, etc.)
 *
 * IMPORTANT: This uses the Unicode "Combining Diacritical Marks" block
 * (U+0300-U+036F) which specifically targets Latin script diacritics.
 * Other scripts (Arabic, Hebrew, CJK, Cyrillic) are unaffected.
 *
 * This is appropriate for English MTG card names which may contain borrowed
 * diacritics (Jötun, Lim-Dûl, Dandân). If we ever index non-English printings
 * (using `printed_name`), we'd need to reconsider script handling.
 */

/**
 * Strip diacritical marks from text for search normalization
 */
export function stripDiacritics(text: string): string {
	return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
