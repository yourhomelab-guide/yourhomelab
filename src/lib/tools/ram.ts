/** RAM planner: pure calculation, used by src/components/tools/RamPlanner.astro. All values in MB. */

export const RAM_OS = 400; // Debian without GUI
export const RAM_DOCKER = 100; // Docker daemon + containerd
export const RAM_PROXMOX = 1500; // Proxmox VE host overhead
export const RAM_FALLBACK = 256; // estimate for services without resources.ram

export interface RamService {
  id: string;
  ram?: number;
}

export interface RamInput {
  services: RamService[];
  proxmox: boolean;
  /** Buffer for page cache / reserve in percent */
  buffer: number;
}

export interface RamPart {
  id: string;
  mb: number;
  estimated?: boolean;
}

export type RamTier = 4 | 8 | 16 | 32;

export interface RamResult {
  base: RamPart[];
  services: RamPart[];
  bufferMb: number;
  used: number;
  total: number;
  tier: RamTier;
}

export const serviceRam = (s: RamService) => s.ram ?? RAM_FALLBACK;

/** Smallest usual RAM size (GB) that holds `total` MB with some air left (at most ~85 % full). */
export function ramTier(totalMb: number): RamTier {
  for (const gb of [4, 8, 16] as const) if (totalMb <= gb * 1024 * 0.85) return gb;
  return 32;
}

export function planRam({ services, proxmox, buffer }: RamInput): RamResult {
  const base: RamPart[] = [
    { id: 'os', mb: RAM_OS },
    { id: 'docker', mb: RAM_DOCKER },
  ];
  if (proxmox) base.push({ id: 'proxmox', mb: RAM_PROXMOX });
  const svc = services.map((s) => ({ id: s.id, mb: serviceRam(s), estimated: s.ram == null }));
  const used = [...base, ...svc].reduce((n, p) => n + p.mb, 0);
  const bufferMb = Math.round((used * Math.max(0, buffer)) / 100);
  const total = used + bufferMb;
  return { base, services: svc, bufferMb, used, total, tier: ramTier(total) };
}
