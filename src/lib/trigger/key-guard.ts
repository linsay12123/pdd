export function getInvalidTriggerKeyReason(input: {
  triggerSecretKey: string;
  nodeEnv?: string;
  vercelEnv?: string;
}) {
  const key = input.triggerSecretKey.trim();
  if (!key) {
    return "missing";
  }

  const isProductionRuntime =
    input.vercelEnv === "production" || input.nodeEnv === "production";
  if (isProductionRuntime && key.startsWith("tr_dev_")) {
    return "dev_key_in_production";
  }

  return null;
}

