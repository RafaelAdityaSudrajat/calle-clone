import { describe, it, expect } from "vitest";
import { listOrdersQuerySchema } from "../../../src/modules/order/order.schema";

describe("listOrdersQuerySchema", () => {
  it("query kosong -> default page 1, limit 10, tanpa status", () => {
    const parsed = listOrdersQuerySchema.parse({});

    expect(parsed).toEqual({ page: 1, limit: 10 });
    expect("status" in parsed).toBe(false);
  });

  it("coerce string angka jadi number (dari query string Express)", () => {
    const parsed = listOrdersQuerySchema.parse({ page: "3", limit: "20" });

    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(20);
  });

  it.each([
    ["page 0", { page: "0" }],
    ["page negatif", { page: "-1" }],
    ["page desimal", { page: "1.5" }],
    ["page bukan angka", { page: "abc" }],
    ["limit 0", { limit: "0" }],
    ["limit > 50", { limit: "51" }],
    ["limit desimal", { limit: "10.5" }],
  ])("tolak %s", (_label, q) => {
    expect(() => listOrdersQuerySchema.parse(q)).toThrow();
  });

  it.each(["PENDING_PAYMENT", "PAID", "CANCELLED"])(
    "terima status valid: %s",
    (status) => {
      expect(listOrdersQuerySchema.parse({ status })).toMatchObject({ status });
    },
  );

  it("tolak status yang tidak dikenal enum", () => {
    expect(() => listOrdersQuerySchema.parse({ status: "SHIPPED" })).toThrow();
  });

  it("tolak query param asing (strictObject)", () => {
    expect(() =>
      listOrdersQuerySchema.parse({ page: "1", utm_source: "x" }),
    ).toThrow();
  });
});
