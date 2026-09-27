import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Used by shadcn-vue components
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
