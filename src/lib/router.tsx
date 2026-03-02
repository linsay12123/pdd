"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type RouterLinkProps = PropsWithChildren<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    to: string;
  }
>;

export function Link({ to, children, ...props }: RouterLinkProps) {
  return (
    <NextLink href={to} {...props}>
      {children}
    </NextLink>
  );
}

export function useNavigate() {
  const router = useRouter();
  return (to: string) => {
    router.push(to);
  };
}
