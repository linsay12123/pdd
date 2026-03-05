import { basename } from "node:path";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireCurrentSessionUser } from "@/src/lib/auth/current-user";
import { readTaskArtifact } from "@/src/lib/storage/task-artifacts";
import { createDownloadSignature } from "@/src/lib/storage/signed-url";
import { findOwnedTaskOutputByStoragePath } from "@/src/lib/tasks/task-output-store";
import type { SessionUser } from "@/src/types/auth";

type StorageDownloadDependencies = {
  requireUser?: () => Promise<SessionUser>;
};

export async function handleStorageDownloadRequest(
  request: Request,
  dependencies: StorageDownloadDependencies = {}
) {
  let user: SessionUser;

  try {
    user = await (dependencies.requireUser ?? requireCurrentSessionUser)();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "请先登录后再下载文件。"
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const storagePath = url.searchParams.get("path")?.trim() ?? "";
  const urlExpiresAt = url.searchParams.get("expires")?.trim() ?? "";
  const signature = url.searchParams.get("signature")?.trim() ?? "";

  if (!storagePath || !signature || !urlExpiresAt) {
    return NextResponse.json(
      {
        ok: false,
        message: "下载链接不完整。"
      },
      { status: 400 }
    );
  }

  const parsedUrlExpiresAt = Date.parse(urlExpiresAt);
  if (Number.isNaN(parsedUrlExpiresAt)) {
    return NextResponse.json(
      {
        ok: false,
        message: "下载链接已损坏，请重新获取下载链接。"
      },
      { status: 400 }
    );
  }

  if (Date.now() > parsedUrlExpiresAt) {
    return NextResponse.json(
      {
        ok: false,
        message: "下载链接已过期，请重新获取后再下载。"
      },
      { status: 403 }
    );
  }

  const output = await findOwnedTaskOutputByStoragePath({
    storagePath,
    userId: user.id
  });

  if (!output) {
    return NextResponse.json(
      {
        ok: false,
        message: "你无权下载这个文件。"
      },
      { status: 403 }
    );
  }

  const expectedSignature = createDownloadSignature({
    userId: user.id,
    storagePath: output.storagePath,
    expiresAt: output.expiresAt,
    urlExpiresAt
  });

  if (!safeSignatureEqual(signature, expectedSignature)) {
    return NextResponse.json(
      {
        ok: false,
        message: "下载签名已经失效，请重新获取下载链接。"
      },
      { status: 403 }
    );
  }

  if (output.expired) {
    return NextResponse.json(
      {
        ok: false,
        message: "文件已过期，当前不能再下载。"
      },
      { status: 410 }
    );
  }

  try {
    const file = await readTaskArtifact({
      storagePath: output.storagePath
    });

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${basename(output.storagePath)}"`
      }
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "文件暂时不存在，请稍后再试。"
      },
      { status: 404 }
    );
  }
}

export async function GET(request: Request) {
  return handleStorageDownloadRequest(request);
}

function safeSignatureEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}
