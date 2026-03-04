import { Users, ShieldCheck, Snowflake } from "lucide-react";
import {
  listAdminUsers,
  type AdminUserSummary
} from "@/src/lib/admin/users";

function formatAdminDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(date).replace(/\//g, "-");
}

export function UserTableView({ users }: { users: AdminUserSummary[] }) {
  return (
    <section className="bg-brand-900/30 p-8 rounded-2xl border border-white/5">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-cream-50 flex items-center gap-2">
            <Users className="w-5 h-5 text-gold-400" />
            用户管理
          </h2>
          <p className="text-sm text-brand-700 mt-2">
            这里显示真实注册用户、当前余额和账号状态，方便你先做运营排查和人工核对。
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-brand-950/50 px-4 py-3 text-right min-w-28">
          <div className="text-xs text-brand-700">当前用户数</div>
          <div className="text-2xl font-bold text-gold-400 font-mono">
            {users.length}
          </div>
        </div>
      </div>

      {users.length > 0 ? (
        <div className="grid gap-4">
          {users.map((user) => (
            <article
              key={user.id}
              className="rounded-2xl border border-white/10 bg-brand-950/40 p-5 grid gap-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="grid gap-1">
                  <div className="text-lg font-semibold text-cream-50">
                    {user.displayName}
                  </div>
                  <div className="text-sm text-brand-700">{user.email}</div>
                  <div className="text-xs text-brand-700">
                    注册时间：{formatAdminDate(user.createdAt)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-400">
                    {user.role === "admin" ? "管理员" : "普通用户"}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium border ${
                      user.status === "frozen"
                        ? "border-blue-400/30 bg-blue-400/10 text-blue-300"
                        : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    }`}
                  >
                    {user.status === "frozen" ? "已冻结" : "正常"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="text-xs text-brand-700">当前可用积分</div>
                  <div className="text-xl font-bold text-cream-50 font-mono">
                    {user.currentQuota.toLocaleString("en-US")}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="text-xs text-brand-700">充值积分</div>
                  <div className="text-xl font-bold text-cream-50 font-mono">
                    {user.rechargeQuota.toLocaleString("en-US")}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-brand-900/60 px-4 py-3">
                  <div className="text-xs text-brand-700">冻结积分</div>
                  <div className="text-xl font-bold text-cream-50 font-mono">
                    {user.frozenQuota.toLocaleString("en-US")}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-brand-700">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-brand-900/60 px-3 py-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                  账号角色：{user.role === "admin" ? "管理员" : "普通用户"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-brand-900/60 px-3 py-1">
                  <Snowflake className="w-3.5 h-3.5 text-blue-300" />
                  {user.status === "frozen" ? "当前账号已被冻结" : "当前账号状态正常"}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-brand-950/40 px-5 py-6 text-sm text-brand-700 leading-6">
          当前还没有读取到任何真实用户数据。常见原因有两个：
          <br />
          1. 线上数据库里还没有用户。
          <br />
          2. 当前环境还没切到真实数据库模式。
        </div>
      )}
    </section>
  );
}

export async function UserTable() {
  const users = await listAdminUsers();

  return <UserTableView users={users} />;
}
