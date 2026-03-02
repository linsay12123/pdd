export function resolveRequestUserId(request: Request) {
  const userIdHeader = request.headers.get("x-user-id")?.trim();

  if (userIdHeader) {
    return userIdHeader;
  }

  const url = new URL(request.url);
  const userIdQuery = url.searchParams.get("userId")?.trim();

  if (userIdQuery) {
    return userIdQuery;
  }

  return null;
}
