'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ForceResetPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Read the email from the current session token if possible
    const cookies = document.cookie.split(';');
    const sessionCookie = cookies.find(c => c.trim().startsWith('session_token='));
    if (sessionCookie) {
      try {
        const val = sessionCookie.split('=')[1];
        const parsed = JSON.parse(atob(val));
        setUserEmail(parsed.email);
      } catch (err) {
        // Fallback
      }
    }
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1200);
      } else {
        setError(data.error || 'Password update failed.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f051d] text-[#f9fafb] relative overflow-hidden font-sans">
      {/* Background ambient glowing blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#ff007f]/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00ffcc]/10 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-amber-500/10 text-amber-500 mb-4 border border-amber-500/20 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-amber-400 bg-clip-text text-transparent">
            Security Notice
          </h1>
          <p className="text-[#94a3b8] mt-2 text-sm">
            Forced Password Reset Required
          </p>
          {userEmail && (
            <span className="inline-block mt-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-[#00ffcc]">
              Account: {userEmail}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg text-sm">
            Password updated successfully! Redirecting to dashboard...
          </div>
        )}

        <form onSubmit={handlePasswordReset} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              New Secure Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
              placeholder="At least 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              Confirm Secure Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
              placeholder="Confirm new password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold shadow-lg shadow-orange-500/20 transition-all duration-200 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Reset Password & Continue'
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6 text-xs text-[#64748b]">
          <p>This flow is intercepted by `authGuard.ts` middleware</p>
          <p className="mt-2 text-[#00ffcc]">Status flag: `is_password_changed = false`</p>
        </div>
      </div>
    </div>
  );
}
