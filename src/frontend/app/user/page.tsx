import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { fetchUserDashboardData } from '../../../backend/services/userService';
import UserLaunchpad from '../components/UserLaunchpad';
import { decryptSession } from '../../../backend/auth/sessionManager';

export default async function UserDashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session_token');

  if (!sessionCookie) {
    redirect('/login');
  }

  let session: any = null;
  try {
    session = await decryptSession(sessionCookie.value);
  } catch (error) {
    redirect('/login');
  }

  if (!session || !session.id) {
    redirect('/login');
  }

  // Enforce password changes on the server side
  if (session.isPasswordChanged === false) {
    redirect('/force-reset');
  }

  // Fetch standard user datasets directly on the server
  let dashboardData;
  try {
    dashboardData = await fetchUserDashboardData(session.id);
  } catch (error) {
    console.error('Failed to load user portal data server-side:', error);
    redirect('/login');
  }

  const isAdmin = ['super_admin', 'admin', 'read_only_admin'].includes(session.role);

  return (
    <UserLaunchpad initialData={dashboardData} isAdmin={isAdmin} />
  );
}
