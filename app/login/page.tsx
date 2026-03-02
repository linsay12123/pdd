type LoginPageProps = {
  searchParams?: Promise<{
    redirect?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const redirectTarget = resolvedSearchParams.redirect ?? "/workspace";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px"
      }}
    >
      <section
        style={{
          width: "min(100%, 480px)",
          background: "#fffaf0",
          border: "1px solid #d7cfbe",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 18px 40px rgba(34, 34, 34, 0.08)"
        }}
      >
        <p style={{ margin: 0, fontSize: "12px", letterSpacing: "0.08em" }}>
          账户登录
        </p>
        <h1 style={{ marginTop: "8px", marginBottom: "12px" }}>
          先登录，再开始写作
        </h1>
        <p style={{ marginTop: 0, lineHeight: 1.6 }}>
          这里先放登录入口占位。后面接上真实的 Supabase 登录后，登录成功会回到：
          <strong> {redirectTarget}</strong>
        </p>
      </section>
    </main>
  );
}
