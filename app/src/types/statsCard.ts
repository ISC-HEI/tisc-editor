import { ReactNode } from 'react';

export type StatCardColor = 'blue' | 'purple' | 'emerald';

export interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: number;
  color: StatCardColor;
}
