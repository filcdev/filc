import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@filcdev/ui/components/card';
import { Skeleton } from '@filcdev/ui/components/skeleton';
import type { ReactNode } from 'react';

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: number;
  isLoading?: boolean;
};

export function StatCard({ icon, label, value, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <div className="text-3xl font-semibold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
