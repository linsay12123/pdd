export const PROVIDER_REQUEST_SCHEMA_INVALID = "PROVIDER_REQUEST_SCHEMA_INVALID";

const PROVIDER_REQUEST_SCHEMA_MARKERS = ["invalid_json_schema", "text.format.schema"];

type ProviderRequestSchemaErrorInput = {
  providerStatusCode?: number | null;
  providerErrorBody?: string | null;
};

export function isProviderRequestSchemaError(input: ProviderRequestSchemaErrorInput) {
  if (input.providerStatusCode !== 400) {
    return false;
  }

  const normalizedBody = input.providerErrorBody?.toLowerCase() ?? "";
  return PROVIDER_REQUEST_SCHEMA_MARKERS.some((marker) =>
    normalizedBody.includes(marker)
  );
}
