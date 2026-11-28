import { describe, expect, test } from "bun:test";
import { parseSpecs } from "../src/components/spec-badges";
import { extractProductUrlsFromHtml } from "../src/lib/link-parser";
import { buildAliases, normalizeProductKey } from "../src/lib/search-key";

describe("catalog product matching", () => {
  test("removes retail wording, memory, and colour without losing model identifiers", () => {
    expect(normalizeProductKey("Nothing Phone 2a Official 8/256GB Black Bangladesh price")).toBe("nothing phone 2a");
    expect(normalizeProductKey("CMF Phone 2 Pro 5G 12GB/256GB")).toBe("cmf phone 2 pro 5g");
  });

  test("keeps network generation and only accepts explicit multi-word aliases", () => {
    expect(normalizeProductKey("Galaxy A54 5G")).not.toBe(normalizeProductKey("Galaxy A54 4G"));
    expect(buildAliases("samsung galaxy a54", ["Galaxy A54", "A54"])).toEqual(["galaxy a54"]);
  });
});

describe("product specification badges", () => {
  test("does not mistake camera megapixels or display size for storage", () => {
    expect(parseSpecs("64MP camera, 6.7 inch display").memory).toBeNull();
  });

  test("recognizes explicit RAM and storage pairs", () => {
    expect(parseSpecs("CMF Phone 2 Pro 8/256GB").memory).toBe("8/256 GB");
  });
});

describe("category page import", () => {
  test("returns only unique same-store product pages", () => {
    const html = [
      '<a href="/smart-phone">Phones</a>',
      '<a href="/product/phone-2a">Phone</a>',
      '<a href="https://www.startech.com.bd/product/phone-2a">Duplicate</a>',
      '<a href="https://other.example/product/phone">External</a>',
    ].join(" ");
    expect(extractProductUrlsFromHtml("https://www.startech.com.bd/smart-phone", html)).toEqual([
      "https://www.startech.com.bd/product/phone-2a",
    ]);
  });
});