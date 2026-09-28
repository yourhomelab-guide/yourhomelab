/** Power calculator: pure calculation, used by src/components/tools/PowerCalculator.astro. */

export const powerPresets = [
  { id: 'pi', watts: 4 },
  { id: 'n100', watts: 8 },
  { id: 'business', watts: 12 },
  { id: 'nas', watts: 25 },
  { id: 'desktop', watts: 45 },
  { id: 'server', watts: 80 },
] as const;

export const currencies = { '€': 'EUR', $: 'USD', '£': 'GBP' } as const;
export type CurrencySymbol = keyof typeof currencies;

export interface PowerInput {
  idle: number;
  /** Power under load in W; 0 or empty = no load phase */
  load?: number;
  /** Share of time under load in percent */
  loadShare: number;
  /** Price per kWh */
  price: number;
  devices: number;
  /** Hours per day (24 = always on) */
  hours: number;
}

export interface PowerResult {
  avgWatts: number;
  kwhYear: number;
  costYear: number;
  costMonth: number;
  /** Cost of 1 W for a year at the given runtime and price */
  costPerWatt: number;
}

const num = (v: unknown, min = 0, max = Infinity) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0;
};

/** Average power of one device, weighting idle and load by the load share */
export function avgWatts(idle: number, load: number | undefined, share: number) {
  const s = num(share, 0, 100) / 100;
  const i = num(idle);
  const l = num(load);
  return l > 0 ? i * (1 - s) + l * s : i;
}

export function calcPower(p: PowerInput): PowerResult {
  const hours = num(p.hours, 0, 24);
  const devices = Math.max(0, Math.round(num(p.devices)));
  const price = num(p.price);
  const w = avgWatts(p.idle, p.load, p.loadShare) * devices;
  const kwhYear = (w * hours * 365) / 1000;
  const costYear = kwhYear * price;
  return { avgWatts: w, kwhYear, costYear, costMonth: costYear / 12, costPerWatt: ((hours * 365) / 1000) * price };
}
