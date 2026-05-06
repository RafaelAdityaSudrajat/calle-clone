import type { ComponentType } from "react";

export interface MenuItem {
  icon: ComponentType<any>;
  label: string;
  active?: boolean;
  href: string;
}
