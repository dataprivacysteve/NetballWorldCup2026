export type ConfigurationState = 'draft' | 'published' | 'locked';

export function registrationWindowState(
  configurationStatus: ConfigurationState,
  opensAt: Date | null,
  closesAt: Date | null,
  now = new Date(),
) {
  const published = ['published', 'locked'].includes(configurationStatus);
  const open =
    published && (!opensAt || now >= opensAt) && (!closesAt || now < closesAt);
  const phase = !published
    ? ('configuration' as const)
    : opensAt && now < opensAt
      ? ('scheduled' as const)
      : closesAt && now >= closesAt
        ? ('closed' as const)
        : ('open' as const);
  return { open, phase };
}
