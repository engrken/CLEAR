import { redirect } from 'next/navigation';

export default function RootPage() {
  // Automatically routes base domain visitors to your public dashboard
  redirect('/admin');
}