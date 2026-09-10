'use client';
import { handleSignOut } from '@/app/dashboard/actions';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  return (
    <button
      onClick={() => handleSignOut()}
      data-test="logout-button"
      className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 rounded-lg transition-all duration-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-100"
    >
      <span>Log out</span>
      <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-1" />
    </button>
  );
}
