/** @format */

export interface MetroGroup {
  code: string;
  name: string;
  airports: string[];
}

export const METRO_GROUPS: MetroGroup[] = [
  { code: "NYC", name: "New York City", airports: ["JFK", "LGA", "EWR"] },
  { code: "BAY", name: "San Francisco Bay Area", airports: ["SFO", "OAK", "SJC"] },
  { code: "TYO", name: "Tokyo", airports: ["NRT", "HND"] },
  { code: "LON", name: "London", airports: ["LHR", "LGW", "STN", "LCY"] },
  { code: "LAX_AREA", name: "Los Angeles Area", airports: ["LAX", "BUR", "LGB", "SNA", "ONT"] },
  { code: "WAS", name: "Washington DC Area", airports: ["IAD", "DCA", "BWI"] },
  { code: "CHI", name: "Chicago", airports: ["ORD", "MDW"] },
  { code: "PAR", name: "Paris", airports: ["CDG", "ORY"] },
];

export function expandMetro(input: string): string[] {
  const metro = METRO_GROUPS.find((g) => g.code === input.toUpperCase());
  return metro ? metro.airports : [input.toUpperCase()];
}

export function formatMetroDisplay(group: MetroGroup): string {
  return `${group.code} (${group.airports.join("·")})`;
}

export function isMetroValue(value: string): boolean {
  return value.includes(",");
}

export function findMetroByCsv(csv: string): MetroGroup | undefined {
  const codes = csv.toUpperCase().split(",").map((s) => s.trim()).sort();
  return METRO_GROUPS.find((g) => {
    const sorted = [...g.airports].sort();
    return sorted.length === codes.length && sorted.every((a, i) => a === codes[i]);
  });
}

export function searchMetros(query: string, limit = 4): MetroGroup[] {
  if (!query) return [];
  const q = query.toUpperCase().trim();
  const results: MetroGroup[] = [];
  for (const g of METRO_GROUPS) {
    if (g.code === q) results.push(g);
  }
  for (const g of METRO_GROUPS) {
    if (!results.includes(g) && g.code.startsWith(q) && results.length < limit) {
      results.push(g);
    }
  }
  for (const g of METRO_GROUPS) {
    if (!results.includes(g) && g.name.toUpperCase().includes(q) && results.length < limit) {
      results.push(g);
    }
  }
  for (const g of METRO_GROUPS) {
    if (!results.includes(g) && g.airports.some((a) => a === q) && results.length < limit) {
      results.push(g);
    }
  }
  return results;
}
