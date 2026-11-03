/** Pure, single routing decision. No wildcard/list or inherited memory defaults. */
export function resolveMuseMemoryShadowGate(input: {
  flagEnabled: boolean;
  businessId: string;
  stagedBusinessId: string | undefined;
  businessOptIn: unknown;
  memoryMode: string;
}): boolean {
  return input.flagEnabled === true && input.businessOptIn === true &&
    !!input.businessId && input.stagedBusinessId === input.businessId &&
    (input.memoryMode === "full" || input.memoryMode === "contact_only");
}
