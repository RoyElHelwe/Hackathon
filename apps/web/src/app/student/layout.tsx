import { RoleGate } from '@/components/app/role-gate';
import { StudentShell } from '@/components/app/student-shell';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate roles={['STUDENT']}>
      <StudentShell>{children}</StudentShell>
    </RoleGate>
  );
}
