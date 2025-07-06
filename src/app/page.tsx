import { redirect } from 'next/navigation';

export default function Home() {
  // Use Next.js server-side redirect instead of client-side
  redirect('/dashboard');
}
