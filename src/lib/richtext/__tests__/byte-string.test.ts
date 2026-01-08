import { describe, expect, it } from "vitest";
import { ByteString } from "../byte-string";

describe("ByteString", () => {
	describe("construction", () => {
		it("handles empty string", () => {
			const bs = new ByteString("");
			expect(bs.text).toBe("");
			expect(bs.length).toBe(0);
		});

		it("handles ASCII text", () => {
			const bs = new ByteString("hello");
			expect(bs.text).toBe("hello");
			expect(bs.length).toBe(5);
		});

		it("handles multi-byte UTF-8 characters", () => {
			const bs = new ByteString("日本語");
			expect(bs.text).toBe("日本語");
			expect(bs.length).toBe(9); // 3 chars * 3 bytes each
		});

		it("handles emoji (4-byte UTF-8)", () => {
			const bs = new ByteString("🔥");
			expect(bs.text).toBe("🔥");
			expect(bs.length).toBe(4);
		});

		it("handles mixed ASCII and multi-byte", () => {
			const bs = new ByteString("a日b");
			expect(bs.text).toBe("a日b");
			expect(bs.length).toBe(5); // 1 + 3 + 1
		});
	});

	describe("sliceByBytes", () => {
		it("slices ASCII correctly", () => {
			const bs = new ByteString("hello world");
			expect(bs.sliceByBytes(0, 5)).toBe("hello");
			expect(bs.sliceByBytes(6, 11)).toBe("world");
			expect(bs.sliceByBytes(0, 11)).toBe("hello world");
		});

		it("slices multi-byte characters correctly", () => {
			const bs = new ByteString("日本語");
			expect(bs.sliceByBytes(0, 3)).toBe("日");
			expect(bs.sliceByBytes(3, 6)).toBe("本");
			expect(bs.sliceByBytes(6, 9)).toBe("語");
			expect(bs.sliceByBytes(0, 9)).toBe("日本語");
		});

		it("slices mixed content correctly", () => {
			const bs = new ByteString("a日b");
			expect(bs.sliceByBytes(0, 1)).toBe("a");
			expect(bs.sliceByBytes(1, 4)).toBe("日");
			expect(bs.sliceByBytes(4, 5)).toBe("b");
		});

		it("slices emoji correctly", () => {
			const bs = new ByteString("hi🔥bye");
			expect(bs.sliceByBytes(0, 2)).toBe("hi");
			expect(bs.sliceByBytes(2, 6)).toBe("🔥");
			expect(bs.sliceByBytes(6, 9)).toBe("bye");
		});

		it("handles empty slice", () => {
			const bs = new ByteString("hello");
			expect(bs.sliceByBytes(2, 2)).toBe("");
		});

		it("handles slice at start", () => {
			const bs = new ByteString("hello");
			expect(bs.sliceByBytes(0, 0)).toBe("");
		});

		it("handles slice at end", () => {
			const bs = new ByteString("hello");
			expect(bs.sliceByBytes(5, 5)).toBe("");
		});
	});
});
