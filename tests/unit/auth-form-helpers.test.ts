import { describe, expect, it } from "vitest";
import {
  getAuthErrorMessage,
  normalizeRedirectTarget,
  validateRegisterInput
} from "../../src/lib/auth/auth-form";

describe("auth form helpers", () => {
  it("normalizes unsafe redirect targets back to the workspace", () => {
    expect(normalizeRedirectTarget("/tasks")).toBe("/tasks");
    expect(normalizeRedirectTarget("https://evil.example.com")).toBe(
      "/workspace"
    );
    expect(normalizeRedirectTarget("javascript:alert(1)")).toBe("/workspace");
    expect(normalizeRedirectTarget("")).toBe("/workspace");
  });

  it("validates the register form before submit", () => {
    expect(
      validateRegisterInput({
        displayName: "",
        email: "client@example.com",
        password: "12345678",
        confirmPassword: "12345678"
      })
    ).toBe("请输入用户名");

    expect(
      validateRegisterInput({
        displayName: "Jeffo",
        email: "client@example.com",
        password: "1234567",
        confirmPassword: "1234567"
      })
    ).toBe("密码至少需要 8 位");

    expect(
      validateRegisterInput({
        displayName: "Jeffo",
        email: "client@example.com",
        password: "12345678",
        confirmPassword: "87654321"
      })
    ).toBe("两次输入的密码不一致");

    expect(
      validateRegisterInput({
        displayName: "Jeffo",
        email: "client@example.com",
        password: "12345678",
        confirmPassword: "12345678"
      })
    ).toBeNull();
  });

  it("maps auth errors into readable Chinese messages", () => {
    expect(
      getAuthErrorMessage(
        { message: "Invalid login credentials" },
        "login"
      )
    ).toBe("邮箱或密码不正确");

    expect(
      getAuthErrorMessage(
        { message: "User already registered" },
        "register"
      )
    ).toBe("这个邮箱已经注册过了，请直接登录");

    expect(getAuthErrorMessage(null, "login")).toBe("登录失败，请稍后再试");
  });
});
