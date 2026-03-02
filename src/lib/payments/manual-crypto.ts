import {
  getRechargePackageById,
  supportedCryptoAssets,
  supportedCryptoNetworks,
  type SupportedCryptoAsset,
  type SupportedCryptoNetwork
} from "@/src/lib/payments/catalog";
import {
  completePaidOrder,
  createPaymentOrder,
  getPaymentOrder
} from "@/src/lib/payments/repository";

export type ManualCryptoAddressRow = {
  asset: SupportedCryptoAsset;
  network: SupportedCryptoNetwork;
  address: string;
};

const manualCryptoAddressBook: Record<
  SupportedCryptoAsset,
  Record<SupportedCryptoNetwork, string>
> = {
  USDC: {
    solana: "5dY6hPSYFvH3N3NAKqge5rbymVxBrqoLFAJZ25HBhZMn",
    ethereum: "0x746C5FD7084588f17e915CCebdDD8b4E8A7293C1",
    tron: "TCF5CTNcAxriK7yiohZn92zmExok2zqhaq"
  }
};

export function listManualCryptoAddresses(): ManualCryptoAddressRow[] {
  const rows: ManualCryptoAddressRow[] = [];

  for (const asset of supportedCryptoAssets) {
    for (const network of supportedCryptoNetworks) {
      rows.push({
        asset,
        network,
        address: manualCryptoAddressBook[asset][network]
      });
    }
  }

  return rows;
}

export function createManualCryptoOrder({
  userId,
  packageId
}: {
  userId: string;
  packageId: string;
}) {
  const pkg = getRechargePackageById(packageId);

  if (!pkg) {
    throw new Error("Recharge package not found");
  }

  const orderId = `crypto_${packageId}_${Date.now()}`;
  createPaymentOrder({
    id: orderId,
    userId,
    provider: "crypto",
    amountUsd: pkg.amountUsd,
    quotaAmount: pkg.quotaAmount,
    kind: "recharge"
  });

  return {
    orderId,
    packageId: pkg.id,
    packageTitle: pkg.title,
    amountUsd: pkg.amountUsd,
    quotaAmount: pkg.quotaAmount,
    acceptedAssets: [...supportedCryptoAssets],
    acceptedNetworks: [...supportedCryptoNetworks],
    addresses: listManualCryptoAddresses(),
    instructions: [
      "请使用 USDC 付款。",
      "请选择 Solana、Ethereum 或 TRON 中你方便的链路后向对应地址付款。",
      "付款后把订单号和转账哈希发给客服，等待人工确认到账。",
      "人工确认后，系统会手动给你的账号充值。"
    ]
  };
}

export function confirmManualCryptoPayment({
  orderId,
  transferReference
}: {
  orderId: string;
  transferReference: string;
}) {
  const order = getPaymentOrder(orderId);

  if (!order) {
    throw new Error("Payment order not found");
  }

  if (order.provider !== "crypto") {
    throw new Error("Only manual crypto orders can be confirmed here");
  }

  return completePaidOrder({
    orderId,
    providerPaymentId: transferReference
  });
}
