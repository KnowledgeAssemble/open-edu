import { type ReactNode } from 'react';
import { cn } from '@open-edu/design-system';

interface StudioLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  className?: string;
}

export function StudioLayout({ children, sidebar, className }: StudioLayoutProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 overflow-hidden', className)}>
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">{children}</main>
      {sidebar}
    </div>
  );
}
