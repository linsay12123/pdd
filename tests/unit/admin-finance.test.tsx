import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const fromMock = vi.fn();

vi.mock("../../src/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: fromMock
  })
}));

describe("admin finance", () => {
  it("loads real finance summary rows", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "activation_codes") {
        return {
          select: () => ({
            gte: () => ({
              lte: async () => ({
                data: null,
                count: table === "activation_codes" ? 7 : 0,
                error: null
              })
            })
          })
        };
      }

      if (table === "quota_ledger_entries") {
        return {
          select: () => ({
            in: () => ({
              gte: () => ({
                lte: async () => ({
                  data: [{ amount: 500 }, { amount: 1000 }],
                  error: null
                })
              })
            })
          })
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const { getAdminFinanceSummary } = await import("../../src/lib/admin/finance");
    const rows = await getAdminFinanceSummary({
      shouldUseSupabase: () => true,
      now: () => new Date("2026-03-03T12:00:00.000+08:00")
    });

    expect(rows).toEqual([
      { label: "今日发出的激活码", value: "7 个" },
      { label: "今日已兑换激活码", value: "7 个" },
      { label: "今日消耗额度", value: "1500 点" }
    ]);
  });

  it("renders homepage-style finance cards", async () => {
    const { FinanceSummaryView } = await import("../../src/components/admin/finance-summary");
    const html = renderToStaticMarkup(
      <FinanceSummaryView
        rows={[
          { label: "今日发出的激活码", value: "18 个" },
          { label: "今日已兑换激活码", value: "11 个" },
          { label: "今日消耗额度", value: "6500 点" }
        ]}
      />
    );

    expect(html).toContain("财务总览");
    expect(html).toContain("18 个");
    expect(html).toContain("6500 点");
  });
});
