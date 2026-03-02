import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "Task creation API stub is in place. Upload processing will be wired next."
    },
    { status: 501 }
  );
}
