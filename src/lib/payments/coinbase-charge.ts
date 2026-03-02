import { env } from "@/src/config/env";
import {
  getRechargePackageById,
  supportedCryptoAssets,
  supportedCryptoNetworks
} from "@/src/lib/payments/catalog";
import {
  completePaidOrder,
  createPaymentOrder
} from "@/src/lib/payments/repository";

type CoinbaseChargeResponse = {
  data?: {
    id: string;
    hosted_url: string;
  };
};

type CreateCoinbaseChargeInput = {
  userId: string;
  packageId: string;
  successUrl: string;
  cancelUrl: string;
  fetchImpl?: typeof fetch;
};

type CoinbaseWebhookEvent = {
  type: string;
  data: {
    id?: string;
    metadata?: {
      order_id?: string;
    };
  };
};

export function buildCoinbaseChargePayload({
  orderId,
  packageName,
  amountUsd,
  successUrl,
  cancelUrl
}: {
  orderId: string;
  packageName: string;
  amountUsd: number;
  successUrl: string;
  cancelUrl: string;
}) {
  return {
    name: packageName,
    description: `${packageName} recharge`,
    pricing_type: "fixed_price",
    local_price: {
      amount: amountUsd.toFixed(2),
      currency: "USD"
    },
    redirect_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      order_id: orderId,
      accepted_assets: [...supportedCryptoAssets],
      accepted_networks: [...supportedCryptoNetworks]
    }
  };
}

export async function createCoinbaseCharge({
  userId,
  packageId,
  successUrl,
  cancelUrl,
  fetchImpl = fetch
}: CreateCoinbaseChargeInput) {
  const pkg = getRechargePackageById(packageId);

  if (!pkg) {
    throw new Error("Recharge package not found");
  }

  if (!env.COINBASE_COMMERCE_API_KEY) {
    throw new Error("COINBASE_COMMERCE_API_KEY is not configured");
  }

  const orderId = `cb_${packageId}_${Date.now()}`;
  createPaymentOrder({
    id: orderId,
    userId,
    provider: "coinbase",
    amountUsd: pkg.amountUsd,
    quotaAmount: pkg.quotaAmount,
    kind: "recharge"
  });

  const payload = buildCoinbaseChargePayload({
    orderId,
    packageName: pkg.title,
    amountUsd: pkg.amountUsd,
    successUrl,
    cancelUrl
  });
  const response = await fetchImpl("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": env.COINBASE_COMMERCE_API_KEY,
      "X-CC-Version": "2018-03-22"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Coinbase charge creation failed with status ${response.status}`);
  }

  const data = (await response.json()) as CoinbaseChargeResponse;

  return {
    orderId,
    chargeId: data.data?.id ?? "",
    hostedUrl: data.data?.hosted_url ?? "",
    acceptedAssets: [...supportedCryptoAssets],
    acceptedNetworks: [...supportedCryptoNetworks]
  };
}

export function completeCoinbaseChargeFromEvent({
  event
}: {
  event: CoinbaseWebhookEvent;
}) {
  if (event.type !== "charge:confirmed") {
    return {
      applied: false
    };
  }

  const orderId = event.data.metadata?.order_id;

  if (!orderId) {
    throw new Error("Coinbase webhook is missing order_id metadata");
  }

  return completePaidOrder({
    orderId,
    providerPaymentId: event.data.id ?? ""
  });
}
