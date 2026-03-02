"use client";

import { useEffect, useMemo, useState } from "react";

type ActivationCodeStatus = "unused" | "used";

type ActivationCodeItem = {
  code: string;
  tier: 1000 | 5000 | 10000 | 20000;
  quotaAmount: number;
  createdAt: string;
  usedAt: string | null;
  usedByUserId: string | null;
};

const panelStyle = {
  padding: "18px",
  borderRadius: "18px",
  border: "1px solid #d7cfbe",
  background: "#ffffff"
} as const;

export function ActivationCodePanel() {
  const [tier, setTier] = useState<1000 | 5000 | 10000 | 20000>(1000);
  const [count, setCount] = useState<number>(1);
  const [status, setStatus] = useState<"all" | ActivationCodeStatus>("all");
  const [keyword, setKeyword] = useState("");
  const [codes, setCodes] = useState<ActivationCodeItem[]>([]);
  const [lastCreated, setLastCreated] = useState<ActivationCodeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function fetchCodes(options?: {
    status?: "all" | ActivationCodeStatus;
    keyword?: string;
  }) {
    setLoading(true);
    setMessage(null);

    try {
      const params = new URLSearchParams();
      const nextStatus = options?.status ?? status;
      const nextKeyword = options?.keyword ?? keyword;

      if (nextStatus !== "all") {
        params.set("status", nextStatus);
      }

      if (nextKeyword.trim()) {
        params.set("keyword", nextKeyword.trim());
      }

      const query = params.toString();
      const response = await fetch(
        `/api/admin/activation-codes/list${query ? `?${query}` : ""}`,
        {
          method: "GET"
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? "加载激活码列表失败");
      }

      setCodes(payload.codes ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载激活码列表失败");
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateCodes() {
    setCreating(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/activation-codes/create", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          tier,
          count
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message ?? "生成激活码失败");
      }

      const createdCodes = (payload.codes ?? []) as ActivationCodeItem[];
      setLastCreated(createdCodes);
      setMessage(`本次成功生成 ${createdCodes.length} 个激活码`);
      await fetchCodes();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成激活码失败");
    } finally {
      setCreating(false);
    }
  }

  async function handleCopyAll() {
    const text = lastCreated.map((item) => item.code).join("\n");

    if (!text) {
      setMessage("当前没有可复制的新激活码");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setMessage("已复制本次生成的全部激活码");
    } catch {
      setMessage("复制失败，请手动复制");
    }
  }

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();

    if (status !== "all") {
      params.set("status", status);
    }

    if (keyword.trim()) {
      params.set("keyword", keyword.trim());
    }

    const query = params.toString();
    return `/api/admin/activation-codes/export${query ? `?${query}` : ""}`;
  }, [keyword, status]);

  return (
    <section style={panelStyle}>
      <h2 style={{ marginTop: 0, marginBottom: "8px" }}>激活码管理</h2>
      <p style={{ marginTop: 0, color: "#5a4d34", lineHeight: 1.7 }}>
        管理员可以在这里批量生成、筛选查看、导出激活码。单次最多生成 50 个。
      </p>

      <div
        style={{
          display: "grid",
          gap: "12px",
          padding: "12px",
          borderRadius: "12px",
          background: "#f8f3e8",
          marginBottom: "12px"
        }}
      >
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "1fr 1fr auto" }}>
          <label style={{ display: "grid", gap: "4px", fontSize: "13px" }}>
            档位
            <select
              value={tier}
              onChange={(event) =>
                setTier(Number(event.target.value) as 1000 | 5000 | 10000 | 20000)
              }
            >
              <option value={1000}>1000</option>
              <option value={5000}>5000</option>
              <option value={10000}>10000</option>
              <option value={20000}>20000</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "4px", fontSize: "13px" }}>
            数量（1~50）
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(event) => setCount(Number(event.target.value || 0))}
            />
          </label>

          <button
            type="button"
            onClick={handleCreateCodes}
            disabled={creating}
            style={{ alignSelf: "end", minHeight: "36px" }}
          >
            {creating ? "生成中..." : "生成新激活码"}
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button type="button" onClick={handleCopyAll}>
            复制全部
          </button>
          <a href={exportHref} download>
            导出CSV
          </a>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "8px",
          padding: "12px",
          borderRadius: "12px",
          background: "#faf6ec",
          marginBottom: "12px"
        }}
      >
        <strong>筛选状态</strong>
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "150px 1fr auto" }}>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | ActivationCodeStatus)}
          >
            <option value="all">全部</option>
            <option value="unused">未使用</option>
            <option value="used">已使用</option>
          </select>
          <input
            type="text"
            placeholder="按激活码关键词搜索"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <button type="button" onClick={() => void fetchCodes()}>
            刷新列表
          </button>
        </div>
      </div>

      {message ? (
        <div style={{ marginBottom: "10px", color: "#5a4d34" }}>{message}</div>
      ) : null}

      {loading ? (
        <div>激活码列表加载中...</div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {codes.map((code) => (
            <article
              key={code.code}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 0.5fr 0.6fr 1fr",
                gap: "8px",
                padding: "10px",
                borderRadius: "10px",
                background: "#f7f1e4"
              }}
            >
              <span>{code.code}</span>
              <span>{code.tier}</span>
              <span>{code.usedByUserId ? "已使用" : "未使用"}</span>
              <span>{code.usedByUserId ?? "待兑换"}</span>
            </article>
          ))}
          {codes.length === 0 ? <div>当前没有符合筛选条件的激活码</div> : null}
        </div>
      )}
    </section>
  );
}
