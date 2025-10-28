import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OracleText } from "./OracleText";

describe("OracleText", () => {
	describe("basic text parsing", () => {
		it("renders plain text without symbols", () => {
			const { container } = render(<OracleText text="Draw a card." />);
			expect(container.textContent).toBe("Draw a card.");
		});

		it("preserves newlines with <br> tags", () => {
			const { container } = render(
				<OracleText text={"First line\nSecond line"} />,
			);
			const brElements = container.querySelectorAll("br");
			expect(brElements).toHaveLength(1);
		});
	});

	describe("mana symbol parsing", () => {
		it("renders single mana symbol", () => {
			const { container } = render(<OracleText text="Add {G} to your mana." />);
			const symbols = container.querySelectorAll("img[alt='G']");
			expect(symbols).toHaveLength(1);
			expect(symbols[0].getAttribute("src")).toBe("/symbols/g.svg");
		});

		it("renders multiple mana symbols", () => {
			const { container } = render(<OracleText text="Pay {2}{U}{B}." />);
			expect(container.querySelectorAll("img[alt='2']")).toHaveLength(1);
			expect(container.querySelectorAll("img[alt='U']")).toHaveLength(1);
			expect(container.querySelectorAll("img[alt='B']")).toHaveLength(1);
		});

		it("renders hybrid mana symbols", () => {
			const { container } = render(<OracleText text="Pay {R/W}." />);
			const symbols = container.querySelectorAll("img[alt='R/W']");
			expect(symbols).toHaveLength(1);
			expect(symbols[0].getAttribute("src")).toBe("/symbols/rw.svg");
		});

		it("uses align-middle class for proper alignment", () => {
			const { container } = render(<OracleText text="Pay {G}." />);
			const symbol = container.querySelector("img");
			expect(symbol?.className).toContain("align-middle");
		});
	});

	describe("reminder text parsing", () => {
		it("renders reminder text in italics", () => {
			const { container } = render(
				<OracleText text="Flying (This creature can't be blocked except by creatures with flying or reach.)" />,
			);
			const italic = container.querySelector("span.italic");
			expect(italic).toBeTruthy();
			expect(italic?.textContent).toContain(
				"This creature can't be blocked except by creatures with flying or reach.",
			);
		});

		it("renders symbols within reminder text (nested braces)", () => {
			const { container } = render(
				<OracleText text="Cycling {2} ({2}, Discard this card: Draw a card.)" />,
			);

			// Check for {2} symbol outside parentheses
			const allSymbols = container.querySelectorAll("img[alt='2']");
			expect(allSymbols.length).toBeGreaterThanOrEqual(2);

			// Check that reminder text is italic
			const italic = container.querySelector("span.italic");
			expect(italic).toBeTruthy();
			expect(italic?.textContent).toContain("Discard this card: Draw a card");

			// Check that symbols are rendered inside italic span
			const symbolsInItalic = italic?.querySelectorAll("img[alt='2']");
			expect(symbolsInItalic?.length).toBeGreaterThanOrEqual(1);
		});

		it("handles reminder text with text before and after", () => {
			const { container } = render(
				<OracleText text="You gain shroud until end of turn. (You can't be the target of spells or abilities.)" />,
			);
			expect(container.textContent).toContain(
				"You gain shroud until end of turn.",
			);
			expect(container.textContent).toContain(
				"You can't be the target of spells or abilities.",
			);
		});
	});

	describe("complex mixed content", () => {
		it("handles text with symbols and reminder text", () => {
			const { container } = render(
				<OracleText
					text={
						"Add {G} or {U}.\nDraw a card (Put a card from the top of your deck into your hand.)"
					}
				/>,
			);

			// Check symbols
			expect(container.querySelectorAll("img[alt='G']")).toHaveLength(1);
			expect(container.querySelectorAll("img[alt='U']")).toHaveLength(1);

			// Check newline
			expect(container.querySelectorAll("br")).toHaveLength(1);

			// Check reminder text
			expect(container.querySelector("span.italic")).toBeTruthy();
		});

		it("handles Gilded Light oracle text correctly", () => {
			const oracleText =
				"You gain shroud until end of turn. (You can't be the target of spells or abilities.)\nCycling {2} ({2}, Discard this card: Draw a card.)";

			const { container } = render(<OracleText text={oracleText} />);

			// Should have two {2} symbols total (one outside parens, one inside each reminder text)
			const symbols = container.querySelectorAll("img[alt='2']");
			expect(symbols.length).toBeGreaterThanOrEqual(2);

			// Should have two italic sections (two reminder texts)
			const italics = container.querySelectorAll("span.italic");
			expect(italics).toHaveLength(2);

			// Should have one newline
			expect(container.querySelectorAll("br")).toHaveLength(1);
		});
	});

	describe("edge cases", () => {
		it("handles empty string", () => {
			const { container } = render(<OracleText text="" />);
			expect(container.textContent).toBe("");
		});

		it("handles unmatched braces as text", () => {
			const { container } = render(<OracleText text="This has {incomplete" />);
			expect(container.textContent).toContain("This has {incomplete");
		});

		it("handles unmatched parentheses as text", () => {
			const { container } = render(<OracleText text="This has (incomplete" />);
			expect(container.textContent).toContain("This has (incomplete");
		});

		it("handles deeply nested parentheses", () => {
			const { container } = render(
				<OracleText text="Outer (inner (nested) text) text." />,
			);
			// The findMatchingParen function should handle this correctly
			expect(container.textContent).toContain("Outer");
			expect(container.textContent).toContain("inner (nested) text");
		});
	});

	describe("custom className", () => {
		it("applies custom className to root span", () => {
			const { container } = render(
				<OracleText text="Test" className="custom-class" />,
			);
			const rootSpan = container.querySelector("span.custom-class");
			expect(rootSpan).toBeTruthy();
		});
	});
});
