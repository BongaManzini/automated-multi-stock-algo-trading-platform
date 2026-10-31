import React, { useState } from 'react';
import { auth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Shield, Mail, Lock, User, AlertCircle, Info, ArrowRight, Zap } from 'lucide-react';

interface AuthScreenProps {
  onSuccess: () => void;
  onBypass?: () => void;
}

export default function AuthScreen({ onSuccess, onBypass }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        if (!email.trim() || !password) {
          throw new Error('Please fill in all credentials.');
        }
        await signInWithEmailAndPassword(auth, email, password);
        onSuccess();
      } else if (mode === 'signup') {
        if (!name.trim()) {
          throw new Error('Please enter your full name.');
        }
        if (!email.trim() || !password) {
          throw new Error('Please provide an email and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name.trim() });
        onSuccess();
      } else if (mode === 'reset') {
        if (!email.trim()) {
          throw new Error('Please provide your email address.');
        }
        await sendPasswordResetEmail(auth, email);
        setInfo('Password reset instructions have been sent to your email.');
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/user-not-found') errMsg = 'No account associated with this email.';
      if (err.code === 'auth/wrong-password') errMsg = 'Incorrect password.';
      if (err.code === 'auth/email-already-in-use') errMsg = 'This email is already registered.';
      if (err.code === 'auth/invalid-email') errMsg = 'Invalid email address format.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);

    const demoEmail = 'sandbox@quantalgo.com';
    const demoPassword = 'quantalgo123';
    const demoName = 'Sandbox Trader';

    try {
      // Attempt login
      await signInWithEmailAndPassword(auth, demoEmail, demoPassword);
      onSuccess();
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        try {
          // If user doesn't exist or we need to provision/recreate it
          const userCred = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
          await updateProfile(userCred.user, { displayName: demoName });
          onSuccess();
        } catch (createErr: any) {
          setError('Failed to auto-provision sandbox user: ' + createErr.message);
        }
      } else {
        setError('Demo login failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, provider);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'Google authentication failed.';
      if (err.code === 'auth/popup-blocked') {
        errMsg = 'Login popup was blocked by your browser. Please allow popups for this site.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas-bg text-canvas-text flex flex-col justify-center items-center px-4 font-sans antialiased selection:bg-indigo-500/35 selection:text-white relative overflow-hidden">
      {/* Background Decorative Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md bg-panel-bg border border-panel-border rounded-2xl shadow-xl overflow-hidden p-8 relative z-10"
      >
        {/* Header Logo & Title */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-indigo-600/10 border border-indigo-500/25 p-3 rounded-2xl text-indigo-500 dark:text-indigo-400 mb-4 shadow-sm">
            <TrendingUp className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-panel-heading">
            QuantAlgo Paper Trading
          </h2>
          <p className="text-xs text-panel-subtext mt-1.5 max-w-[280px]">
            Access your secure institutional-grade simulation sandbox
          </p>
        </div>

        {/* Info & Error Callouts */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-xl p-3 flex items-start gap-2.5 text-xs overflow-hidden"
            >
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {info && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-500 rounded-xl p-3 flex items-start gap-2.5 text-xs overflow-hidden"
            >
              <Info size={15} className="shrink-0 mt-0.5" />
              <span>{info}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {mode === 'signup' && (
              <motion.div
                key="name-input"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-1.5"
              >
                <label htmlFor="auth-name-field" className="text-xs font-bold text-panel-subtext uppercase tracking-wider block pl-1">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-panel-subtext">
                    <User size={15} />
                  </span>
                  <input
                    id="auth-name-field"
                    type="text"
                    required
                    placeholder="Bonga Manzini"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-panel-inner-bg border border-panel-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-panel-heading placeholder-panel-subtext/60 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </motion.div>
            )}

            <motion.div key="email-input" className="space-y-1.5">
              <label htmlFor="auth-email-field" className="text-xs font-bold text-panel-subtext uppercase tracking-wider block pl-1">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-panel-subtext">
                  <Mail size={15} />
                </span>
                <input
                  id="auth-email-field"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-panel-inner-bg border border-panel-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-panel-heading placeholder-panel-subtext/60 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </motion.div>

            {mode !== 'reset' && (
              <motion.div
                key="password-input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between pl-1">
                  <label htmlFor="auth-password-field" className="text-xs font-bold text-panel-subtext uppercase tracking-wider block">
                    Password
                  </label>
                  {mode === 'signin' && (
                    <button
                      id="auth-forgot-password-btn"
                      type="button"
                      onClick={() => { setMode('reset'); setError(null); }}
                      className="text-[11px] font-bold text-indigo-500 hover:text-indigo-400 transition cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-panel-subtext">
                    <Lock size={15} />
                  </span>
                  <input
                    id="auth-password-field"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-panel-inner-bg border border-panel-border rounded-xl py-2.5 pl-10 pr-4 text-sm text-panel-heading placeholder-panel-subtext/60 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Action Button */}
          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-bold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-indigo-950/20 cursor-pointer mt-6"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'signin' ? 'Sign In to Terminal' : mode === 'signup' ? 'Create Demo Account' : 'Reset Password'}
                </span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {/* Divider & Auxiliary Authentication Providers */}
        {mode === 'signin' && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-[1px] bg-panel-border flex-1" />
              <span className="text-[10px] text-panel-subtext uppercase font-bold tracking-wider">or sign in with</span>
              <div className="h-[1px] bg-panel-border flex-1" />
            </div>

            {/* Google Sign In */}
            <button
              id="auth-google-btn"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full bg-white hover:bg-gray-50 border border-gray-300 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2.5 transition cursor-pointer active:scale-95 shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
              <span>Sign In with Google</span>
            </button>

            {/* Local Bypass Trigger */}
            {onBypass && (
              <button
                id="auth-local-bypass-btn"
                type="button"
                onClick={onBypass}
                disabled={loading}
                className="w-full bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 text-emerald-500 hover:text-emerald-400 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
              >
                <Zap size={14} className="animate-bounce" />
                <span>⚡ Bypass Auth (Local Simulation Mode)</span>
              </button>
            )}

            {/* Quick Sandbox Login Fallback */}
            <button
              id="auth-demo-bypass-btn"
              type="button"
              onClick={handleDemoAccess}
              disabled={loading}
              className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 font-bold py-2 px-4 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>Sign in with Sandbox Email (Fallback)</span>
            </button>
          </div>
        )}

        {/* Secondary Toggles */}
        <div className="border-t border-panel-border mt-6 pt-5 text-center">
          {mode === 'signin' && (
            <p className="text-xs text-panel-subtext">
              New to QuantAlgo?{' '}
              <button
                id="auth-switch-to-signup"
                type="button"
                onClick={() => { setMode('signup'); setError(null); }}
                className="font-bold text-indigo-500 hover:text-indigo-400 transition cursor-pointer"
              >
                Create a demo account
              </button>
            </p>
          )}

          {(mode === 'signup' || mode === 'reset') && (
            <p className="text-xs text-panel-subtext">
              Already have an account?{' '}
              <button
                id="auth-switch-to-signin"
                type="button"
                onClick={() => { setMode('signin'); setError(null); }}
                className="font-bold text-indigo-500 hover:text-indigo-400 transition cursor-pointer"
              >
                Sign in instead
              </button>
            </p>
          )}
        </div>

        {/* Security / Compliance Badge */}
        <div className="flex items-center justify-center gap-1.5 mt-6 text-[10px] text-panel-subtext font-mono">
          <Shield size={11} className="text-emerald-500 animate-pulse" />
          <span>Paper-Trading Sandbox Client</span>
        </div>
      </motion.div>
    </div>
  );
}
