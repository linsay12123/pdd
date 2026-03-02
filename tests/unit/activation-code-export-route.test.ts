import { beforeEach, describe, expect, it } from "vitest";
import { handleCreateActivationCodesRequest } from "../../app/api/admin/activation-codes/create/route";
import { handleExportActivationCodesRequest } from "../../app/api/admin/activation-codes/export/route";
import { resetActivationCodeState } from "../../src/lib/activation-codes/repository";
import { redeemActivationCode } from "../../src/lib/activation-codes/redeem-activation-code";

describe("activation code export route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetActivationCodeState();
  });

  it("rejects non-admin export request", async () => {
    const response = await handleExportActivationCodesRequest(new Request("http://localhost/api/admin/activation-codes/export", {
      method: "GET"
    }), {
      requireUser: async () => ({
        id: "user-1",
        email: "user@example.com",
        role: "user"
      })
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.message).toContain("管理员");
  });

  it("exports csv with status and keyword filtering", async () => {
    const createResponse = await handleCreateActivationCodesRequest(new Request("http://localhost/api/admin/activation-codes/create", {
      method: "POST",
      body: JSON.stringify({
        tier: 5000,
        count: 2
      }),
      headers: {
        "content-type": "application/json"
      }
    }), {
      requireUser: async () => ({
        id: "admin-1",
        email: "admin@example.com",
        role: "admin"
      })
    });
    const createPayload = await createResponse.json();
    const targetCode = createPayload.codes[0].code as string;

    redeemActivationCode({
      userId: "user-11",
      code: targetCode
    });

    const response = await handleExportActivationCodesRequest(
      new Request(
        `http://localhost/api/admin/activation-codes/export?status=used&keyword=${encodeURIComponent(targetCode.slice(-4))}`,
        {
          method: "GET"
        }
      ),
      {
        requireUser: async () => ({
          id: "admin-1",
          email: "admin@example.com",
          role: "admin"
        })
      }
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(csv).toContain('"code","tier","status","used_by_user_id","created_at","used_at"');
    expect(csv).toContain(targetCode);
  });
});
