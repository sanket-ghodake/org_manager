'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const [branding, setBranding] = useState({ name: 'SG Forge', logo: '' });

  // Clear any stale or expired session cookie when landing on login page and fetch branding
  useEffect(() => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    fetch('/api/branding')
      .then(res => res.json())
      .then(data => setBranding(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (branding.name) {
      document.title = `${branding.name} — Corporate Portal`;
    }
  }, [branding.name]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        const searchParams = new URLSearchParams(window.location.search);
        const redirectBack = searchParams.get('redirect_back') || searchParams.get('next') || '';

        // Use replace so back button doesn't loop back to login
        if (data.user && data.user.isPasswordChanged === false) {
          router.replace('/force-reset' + (redirectBack ? `?redirect_back=${encodeURIComponent(redirectBack)}` : ''));
        } else if (redirectBack) {
          router.replace(redirectBack);
        } else {
          router.replace('/');
        }
      } else {
        setError(data.error || 'Login failed.');
        setIsLoading(false);
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090d16] text-[#f9fafb] relative overflow-hidden font-sans">
      {/* Background ambient glowing blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#ff007f]/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00ffcc]/10 blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl relative z-10 transition-all duration-300 hover:border-white/20">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-xl bg-gradient-to-tr from-[#ff007f] to-[#2563eb] text-white font-black text-2xl tracking-wider mb-4 shadow-lg items-center gap-2">
            {branding.logo ? (
              <div 
                className="w-8 h-8 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-current [&>svg]:text-white overflow-hidden flex-shrink-0"
                dangerouslySetInnerHTML={{ __html: branding.logo }} 
              />
            ) : null}
            <span>{branding.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-white to-[#00ffcc] bg-clip-text text-transparent">
            Corporate Portal
          </h1>
          <p className="text-[#94a3b8] mt-2 text-sm">
            Sign in to access your administrative tools
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00ffcc] focus:border-transparent transition-all duration-200"
              placeholder="name@company.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#94a3b8] mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00ffcc] focus:border-transparent transition-all duration-200"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#00ffcc] hover:from-[#3b82f6] hover:to-[#55ffd8] text-white font-semibold shadow-lg shadow-blue-500/25 transition-all duration-200 transform active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Authenticate'
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/5 pt-6 text-xs text-[#64748b]">
          <p className="mt-2 text-[#00ffcc]/70">Secure authentication powered by bcrypt & session tokens</p>
        </div>
      </div>
    </div>
  );
}
