import { describe, expect, it } from "vitest";
import { proxy } from "../../proxy";

function makeRequest(input: {
  pathname: string;
  method?: string;
  cookies?: Array<{ name: string; value: string }>;
}) {
  return {
    method: input.method ?? "GET",
    nextUrl: {
      pathname: input.pathname
    },
    url: `https://example.com${input.pathname}`,
    cookies: {
      getAll() {
        return input.cookies ?? [];
      }
    }
  } as never;
}

describe("proxy api auth gate", () => {
  it("allows anonymous access to health route", async () => {
    const response = await proxy(
      makeRequest({
        pathname: "/api/health"
      })
    );

    expect(response.status).toBe(200);
  });

  it("rejects protected api request when not signed in", async () => {
    const response = await proxy(
      makeRequest({
        pathname: "/api/tasks/create"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.message).toContain("请先登录");
  });

  it("allows protected api request when supabase cookie exists", async () => {
    const response = await proxy(
      makeRequest({
        pathname: "/api/tasks/create",
        cookies: [
          {
            name: "sb-test-auth-token",
            value: "signed"
          }
        ]
      })
    );

    expect(response.status).toBe(200);
  });
});
