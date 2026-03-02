import { expireTaskOutputs } from "@/src/lib/tasks/repository";

export async function expireTaskAssets({
  asOf
}: {
  asOf?: string;
} = {}) {
  return expireTaskOutputs({
    asOf
  });
}
