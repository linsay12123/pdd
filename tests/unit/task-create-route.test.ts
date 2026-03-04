import { describe, expect, it } from "vitest";
import { handleTaskCreateRequest } from "../../app/api/tasks/create/route";

describe("task create route", () => {
  it("rejects unauthenticated users", async () => {
    const response = await handleTaskCreateRequest(
      new Request("http://localhost/api/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specialRequirements: "Focus on finance."
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        requireUser: async () => {
          throw new Error("AUTH_REQUIRED");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.message).toContain("登录");
  });

  it("rejects users with insufficient quota", async () => {
    const response = await handleTaskCreateRequest(
      new Request("http://localhost/api/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specialRequirements: "Focus on finance."
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        requireUser: async () => ({
          id: "user-low",
          email: "low@example.com",
          role: "user"
        }),
        createTask: async () => {
          throw new Error("INSUFFICIENT_QUOTA");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("积分不足");
  });

  it("checks balance and creates task without freezing quota", async () => {
    const response = await handleTaskCreateRequest(
      new Request("http://localhost/api/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specialRequirements: "Focus on ASEAN banking examples.",
          targetWordCount: 2200,
          citationStyle: "MLA"
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        requireUser: async () => ({
          id: "user-ok",
          email: "ok@example.com",
          role: "user"
        }),
        createTask: async ({ user, specialRequirements }) => ({
          task: {
            id: "task-created-1",
            userId: user.id,
            status: "created",
            targetWordCount: null,
            citationStyle: null,
            specialRequirements,
            analysisStatus: "pending",
            analysisModel: null,
            analysisCompletedAt: null,
            analysisSnapshot: null
          },
          frozenQuota: 0
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.task.status).toBe("created");
    expect(payload.task.targetWordCount).toBeNull();
    expect(payload.task.citationStyle).toBeNull();
    expect(payload.task.specialRequirements).toContain("ASEAN banking");
    expect(payload.frozenQuota).toBe(0);
  });

  it("returns a clear message when the database schema is still on the old version", async () => {
    const response = await handleTaskCreateRequest(
      new Request("http://localhost/api/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specialRequirements: "Focus on ASEAN banking examples."
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        requireUser: async () => ({
          id: "user-ok",
          email: "ok@example.com",
          role: "user"
        }),
        createTask: async () => {
          throw new Error("DATABASE_SCHEMA_OUT_OF_SYNC");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.message).toContain("数据库");
    expect(payload.message).toContain("升级");
  });

  it("returns 503 when the official database pipeline is not available", async () => {
    const response = await handleTaskCreateRequest(
      new Request("http://localhost/api/tasks/create", {
        method: "POST",
        body: JSON.stringify({
          specialRequirements: "Focus on ASEAN banking examples."
        }),
        headers: {
          "content-type": "application/json"
        }
      }),
      {
        requireUser: async () => ({
          id: "user-ok",
          email: "ok@example.com",
          role: "user"
        }),
        createTask: async () => {
          throw new Error("REAL_PERSISTENCE_REQUIRED");
        }
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.message).toContain("正式数据库");
  });
});
