export type ShippingRate = {
  region: string;
  price: number;
  days: number;
};

export type ShippingConfig = {
  freeFrom: number;
  rates: Record<string, { price: number; days: number }>;
};

export const SHIPPING_RATES: Record<string, ShippingRate> = {
  // Sudeste
  SP: { region: "Sudeste", price: 14.9, days: 2 },
  RJ: { region: "Sudeste", price: 14.9, days: 3 },
  MG: { region: "Sudeste", price: 14.9, days: 3 },
  ES: { region: "Sudeste", price: 14.9, days: 3 },
  // Sul
  PR: { region: "Sul", price: 19.9, days: 4 },
  SC: { region: "Sul", price: 19.9, days: 4 },
  RS: { region: "Sul", price: 19.9, days: 5 },
  // Centro-Oeste
  GO: { region: "Centro-Oeste", price: 22.9, days: 5 },
  MT: { region: "Centro-Oeste", price: 22.9, days: 6 },
  MS: { region: "Centro-Oeste", price: 22.9, days: 5 },
  DF: { region: "Centro-Oeste", price: 22.9, days: 4 },
  // Nordeste
  BA: { region: "Nordeste", price: 24.9, days: 6 },
  SE: { region: "Nordeste", price: 24.9, days: 7 },
  AL: { region: "Nordeste", price: 24.9, days: 7 },
  PE: { region: "Nordeste", price: 24.9, days: 7 },
  PB: { region: "Nordeste", price: 24.9, days: 8 },
  RN: { region: "Nordeste", price: 24.9, days: 8 },
  CE: { region: "Nordeste", price: 24.9, days: 8 },
  PI: { region: "Nordeste", price: 27.9, days: 9 },
  MA: { region: "Nordeste", price: 27.9, days: 9 },
  // Norte
  PA: { region: "Norte", price: 32.9, days: 10 },
  TO: { region: "Norte", price: 32.9, days: 10 },
  AM: { region: "Norte", price: 35.9, days: 12 },
  RO: { region: "Norte", price: 35.9, days: 12 },
  AC: { region: "Norte", price: 39.9, days: 14 },
  RR: { region: "Norte", price: 39.9, days: 14 },
  AP: { region: "Norte", price: 39.9, days: 14 },
};

const DEFAULT_RATE: ShippingRate = { region: "Brasil", price: 29.9, days: 10 };

export const DEFAULT_FREE_FROM = 149;

export function getShippingRate(state: string, config?: ShippingConfig): ShippingRate {
  const base = SHIPPING_RATES[state.toUpperCase()] ?? DEFAULT_RATE;
  if (!config?.rates) return base;
  const override = config.rates[state.toUpperCase()];
  if (!override) return base;
  return { ...base, ...override };
}

export function calcShippingCost(state: string, subtotal: number, freeFrom: number, config?: ShippingConfig): number {
  if (subtotal >= freeFrom) return 0;
  return getShippingRate(state, config).price;
}
