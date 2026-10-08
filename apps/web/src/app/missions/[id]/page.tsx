import { redirect } from 'next/navigation';

/** Link target used in Google Classroom assignments. */
export default async function MissionLink({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/student/missions/${id}`);
}
