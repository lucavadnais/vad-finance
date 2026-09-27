import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Used by shadcn-vue components
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
