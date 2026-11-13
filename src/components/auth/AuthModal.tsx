import React, { useState, useRef } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Calendar,
  Phone,
  MapPin,
  Sparkles,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  Globe,
  Shield,
  Smartphone,
} from 'lucide-react';
import {
  registerMotherlandUser,
  loginMotherlandUser,
  setStoredAuth,
} from '../../services/socialService';
import { CurrentUserProfile } from '../../types/social';
import { GoogleAuthUser, triggerGoogleIdentityPrompt } from '../../services/youtubeAuthService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: CurrentUserProfile) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [step, setStep] = useState<1 | 2>(1); // Step 1: Required info, Step 2: Optional profile setup

  // Form Fields - Required
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dob, setDob] = useState('');

  // Form Fields - Optional
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');

  // Login field
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot Password field
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // States
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle Image Upload to local /api/upload
  const handleUploadImage = async (file: File, type: 'avatar' | 'cover') => {
    setUploadingImage(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: base64, type: 'image' }),
          });
          const data = await res.json();
          if (res.ok && data.url) {
            if (type === 'avatar') setAvatarUrl(data.url);
            else setCoverPhotoUrl(data.url);
          } else {
            setError(data.error || 'Failed uploading photo');
          }
        } catch (err: any) {
          setError(err.message || 'Upload error');
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingImage(false);
    }
  };

  // Step 1 Register Submission
  const handleRegisterStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('Please enter your full name.');
    if (!username.trim() || username.length < 3) return setError('Username must be at least 3 characters.');
    if (!email.trim() || !email.includes('@')) return setError('Please provide a valid email address.');
    if (!password || password.length < 6) return setError('Password must be at least 6 characters.');
    if (!dob) return setError('Please enter your date of birth.');

    // Proceed to Step 2 (Optional Profile Setup)
    setStep(2);
  };

  // Step 2 / Final Register Completion
  const handleFinalRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { user } = await registerMotherlandUser({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        dob,
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        website: website.trim() || undefined,
        avatar: avatarUrl || undefined,
        coverPhoto: coverPhotoUrl || undefined,
      });

      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to complete registration.');
      setStep(1); // Return to step 1 if error is in basic fields
    } finally {
      setLoading(false);
    }
  };

  // Login Submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { user } = await loginMotherlandUser(loginIdentifier.trim(), loginPassword);
      onAuthSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  // Google Login Trigger
  const handleGoogleSignIn = () => {
    setLoading(true);
    setError(null);
    triggerGoogleIdentityPrompt(
      async (googleUser: GoogleAuthUser) => {
        try {
          const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accessToken: googleUser.accessToken,
              clientUserData: googleUser,
            }),
          });
          const data = await res.json();
          if (res.ok && data.user) {
            setStoredAuth(data.token, data.user);
            onAuthSuccess(data.user);
            onClose();
          } else {
            setError(data.error || 'Google login failed');
          }
        } catch (err: any) {
          setError(err.message || 'Google authentication error');
        } finally {
          setLoading(false);
        }
      },
      (err: string) => {
        setError(err || 'Google sign-in was cancelled');
        setLoading(false);
      }
    );
  };

  // Forgot Password
  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      return setError('Please enter your registered email address.');
    }
    setError(null);
    setForgotSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0e1423] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-100 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#006a4e] to-[#044c38] border border-emerald-400/40 flex items-center justify-center shadow-lg flex-shrink-0">
            <Sparkles className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-white">
              {mode === 'login'
                ? 'Sign In to MOTHERLAND'
                : mode === 'register'
                ? step === 1
                  ? 'Create Your Account'
                  : 'Profile Setup (Optional)'
                : 'Reset Password'}
            </h3>
            <p className="text-[11px] text-slate-400">
              {mode === 'login'
                ? 'Access your individual posts, friends & feed'
                : mode === 'register'
                ? step === 1
                  ? 'Step 1 of 2: Required credentials'
                  : 'Step 2 of 2: Personalize your identity'
                : 'Enter your email to receive recovery instructions'}
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs (only on Step 1) */}
        {step === 1 && mode !== 'forgot' && (
          <div className="flex items-center p-1 rounded-2xl bg-white/5 border border-white/10 mb-4">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-500/15 border border-red-500/30 flex items-start gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4">
          {/* 1. LOGIN MODE */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Email, Username, or Phone
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. kefat@gmail.com or @kefat"
                    className="w-full pl-9 pr-3 py-2 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-2 my-2">
                <div className="h-px bg-white/10 flex-1" />
                <span className="text-[10px] text-slate-500 uppercase font-mono">or continue with</span>
                <div className="h-px bg-white/10 flex-1" />
              </div>

              {/* Google OAuth Login Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-2.5 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google Account</span>
              </button>
            </form>
          )}

          {/* 2. REGISTER MODE — STEP 1: Required Information */}
          {mode === 'register' && step === 1 && (
            <form onSubmit={handleRegisterStep1} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kefat Hossain"
                    className="w-full pl-9 pr-3 py-1.5 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Unique Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="text-xs text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 font-mono">@</span>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
                    placeholder="kefat"
                    className="w-full pl-7 pr-3 py-1.5 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kefat105@gmail.com"
                    className="w-full pl-9 pr-3 py-1.5 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full pl-9 pr-2 py-1.5 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Date of Birth <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full pl-9 pr-2 py-1.5 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all"
              >
                <span>Continue to Profile Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 3. REGISTER MODE — STEP 2: Optional Information */}
          {mode === 'register' && step === 2 && (
            <div className="space-y-4">
              {/* Profile Photo Placeholder with Upload (Requirement 3: Initially empty!) */}
              <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="relative w-16 h-16 rounded-full border-2 border-dashed border-emerald-500/50 bg-[#12192b] flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-500">
                      <Camera className="w-5 h-5 text-emerald-400" />
                      <span className="text-[9px] mt-0.5">Empty</span>
                    </div>
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <span className="text-xs font-bold text-white block">Profile Picture (Optional)</span>
                  <p className="text-[10px] text-slate-400 mb-2">Upload from your device gallery or add later.</p>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleUploadImage(e.target.files[0], 'avatar');
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-emerald-300"
                  >
                    Select Photo
                  </button>
                </div>
              </div>

              {/* Bio & Phone */}
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Bio (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell the community about yourself..."
                    className="w-full px-3 py-1.5 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+880 1..."
                      className="w-full px-3 py-1.5 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Location / City (Optional)
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g. Dhaka, Bangladesh"
                      className="w-full px-3 py-1.5 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons: Skip vs Complete */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleFinalRegister()}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-semibold text-xs transition-colors"
                >
                  Skip for Now
                </button>
                <button
                  type="button"
                  onClick={() => handleFinalRegister()}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 flex items-center justify-center gap-1.5 transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}

          {/* 4. FORGOT PASSWORD MODE */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              {forgotSuccess ? (
                <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <h4 className="font-bold text-white text-sm">Recovery Link Generated</h4>
                  <p className="text-xs text-slate-300">
                    A password recovery token has been processed for <strong>{forgotEmail}</strong>. You may now log in with your primary email or reset your password.
                  </p>
                  <button
                    onClick={() => {
                      setMode('login');
                      setForgotSuccess(false);
                    }}
                    className="mt-3 px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <p className="text-xs text-slate-300">
                    Enter the email address associated with your MOTHERLAND account and we will assist you with access recovery.
                  </p>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      Account Email
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="kefat@gmail.com"
                      className="w-full px-3 py-2 bg-[#12192b] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="px-3 py-2 rounded-xl bg-white/10 text-xs font-semibold text-slate-300"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-xs font-bold text-white"
                    >
                      Send Instructions
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
