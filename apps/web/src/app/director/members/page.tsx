'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/app/adult-shell';
import { ErrorState, PageSkeleton } from '@/components/app/states';
import { InviteTeacher } from '@/components/director/invite-teacher';
import { MemberGroups } from '@/components/director/member-groups';
import { PendingMembers } from '@/components/director/pending-members';
import { SchoolCodeCard } from '@/components/director/school-code-card';
import { useToast } from '@/components/director/toast';
import { useSchoolId } from '@/components/director/use-school';
import { useApi, useMe } from '@/lib/hooks';
import type { School } from '@/components/director/types';

export default function MembersPage() {
  const t = useTranslations('director.members');
  const me = useMe();
  const schoolId = useSchoolId();
  const school = useApi<School>(schoolId ? `/schools/${schoolId}` : null);
  const { toast, node } = useToast();

  if (me.isLoading) return <PageSkeleton />;
  if (!schoolId) return <ErrorState onRetry={() => me.refetch()} />;

  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <PendingMembers schoolId={schoolId} onToast={toast} />
          <MemberGroups schoolId={schoolId} />
        </div>
        <div className="space-y-5">
          <InviteTeacher schoolId={schoolId} />
          {school.data && <SchoolCodeCard code={school.data.schoolCode} />}
        </div>
      </div>
      {node}
    </div>
  );
}
