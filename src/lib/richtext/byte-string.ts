const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class ByteString {
	readonly text: string;
	readonly bytes: Uint8Array;

	constructor(text: string) {
		this.text = text;
		this.bytes = encoder.encode(text);
	}

	get length(): number {
		return this.bytes.length;
	}

	sliceByBytes(byteStart: number, byteEnd: number): string {
		return decoder.decode(this.bytes.slice(byteStart, byteEnd));
	}
}
