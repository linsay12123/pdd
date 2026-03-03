import { beforeEach, describe, expect, it, vi } from "vitest";

const setSpy = vi.fn();
const getAllSpy = vi.fn(() => [{ name: "sb-test-auth-token", value: "token" }]);
const createServerClientSpy = vi.fn((_url: string, _anonKey: string, options: unknown) => options);

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: getAllSpy,
    set: setSpy
  }))
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientSpy
}));

describe("supabase server clients", () => {
  beforeEach(() => {
    setSpy.mockClear();
    getAllSpy.mockClear();
    createServerClientSpy.mockClear();
  });

  it("builds a readonly page client that never writes cookies", async () => {
    const { createSupabaseReadonlyServerClient } = await import(
      "../../src/lib/supabase/server-readonly"
    );

    const options = (await createSupabaseReadonlyServerClient()) as unknown as {
      cookies: {
        getAll: () => unknown[];
        setAll: (values: Array<{ name: string; value: string; options?: object }>) => void;
      };
    };

    expect(createServerClientSpy).toHaveBeenCalledTimes(1);

    options.cookies.getAll();
    options.cookies.setAll([{ name: "sb-test-auth-token", value: "next-token" }]);

    expect(getAllSpy).toHaveBeenCalledTimes(1);
    expect(setSpy).not.toHaveBeenCalled();
  });

  it("builds a route client that can write cookies", async () => {
    const { createSupabaseRouteServerClient } = await import(
      "../../src/lib/supabase/server-route"
    );

    const options = (await createSupabaseRouteServerClient()) as unknown as {
      cookies: {
        setAll: (values: Array<{ name: string; value: string; options?: object }>) => void;
      };
    };

    expect(createServerClientSpy).toHaveBeenCalledTimes(1);

    options.cookies.setAll([{ name: "sb-test-auth-token", value: "next-token" }]);

    expect(setSpy).toHaveBeenCalledWith("sb-test-auth-token", "next-token", undefined);
  });
});
