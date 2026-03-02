import { FileTable } from "@/src/components/admin/file-table";
import { FinanceSummary } from "@/src/components/admin/finance-summary";
import { OrderTable } from "@/src/components/admin/order-table";
import { PricingEditor } from "@/src/components/admin/pricing-editor";
import { TaskTable } from "@/src/components/admin/task-table";
import { UserTable } from "@/src/components/admin/user-table";

export default function AdminPage() {
  return (
    <div
      style={{
        display: "grid",
        gap: "18px"
      }}
    >
      <section
        style={{
          padding: "18px",
          borderRadius: "18px",
          border: "1px solid #d7cfbe",
          background: "#fffaf1"
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "8px" }}>运营中控后台</h2>
        <p style={{ margin: 0, color: "#5a4d34" }}>
          这里是后台总览。你可以直接在下面查看用户、订单、任务、文件、价格和财务。
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px"
        }}
      >
        <UserTable />
        <OrderTable />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px"
        }}
      >
        <TaskTable />
        <FileTable />
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "18px"
        }}
      >
        <PricingEditor />
        <FinanceSummary />
      </section>
    </div>
  );
}
