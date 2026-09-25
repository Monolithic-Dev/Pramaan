import { describe, expect, it } from "vitest";
import { compact, fullNumber, money, pct } from "./format.js";

describe("money", () => {
  it("uses lakh and crore the way Indian officers read them", () => {
    expect(money(85_000)).toBe("₹85 K");
    expect(money(450_000)).toBe("₹4.5 L");
    expect(money(9_310_000)).toBe("₹93.1 L");
    expect(money(12_000_000)).toBe("₹1.2 Cr");
    expect(money(2_130_000_000)).toBe("₹213 Cr");
    expect(money(500)).toBe("₹500");
  });

  it("formats reais in thousands and millions", () => {
    expect(money(2_500_000, "BRL")).toBe("R$2.5 M");
    expect(money(900, "BRL")).toBe("R$900");
  });
});

describe("compact and friends", () => {
  it("shortens big counts without losing the unit", () => {
    expect(compact(17_500)).toBe("17.5K");
    expect(compact(337_746)).toBe("3.38 L");
    expect(compact(42)).toBe("42");
  });

  it("groups digits Indian-style and formats percentages", () => {
    expect(fullNumber(1234567)).toBe("12,34,567");
    expect(pct(0.256)).toBe("26%");
    expect(pct(null)).toBe("-");
  });
});
