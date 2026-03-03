import { describe, expect, it } from "vitest";
import { decideWorkspaceEntry } from "../../src/lib/auth/workspace-entry";

describe("workspace entry decisions", () => {
  it("allows rendering when the session is ready", () => {
    expect(
      decideWorkspaceEntry({
        hasSessionCookie: true,
        sessionResolution: {
          status: "ready",
          user: {
            id: "user-1",
            email: "user@example.com",
            role: "user"
          }
        }
      })
    ).toEqual({ kind: "allow" });
  });

  it("sends the user to auth complete when a session cookie exists but the session is not ready", () => {
    expect(
      decideWorkspaceEntry({
        hasSessionCookie: true,
        sessionResolution: {
          status: "profile_missing",
          authUserId: "user-3",
          email: "user@example.com"
        }
      })
    ).toEqual({
      kind: "redirect",
      to: "/auth/complete?next=%2Fworkspace"
    });
  });

  it("sends anonymous users back to login even if the browser still has old auth cookies", () => {
    expect(
      decideWorkspaceEntry({
        hasSessionCookie: true,
        sessionResolution: {
          status: "anonymous"
        }
      })
    ).toEqual({
      kind: "redirect",
      to: "/login?redirect=%2Fworkspace"
    });
  });

  it("sends the user back to login when there is no session cookie", () => {
    expect(
      decideWorkspaceEntry({
        hasSessionCookie: false,
        sessionResolution: {
          status: "anonymous"
        }
      })
    ).toEqual({
      kind: "redirect",
      to: "/login?redirect=%2Fworkspace"
    });
  });

  it("sends frozen users back to login with a readable message", () => {
    expect(
      decideWorkspaceEntry({
        hasSessionCookie: true,
        sessionResolution: {
          status: "frozen",
          user: {
            id: "user-2",
            email: "frozen@example.com",
            role: "user"
          }
        }
      })
    ).toEqual({
      kind: "redirect",
      to: "/login?message=%E5%BD%93%E5%89%8D%E8%B4%A6%E5%8F%B7%E5%B7%B2%E8%A2%AB%E5%86%BB%E7%BB%93%EF%BC%8C%E8%AF%B7%E8%81%94%E7%B3%BB%E5%AE%A2%E6%9C%8D%E6%94%AF%E6%8C%81%E5%9B%A2%E9%98%9F%E5%A4%84%E7%90%86%E3%80%82"
    });
  });
});
