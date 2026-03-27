import { describe, expect, it } from "vitest";

import { buildJustTcgLookupCandidates } from "@/services/card-matching";

describe("buildJustTcgLookupCandidates", () => {
  it("builds ordered lookup candidates prioritizing number+name and set+name", () => {
    const candidates = buildJustTcgLookupCandidates({
      id: "gym1-1",
      setId: "gym1",
      setName: "Gym Heroes",
      condition: "Near Mint",
      number: "1",
      name: "Blaine's Moltres"
    });

    expect(candidates[0]).toEqual({ setId: "gym1", setName: "Gym Heroes", condition: "Near Mint", cardNumber: "1", cardName: "Blaine's Moltres" });
    expect(candidates).toContainEqual({ setId: "gym1", setName: "Gym Heroes", condition: "Near Mint", cardNumber: "1" });
    expect(candidates).toContainEqual({ setId: "gym1", setName: "Gym Heroes", condition: "Near Mint", cardName: "Blaine's Moltres" });
    expect(candidates).toContainEqual({ setId: "gym1", setName: "Gym Heroes", condition: "Near Mint", cardName: "Blaine s Moltres" });
  });

  it("deduplicates when name normalization yields the same string as the original", () => {
    // "Alakazam" has no special chars so normalized == original → one candidate is deduplicated
    const candidates = buildJustTcgLookupCandidates({
      id: "base1-1",
      setId: "base1",
      setName: "Base Set",
      condition: "Near Mint",
      number: "1",
      name: "Alakazam"
    });

    expect(candidates).toHaveLength(3);
    // should not contain two identical setId+cardName entries
    const nameOnlyCandidates = candidates.filter((c) => c.cardName === "Alakazam" && !c.cardNumber);
    expect(nameOnlyCandidates).toHaveLength(1);
  });

  it("normalizes unicode special characters in card name to produce additional candidates", () => {
    // U+2019 RIGHT SINGLE QUOTATION MARK (common in Pokémon card names like "Farfetch'd")
    const candidates = buildJustTcgLookupCandidates({
      id: "xy9-29",
      setId: "xy9",
      setName: "BREAKpoint",
      condition: "Near Mint",
      number: "29",
      name: "Farfetch\u2019d"
    });

    // Should have a variant with the special char removed/replaced
    const hasNormalizedCandidate = candidates.some(
      (c) => typeof c.cardName === "string" && !c.cardName.includes("\u2019")
    );
    expect(hasNormalizedCandidate).toBe(true);
  });

  it("includes both raw and lowercase number candidates when casing differs", () => {
    const candidates = buildJustTcgLookupCandidates({
      id: "set1-SH1",
      setId: "set1",
      setName: "Neo Destiny",
      condition: "Near Mint",
      number: "SH1",
      name: "Shining Charizard"
    });

    const numberCandidates = candidates
      .filter((c): c is { cardNumber: string } => typeof c.cardNumber === "string")
      .map((c) => c.cardNumber);

    expect(numberCandidates).toContain("SH1");
    expect(numberCandidates).toContain("sh1");
  });
});
