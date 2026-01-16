import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import type { BacklinksResponse } from "../constellation-client";
import {
	combineRollbacks,
	optimisticBacklinks,
	optimisticBoolean,
	optimisticCount,
	optimisticInfiniteRecord,
	optimisticRecord,
	optimisticRecordWithIndex,
	optimisticToggle,
	type RecordPage,
	runOptimistic,
	skip,
	when,
} from "../optimistic-utils";

describe("optimistic-utils", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});
	});

	describe("combineRollbacks", () => {
		it("executes rollbacks in reverse order", () => {
			const order: number[] = [];
			const rollbacks = [
				() => order.push(1),
				() => order.push(2),
				() => order.push(3),
			];

			const combined = combineRollbacks(rollbacks);
			combined();

			expect(order).toEqual([3, 2, 1]);
		});

		it("handles empty array", () => {
			const combined = combineRollbacks([]);
			expect(() => combined()).not.toThrow();
		});
	});

	describe("skip", () => {
		it("returns a no-op thunk", async () => {
			const thunk = skip();
			const rollback = await thunk();
			expect(() => rollback()).not.toThrow();
		});
	});

	describe("when", () => {
		it("runs update when value is truthy", async () => {
			const key = ["test", "when"];
			queryClient.setQueryData(key, false);

			const thunk = when("truthy-value", () =>
				optimisticBoolean(queryClient, key, true),
			);
			await thunk();

			expect(queryClient.getQueryData(key)).toBe(true);
		});

		it("skips update when value is null", async () => {
			const key = ["test", "when-null"];
			queryClient.setQueryData(key, "original");

			const thunk = when(null, () =>
				optimisticRecord(queryClient, key, "changed"),
			);
			await thunk();

			expect(queryClient.getQueryData(key)).toBe("original");
		});

		it("skips update when value is undefined", async () => {
			const key = ["test", "when-undefined"];
			queryClient.setQueryData(key, "original");

			const thunk = when(undefined, () =>
				optimisticRecord(queryClient, key, "changed"),
			);
			await thunk();

			expect(queryClient.getQueryData(key)).toBe("original");
		});

		it("skips update when value is false", async () => {
			const key = ["test", "when-false"];
			queryClient.setQueryData(key, "original");

			const thunk = when(false, () =>
				optimisticRecord(queryClient, key, "changed"),
			);
			await thunk();

			expect(queryClient.getQueryData(key)).toBe("original");
		});

		it("passes narrowed value to update function", async () => {
			const key = ["test", "when-value"];
			const userDid = "did:plc:test123";

			const thunk = when(userDid, (did) =>
				optimisticRecord(queryClient, key, { did }),
			);
			await thunk();

			expect(queryClient.getQueryData(key)).toEqual({ did: "did:plc:test123" });
		});
	});

	describe("optimisticBoolean", () => {
		it("sets new boolean value", async () => {
			const key = ["test", "bool"];
			queryClient.setQueryData(key, false);

			await optimisticBoolean(queryClient, key, true)();

			expect(queryClient.getQueryData(key)).toBe(true);
		});

		it("returns rollback that restores previous value", async () => {
			const key = ["test", "bool"];
			queryClient.setQueryData(key, false);

			const rollback = await optimisticBoolean(queryClient, key, true)();
			expect(queryClient.getQueryData(key)).toBe(true);

			rollback();
			expect(queryClient.getQueryData(key)).toBe(false);
		});

		it("handles undefined previous value", async () => {
			const key = ["test", "bool", "undefined"];

			const rollback = await optimisticBoolean(queryClient, key, true)();
			expect(queryClient.getQueryData(key)).toBe(true);

			rollback();
			expect(queryClient.getQueryData(key)).toBeUndefined();
		});

		it("accepts closure that returns boolean", async () => {
			const key = ["test", "bool", "closure"];
			const otherKey = ["test", "other"];
			queryClient.setQueryData(key, false);
			queryClient.setQueryData(otherKey, 42);

			await optimisticBoolean(queryClient, key, (qc) => {
				const other = qc.getQueryData<number>(otherKey);
				return other === 42;
			})();

			expect(queryClient.getQueryData(key)).toBe(true);
		});

		it("skips update when closure returns undefined", async () => {
			const key = ["test", "bool", "skip"];
			queryClient.setQueryData(key, true);

			await optimisticBoolean(queryClient, key, () => undefined)();

			expect(queryClient.getQueryData(key)).toBe(true);
		});

		it("rollback is no-op when closure returns undefined", async () => {
			const key = ["test", "bool", "skip-rollback"];
			queryClient.setQueryData(key, true);

			const rollback = await optimisticBoolean(
				queryClient,
				key,
				() => undefined,
			)();
			// value unchanged after skipped update
			expect(queryClient.getQueryData(key)).toBe(true);

			queryClient.setQueryData(key, false); // something else changes it
			rollback();

			// rollback should not restore since we skipped
			expect(queryClient.getQueryData(key)).toBe(false);
		});
	});

	describe("optimisticCount", () => {
		it("increments count", async () => {
			const key = ["test", "count"];
			queryClient.setQueryData(key, 5);

			await optimisticCount(queryClient, key, 1)();

			expect(queryClient.getQueryData(key)).toBe(6);
		});

		it("decrements count", async () => {
			const key = ["test", "count"];
			queryClient.setQueryData(key, 5);

			await optimisticCount(queryClient, key, -1)();

			expect(queryClient.getQueryData(key)).toBe(4);
		});

		it("clamps to 0 minimum", async () => {
			const key = ["test", "count"];
			queryClient.setQueryData(key, 1);

			await optimisticCount(queryClient, key, -5)();

			expect(queryClient.getQueryData(key)).toBe(0);
		});

		it("handles undefined as 0", async () => {
			const key = ["test", "count", "undefined"];

			await optimisticCount(queryClient, key, 1)();

			expect(queryClient.getQueryData(key)).toBe(1);
		});

		it("returns rollback that restores previous value", async () => {
			const key = ["test", "count"];
			queryClient.setQueryData(key, 5);

			const rollback = await optimisticCount(queryClient, key, 10)();
			expect(queryClient.getQueryData(key)).toBe(15);

			rollback();
			expect(queryClient.getQueryData(key)).toBe(5);
		});
	});

	describe("optimisticToggle", () => {
		it("updates both boolean and count for like", async () => {
			const boolKey = ["test", "liked"];
			const countKey = ["test", "likeCount"];
			queryClient.setQueryData(boolKey, false);
			queryClient.setQueryData(countKey, 10);

			await optimisticToggle(queryClient, boolKey, countKey, true)();

			expect(queryClient.getQueryData(boolKey)).toBe(true);
			expect(queryClient.getQueryData(countKey)).toBe(11);
		});

		it("updates both boolean and count for unlike", async () => {
			const boolKey = ["test", "liked"];
			const countKey = ["test", "likeCount"];
			queryClient.setQueryData(boolKey, true);
			queryClient.setQueryData(countKey, 10);

			await optimisticToggle(queryClient, boolKey, countKey, false)();

			expect(queryClient.getQueryData(boolKey)).toBe(false);
			expect(queryClient.getQueryData(countKey)).toBe(9);
		});

		it("rollback restores both values", async () => {
			const boolKey = ["test", "liked"];
			const countKey = ["test", "likeCount"];
			queryClient.setQueryData(boolKey, false);
			queryClient.setQueryData(countKey, 10);

			const rollback = await optimisticToggle(
				queryClient,
				boolKey,
				countKey,
				true,
			)();
			rollback();

			expect(queryClient.getQueryData(boolKey)).toBe(false);
			expect(queryClient.getQueryData(countKey)).toBe(10);
		});
	});

	describe("optimisticBacklinks", () => {
		const key = ["test", "backlinks"];
		const record = {
			did: "did:plc:test",
			collection: "app.test.like",
			rkey: "abc123",
		};

		it("adds record to first page", async () => {
			const initial: BacklinksResponse = {
				total: 2,
				records: [
					{ did: "did:plc:other1", collection: "app.test.like", rkey: "xyz" },
					{ did: "did:plc:other2", collection: "app.test.like", rkey: "xyz" },
				],
			};
			queryClient.setQueryData(key, {
				pages: [initial],
				pageParams: [undefined],
			});

			await optimisticBacklinks(queryClient, key, "add", record)();

			const result = queryClient.getQueryData<{ pages: BacklinksResponse[] }>(
				key,
			);
			expect(result?.pages[0].total).toBe(3);
			expect(result?.pages[0].records[0]).toEqual(record);
			expect(result?.pages[0].records.length).toBe(3);
		});

		it("seeds cache if empty", async () => {
			await optimisticBacklinks(queryClient, key, "add", record)();

			const result = queryClient.getQueryData<{ pages: BacklinksResponse[] }>(
				key,
			);
			expect(result?.pages[0].total).toBe(1);
			expect(result?.pages[0].records).toEqual([record]);
		});

		it("removes record from first page by did", async () => {
			const initial: BacklinksResponse = {
				total: 2,
				records: [
					record,
					{ did: "did:plc:other", collection: "app.test.like", rkey: "xyz" },
				],
			};
			queryClient.setQueryData(key, {
				pages: [initial],
				pageParams: [undefined],
			});

			await optimisticBacklinks(queryClient, key, "remove", record)();

			const result = queryClient.getQueryData<{ pages: BacklinksResponse[] }>(
				key,
			);
			expect(result?.pages[0].total).toBe(1);
			expect(result?.pages[0].records).toEqual([
				{ did: "did:plc:other", collection: "app.test.like", rkey: "xyz" },
			]);
		});

		it("removes only matching record when same did has multiple entries", async () => {
			const list1 = {
				did: "did:plc:test",
				collection: "com.deckbelcher.collection.list",
				rkey: "list1",
			};
			const list2 = {
				did: "did:plc:test",
				collection: "com.deckbelcher.collection.list",
				rkey: "list2",
			};
			const initial: BacklinksResponse = {
				total: 3,
				records: [
					list1,
					list2,
					{ did: "did:plc:other", collection: "app.test.like", rkey: "xyz" },
				],
			};
			queryClient.setQueryData(key, {
				pages: [initial],
				pageParams: [undefined],
			});

			await optimisticBacklinks(queryClient, key, "remove", list1)();

			const result = queryClient.getQueryData<{ pages: BacklinksResponse[] }>(
				key,
			);
			expect(result?.pages[0].total).toBe(2);
			expect(result?.pages[0].records).toEqual([
				list2,
				{ did: "did:plc:other", collection: "app.test.like", rkey: "xyz" },
			]);
		});

		it("clamps total to 0 on remove", async () => {
			const initial: BacklinksResponse = {
				total: 0,
				records: [],
			};
			queryClient.setQueryData(key, {
				pages: [initial],
				pageParams: [undefined],
			});

			await optimisticBacklinks(queryClient, key, "remove", record)();

			const result = queryClient.getQueryData<{ pages: BacklinksResponse[] }>(
				key,
			);
			expect(result?.pages[0].total).toBe(0);
		});

		it("rollback restores previous state", async () => {
			const initial: BacklinksResponse = {
				total: 1,
				records: [
					{ did: "did:plc:other", collection: "app.test.like", rkey: "xyz" },
				],
			};
			queryClient.setQueryData(key, {
				pages: [initial],
				pageParams: [undefined],
			});

			const rollback = await optimisticBacklinks(
				queryClient,
				key,
				"add",
				record,
			)();
			rollback();

			const result = queryClient.getQueryData<{ pages: BacklinksResponse[] }>(
				key,
			);
			expect(result?.pages[0]).toEqual(initial);
		});
	});

	describe("optimisticRecord", () => {
		it("sets value directly", async () => {
			const key = ["test", "record"];
			queryClient.setQueryData(key, { name: "old" });

			await optimisticRecord(queryClient, key, { name: "new" })();

			expect(queryClient.getQueryData(key)).toEqual({ name: "new" });
		});

		it("supports updater function", async () => {
			const key = ["test", "record"];
			queryClient.setQueryData(key, { count: 5 });

			await optimisticRecord<{ count: number }>(queryClient, key, (old) =>
				old ? { count: old.count + 1 } : undefined,
			)();

			expect(queryClient.getQueryData(key)).toEqual({ count: 6 });
		});

		it("rollback restores previous value", async () => {
			const key = ["test", "record"];
			const original = { name: "original" };
			queryClient.setQueryData(key, original);

			const rollback = await optimisticRecord(queryClient, key, {
				name: "updated",
			})();
			rollback();

			expect(queryClient.getQueryData(key)).toEqual(original);
		});
	});

	describe("optimisticInfiniteRecord", () => {
		interface TestRecord {
			name: string;
		}

		it("updates matching record in pages", async () => {
			const key = ["test", "infinite"];
			const initial: RecordPage<TestRecord> = {
				records: [
					{
						uri: "at://did:plc:a/app.test/abc",
						cid: "cid1",
						value: { name: "A" },
					},
					{
						uri: "at://did:plc:a/app.test/def",
						cid: "cid2",
						value: { name: "B" },
					},
				],
			};
			queryClient.setQueryData(key, {
				pages: [initial],
				pageParams: [undefined],
			});

			await optimisticInfiniteRecord<TestRecord>(queryClient, key, "/abc", {
				name: "Updated A",
			})();

			const result = queryClient.getQueryData<{
				pages: RecordPage<TestRecord>[];
			}>(key);
			expect(result?.pages[0].records[0].value).toEqual({ name: "Updated A" });
			expect(result?.pages[0].records[1].value).toEqual({ name: "B" });
		});

		it("preserves uri and cid", async () => {
			const key = ["test", "infinite"];
			const initial: RecordPage<TestRecord> = {
				records: [
					{
						uri: "at://did:plc:a/app.test/abc",
						cid: "cid1",
						value: { name: "A" },
					},
				],
			};
			queryClient.setQueryData(key, {
				pages: [initial],
				pageParams: [undefined],
			});

			await optimisticInfiniteRecord<TestRecord>(queryClient, key, "/abc", {
				name: "New",
			})();

			const result = queryClient.getQueryData<{
				pages: RecordPage<TestRecord>[];
			}>(key);
			expect(result?.pages[0].records[0].uri).toBe(
				"at://did:plc:a/app.test/abc",
			);
			expect(result?.pages[0].records[0].cid).toBe("cid1");
		});

		it("handles undefined cache", async () => {
			const key = ["test", "infinite", "empty"];

			await optimisticInfiniteRecord<TestRecord>(queryClient, key, "/abc", {
				name: "New",
			})();

			expect(queryClient.getQueryData(key)).toBeUndefined();
		});

		it("rollback restores previous state", async () => {
			const key = ["test", "infinite"];
			const initial: RecordPage<TestRecord> = {
				records: [
					{
						uri: "at://did:plc:a/app.test/abc",
						cid: "cid1",
						value: { name: "Original" },
					},
				],
			};
			queryClient.setQueryData(key, {
				pages: [initial],
				pageParams: [undefined],
			});

			const rollback = await optimisticInfiniteRecord<TestRecord>(
				queryClient,
				key,
				"/abc",
				{
					name: "Updated",
				},
			)();
			rollback();

			const result = queryClient.getQueryData<{
				pages: RecordPage<TestRecord>[];
			}>(key);
			expect(result?.pages[0].records[0].value).toEqual({ name: "Original" });
		});
	});

	describe("optimisticRecordWithIndex", () => {
		interface TestRecord {
			name: string;
		}

		it("updates both single record and infinite list", async () => {
			const recordKey = ["test", "single"];
			const indexKey = ["test", "list"];

			queryClient.setQueryData(recordKey, { name: "Old" });
			queryClient.setQueryData(indexKey, {
				pages: [
					{
						records: [
							{
								uri: "at://did:plc:a/app.test/abc",
								cid: "cid1",
								value: { name: "Old" },
							},
						],
					},
				],
				pageParams: [undefined],
			});

			await optimisticRecordWithIndex<TestRecord>(
				queryClient,
				recordKey,
				indexKey,
				"abc",
				{ name: "New" },
			)();

			expect(queryClient.getQueryData(recordKey)).toEqual({ name: "New" });
			const list = queryClient.getQueryData<{
				pages: RecordPage<TestRecord>[];
			}>(indexKey);
			expect(list?.pages[0].records[0].value).toEqual({ name: "New" });
		});

		it("rollback restores both", async () => {
			const recordKey = ["test", "single"];
			const indexKey = ["test", "list"];

			queryClient.setQueryData(recordKey, { name: "Original" });
			queryClient.setQueryData(indexKey, {
				pages: [
					{
						records: [
							{
								uri: "at://did:plc:a/app.test/abc",
								cid: "cid1",
								value: { name: "Original" },
							},
						],
					},
				],
				pageParams: [undefined],
			});

			const rollback = await optimisticRecordWithIndex<TestRecord>(
				queryClient,
				recordKey,
				indexKey,
				"abc",
				{ name: "Updated" },
			)();
			rollback();

			expect(queryClient.getQueryData(recordKey)).toEqual({ name: "Original" });
			const list = queryClient.getQueryData<{
				pages: RecordPage<TestRecord>[];
			}>(indexKey);
			expect(list?.pages[0].records[0].value).toEqual({ name: "Original" });
		});
	});

	describe("runOptimistic", () => {
		it("runs updates sequentially and combines rollbacks", async () => {
			const boolKey = ["test", "bool"];
			const countKey = ["test", "count"];

			queryClient.setQueryData(boolKey, false);
			queryClient.setQueryData(countKey, 5);

			const rollback = await runOptimistic([
				optimisticBoolean(queryClient, boolKey, true),
				optimisticCount(queryClient, countKey, 10),
			]);

			expect(queryClient.getQueryData(boolKey)).toBe(true);
			expect(queryClient.getQueryData(countKey)).toBe(15);

			rollback();

			expect(queryClient.getQueryData(boolKey)).toBe(false);
			expect(queryClient.getQueryData(countKey)).toBe(5);
		});

		it("executes rollbacks in reverse order", async () => {
			const order: number[] = [];
			const key1 = ["test", "order1"];
			const key2 = ["test", "order2"];

			queryClient.setQueryData(key1, "a");
			queryClient.setQueryData(key2, "b");

			const rollback = await runOptimistic([
				async () => {
					queryClient.setQueryData(key1, "updated1");
					return () => order.push(1);
				},
				async () => {
					queryClient.setQueryData(key2, "updated2");
					return () => order.push(2);
				},
			]);

			rollback();
			expect(order).toEqual([2, 1]);
		});

		it("handles empty array", async () => {
			const rollback = await runOptimistic([]);
			expect(() => rollback()).not.toThrow();
		});

		it("works with when helper", async () => {
			const key = ["test", "when-run"];
			queryClient.setQueryData(key, "original");

			const userDid: string | null = "did:plc:test";

			const rollback = await runOptimistic([
				when(userDid, () => optimisticRecord(queryClient, key, "updated")),
			]);

			expect(queryClient.getQueryData(key)).toBe("updated");

			rollback();
			expect(queryClient.getQueryData(key)).toBe("original");
		});

		it("skips when condition is falsy", async () => {
			const key = ["test", "when-skip"];
			queryClient.setQueryData(key, "original");

			const userDid: string | null = null;

			await runOptimistic([
				when(userDid, () => optimisticRecord(queryClient, key, "updated")),
			]);

			expect(queryClient.getQueryData(key)).toBe("original");
		});
	});
});
