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
    base: "请把你的USDC Base地址贴到这里",
    ethereum: "请把你的USDC ERC20地址贴到这里",
    solana: "请把你的USDC Solana地址贴到这里"
  },
  USDT: {
    base: "请把你的USDT Base地址贴到这里",
    ethereum: "请把你的USDT ERC20地址贴到这里",
    solana: "请把你的USDT Solana地址贴到这里"
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
      "请选择 USDT 或 USDC。",
      "请选择你方便的链路后向对应地址付款。",
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
