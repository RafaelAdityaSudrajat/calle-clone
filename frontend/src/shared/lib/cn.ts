import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Gabungkan class kondisional dan selesaikan konflik utility Tailwind.
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
