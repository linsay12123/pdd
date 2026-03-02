import { beforeEach, describe, expect, it } from "vitest";
import { POST as createActivationCodes } from "../../app/api/admin/activation-codes/create/route";
import { POST as redeemCodeRoute } from "../../app/api/quota/redeem-code/route";
import { GET as exportActivationCodes } from "../../app/api/admin/activation-codes/export/route";
import { resetActivationCodeState } from "../../src/lib/activation-codes/repository";

describe("activation code export route", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetActivationCodeState();
  });

  it("rejects non-admin export request", async () => {
    const response = await exportActivationCodes(
      new Request("http://localhost/api/admin/activation-codes/export", {
        method: "GET"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.message).toContain("管理员");
  });

  it("exports csv with status and keyword filtering", async () => {
    const createResponse = await createActivationCodes(
      new Request("http://localhost/api/admin/activation-codes/create", {
        method: "POST",
        body: JSON.stringify({
          tier: 5000,
          count: 2
        }),
        headers: {
          "content-type": "application/json",
          cookie: "aw-role=admin"
        }
      })
    );
    const createPayload = await createResponse.json();
    const targetCode = createPayload.codes[0].code as string;

    await redeemCodeRoute(
      new Request("http://localhost/api/quota/redeem-code", {
        method: "POST",
        body: JSON.stringify({
          userId: "user-11",
          code: targetCode
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    const response = await exportActivationCodes(
      new Request(
        `http://localhost/api/admin/activation-codes/export?status=used&keyword=${encodeURIComponent(targetCode.slice(-4))}`,
        {
          method: "GET",
          headers: {
            cookie: "aw-role=admin"
          }
        }
      )
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(csv).toContain('"code","tier","status","used_by_user_id","created_at","used_at"');
    expect(csv).toContain(targetCode);
  });
});
