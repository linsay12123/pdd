import { beforeEach, describe, expect, it } from "vitest";
import { resetActivationCodeState } from "../../src/lib/activation-codes/repository";
import { GET as listActivationCodes } from "../../app/api/admin/activation-codes/list/route";
import { POST as createActivationCodes } from "../../app/api/admin/activation-codes/create/route";
import { POST as redeemCodeRoute } from "../../app/api/quota/redeem-code/route";

describe("activation code admin routes", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    resetActivationCodeState();
  });

  it("rejects non-admin requests", async () => {
    const response = await createActivationCodes(
      new Request("http://localhost/api/admin/activation-codes/create", {
        method: "POST",
        body: JSON.stringify({
          tier: 1000,
          count: 1
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.message).toContain("管理员");
  });

  it("creates and lists activation codes for admin requests", async () => {
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

    expect(createResponse.status).toBe(200);
    expect(createPayload.codes).toHaveLength(2);
    expect(createPayload.codes[0].code).not.toBe(createPayload.codes[1].code);

    const listResponse = await listActivationCodes(
      new Request("http://localhost/api/admin/activation-codes/list", {
        method: "GET",
        headers: {
          cookie: "aw-role=admin"
        }
      })
    );
    const listPayload = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listPayload.codes).toHaveLength(2);
    expect(listPayload.codes[0]).toMatchObject({
      tier: 5000
    });
  });

  it("rejects generation count larger than 50", async () => {
    const response = await createActivationCodes(
      new Request("http://localhost/api/admin/activation-codes/create", {
        method: "POST",
        body: JSON.stringify({
          tier: 10000,
          count: 51
        }),
        headers: {
          "content-type": "application/json",
          cookie: "aw-role=admin"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("最多一次生成 50 个");
  });

  it("filters list by status and keyword", async () => {
    const createResponse = await createActivationCodes(
      new Request("http://localhost/api/admin/activation-codes/create", {
        method: "POST",
        body: JSON.stringify({
          tier: 1000,
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
          userId: "user-88",
          code: targetCode
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    );

    const usedResponse = await listActivationCodes(
      new Request(
        `http://localhost/api/admin/activation-codes/list?status=used&keyword=${encodeURIComponent(targetCode.slice(-4))}`,
        {
          method: "GET",
          headers: {
            cookie: "aw-role=admin"
          }
        }
      )
    );
    const usedPayload = await usedResponse.json();

    expect(usedResponse.status).toBe(200);
    expect(usedPayload.codes).toHaveLength(1);
    expect(usedPayload.codes[0].code).toBe(targetCode);
  });
});
