"use client";

import type { LinkComponent } from "@eguardimmo/ui";
import Link from "next/link";
import { toRealHref } from "./paths";

export const ConfieLink: LinkComponent = ({ href, ...props }) => <Link {...props} href={toRealHref(href)} />;
