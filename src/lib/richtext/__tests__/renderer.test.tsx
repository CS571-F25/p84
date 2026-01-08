import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "../renderer";
import { BOLD, type Facet, ITALIC } from "../types";

describe("RichText renderer", () => {
	describe("basic rendering", () => {
		it("renders null for empty text", () => {
			const { container } = render(<RichText text="" />);
			expect(container.innerHTML).toBe("");
		});

		it("renders plain text without formatting", () => {
			const { container } = render(<RichText text="hello world" />);
			expect(container.textContent).toBe("hello world");
			expect(container.querySelector("strong")).toBeNull();
			expect(container.querySelector("em")).toBeNull();
		});

		it("applies className to wrapper span", () => {
			const { container } = render(
				<RichText text="test" className="my-class" />,
			);
			expect(container.querySelector("span.my-class")).not.toBeNull();
		});
	});

	describe("bold formatting", () => {
		it("renders bold text", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
			];
			const { container } = render(<RichText text="bold" facets={facets} />);
			expect(container.querySelector("strong")?.textContent).toBe("bold");
		});

		it("renders bold in middle of text", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 6, byteEnd: 11 }, features: [BOLD] },
			];
			const { container } = render(
				<RichText text="hello world there" facets={facets} />,
			);
			expect(container.textContent).toBe("hello world there");
			expect(container.querySelector("strong")?.textContent).toBe("world");
		});
	});

	describe("italic formatting", () => {
		it("renders italic text", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 6 }, features: [ITALIC] },
			];
			const { container } = render(<RichText text="italic" facets={facets} />);
			expect(container.querySelector("em")?.textContent).toBe("italic");
		});
	});

	describe("combined formatting", () => {
		it("renders bold and italic on same range", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
				{ index: { byteStart: 0, byteEnd: 4 }, features: [ITALIC] },
			];
			const { container } = render(<RichText text="both" facets={facets} />);
			const strong = container.querySelector("strong");
			const em = container.querySelector("em");
			expect(strong).not.toBeNull();
			expect(em).not.toBeNull();
			expect(container.textContent).toBe("both");
		});

		it("renders nested formatting", () => {
			// "hello world" with bold on all, italic on "world"
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 11 }, features: [BOLD] },
				{ index: { byteStart: 6, byteEnd: 11 }, features: [ITALIC] },
			];
			const { container } = render(
				<RichText text="hello world" facets={facets} />,
			);
			expect(container.textContent).toBe("hello world");
			// Should have strong elements
			expect(container.querySelectorAll("strong").length).toBeGreaterThan(0);
			// Should have em element for "world"
			expect(container.querySelector("em")?.textContent).toBe("world");
		});
	});

	describe("unicode handling", () => {
		it("renders bold emoji", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 4 }, features: [BOLD] },
			];
			const { container } = render(<RichText text="🔥" facets={facets} />);
			expect(container.querySelector("strong")?.textContent).toBe("🔥");
		});

		it("renders bold CJK characters", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 9 }, features: [BOLD] },
			];
			const { container } = render(<RichText text="日本語" facets={facets} />);
			expect(container.querySelector("strong")?.textContent).toBe("日本語");
		});

		it("handles facet after emoji", () => {
			// "🔥 bold" - emoji is 4 bytes, space is 1
			const facets: Facet[] = [
				{ index: { byteStart: 5, byteEnd: 9 }, features: [BOLD] },
			];
			const { container } = render(<RichText text="🔥 bold" facets={facets} />);
			expect(container.textContent).toBe("🔥 bold");
			expect(container.querySelector("strong")?.textContent).toBe("bold");
		});

		it("renders family emoji correctly", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 25 }, features: [BOLD] },
			];
			const { container } = render(
				<RichText text="👨‍👩‍👧‍👧" facets={facets} />,
			);
			expect(container.querySelector("strong")?.textContent).toBe("👨‍👩‍👧‍👧");
		});
	});

	describe("invalid facets", () => {
		it("skips facets with negative byteStart", () => {
			const facets: Facet[] = [
				{ index: { byteStart: -1, byteEnd: 5 }, features: [BOLD] },
			];
			const { container } = render(
				<RichText text="hello world" facets={facets} />,
			);
			expect(container.querySelector("strong")).toBeNull();
		});

		it("skips facets with byteEnd > text length", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 1000 }, features: [BOLD] },
			];
			const { container } = render(
				<RichText text="hello world" facets={facets} />,
			);
			expect(container.querySelector("strong")).toBeNull();
		});

		it("skips facets with empty features", () => {
			const facets: Facet[] = [
				{ index: { byteStart: 0, byteEnd: 5 }, features: [] },
			];
			const { container } = render(
				<RichText text="hello world" facets={facets} />,
			);
			expect(container.querySelector("strong")).toBeNull();
			expect(container.querySelector("em")).toBeNull();
		});

		it("processes valid facets while skipping invalid", () => {
			const facets: Facet[] = [
				{ index: { byteStart: -1, byteEnd: 5 }, features: [BOLD] },
				{ index: { byteStart: 0, byteEnd: 5 }, features: [ITALIC] },
			];
			const { container } = render(
				<RichText text="hello world" facets={facets} />,
			);
			expect(container.querySelector("strong")).toBeNull();
			expect(container.querySelector("em")?.textContent).toBe("hello");
		});
	});
});
