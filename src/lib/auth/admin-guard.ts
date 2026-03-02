export function isAdminRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMap = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((result, cookieItem) => {
      const separatorIndex = cookieItem.indexOf("=");

      if (separatorIndex === -1) {
        return result;
      }

      const key = cookieItem.slice(0, separatorIndex).trim();
      const value = cookieItem.slice(separatorIndex + 1).trim();
      result[key] = value;
      return result;
    }, {});

  return cookieMap["aw-role"] === "admin";
}
