import { describe, expect, it } from "vitest";

import { paginateResults } from "@/services/pagination";

describe("paginateResults", () => {
  it("returns the first page slice and metadata", () => {
    const result = paginateResults(Array.from({ length: 30 }, (_, index) => index + 1), 0, 10);

    expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.totalPages).toBe(3);
    expect(result.startItemNumber).toBe(1);
    expect(result.endItemNumber).toBe(10);
  });

  it("returns the last partial page correctly", () => {
    const result = paginateResults(Array.from({ length: 23 }, (_, index) => index + 1), 2, 10);

    expect(result.items).toEqual([21, 22, 23]);
    expect(result.totalPages).toBe(3);
    expect(result.startItemNumber).toBe(21);
    expect(result.endItemNumber).toBe(23);
  });

  it("clamps the requested page to the last available page", () => {
    const result = paginateResults(Array.from({ length: 12 }, (_, index) => index + 1), 9, 10);

    expect(result.currentPage).toBe(1);
    expect(result.items).toEqual([11, 12]);
  });

  it("returns empty metadata when there are no items", () => {
    const result = paginateResults<number>([], 0, 25);

    expect(result.items).toEqual([]);
    expect(result.totalItems).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.startItemNumber).toBe(0);
    expect(result.endItemNumber).toBe(0);
  });
});