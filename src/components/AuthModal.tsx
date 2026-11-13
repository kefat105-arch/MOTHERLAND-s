import React, { useState } from 'react';
import {
  Shield,
  Sparkles,
  Lock,
  Mail,
  User,
  Calendar,
  Phone,
  MapPin,
  Globe,
  Camera,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  X,
  KeyRound,
  Crown,
  Users,
} from 'lucide-react';
import { api } from '../api';
import { useBackHandler } from '../hooks/useBackNavigation';
import { MotherlandLogo } from './layout/MotherlandLogo';
import type { UserProfile, RegisterPayload } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
  initialTab?: 'login' | 'register';
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
];

const COVER_PRESETS = [
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=1600&auto=format&fit=crop&q=80',
];

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialTab = 'login',
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'forgot'>(initialTab);
  const [regStep, setRegStep] = useState<1 | 2 | 3 | 4>(1);

  // Login State
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Register State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dob, setDob] = useState('');

  // Step 2 Optional
  const [phone, setPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isPhoneOtpSent, setIsPhoneOtpSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [otpNotice, setOtpNotice] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');

  // Step 3 Photos
  const [avatar, setAvatar] = useState('');
  const [coverImage, setCoverImage] = useState('');

  // Step 4 Welcome
  const [registeredUser, setRegisteredUser] = useState<UserProfile | null>(null);

  // Forgot Password State
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isForgotOtpSent, setIsForgotOtpSent] = useState(false);
  const [forgotNotice, setForgotNotice] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Quick Account Switcher Helper
  const savedAccounts = api.getSavedAccounts();

  useBackHandler(
    'auth-modal',
    isOpen,
    () => {
      if (activeTab === 'forgot') {
        setActiveTab('login');
        setForgotError('');
        return;
      }
      if (activeTab === 'register' && regStep > 1 && regStep < 4) {
        setRegStep((prev) => (prev === 3 ? 2 : 1));
        return;
      }
      onClose();
    },
    65
  );

  if (!isOpen) return null;

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const res = await api.login({
        identifier: loginIdentifier,
        password: loginPassword,
      });

      if (res.token && res.user) {
        onAuthSuccess(res.user);
        onClose();
      } else {
        setLoginError(res.message || 'Invalid username or password');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Failed to authenticate');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Quick Demo Login for instant testing of multi-user separation
  const handleQuickLogin = async (identifier: string, pass = 'Motherland2026!') => {
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await api.login({ identifier, password: pass });
      if (res.token && res.user) {
        onAuthSuccess(res.user);
        onClose();
      } else {
        setLoginError(res.message || 'Quick login failed');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Quick login error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Phone OTP Flow
  const handleSendPhoneOtp = async () => {
    if (!phone) {
      setOtpNotice('Please enter a phone number first');
      return;
    }
    try {
      const res = await api.sendOtp(phone, 'phone_verify');
      setIsPhoneOtpSent(true);
      setOtpNotice(`Code sent! (Debug OTP: ${res.debugOtp})`);
    } catch (err) {
      setOtpNotice('Failed to send OTP code');
    }
  };

  const handleVerifyPhoneOtp = async () => {
    try {
      const res = await api.verifyOtp(phone, phoneOtp, 'phone_verify');
      if (res.success) {
        setIsPhoneVerified(true);
        setOtpNotice('Phone verified successfully!');
      } else {
        setOtpNotice('Invalid code');
      }
    } catch {
      setOtpNotice('OTP verification failed');
    }
  };

  // Step 1 Submit
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !dob) {
      setLoginError('Please complete all required fields');
      return;
    }
    setLoginError('');
    setRegStep(2);
  };

  // Final Registration Execution
  const executeRegistration = async () => {
    setLoginError('');
    setIsLoggingIn(true);

    const payload: RegisterPayload = {
      fullName,
      username,
      email,
      password,
      dateOfBirth: dob,
      phoneNumber: phone || undefined,
      gender: gender !== 'Prefer not to say' ? gender : undefined,
      address: address || undefined,
      bio: bio || undefined,
      website: website || undefined,
      avatar: avatar || undefined,
      coverImage: coverImage || undefined,
    };

    try {
      const res = await api.register(payload);
      if (res.token && res.user) {
        setRegisteredUser(res.user);
        setRegStep(4); // Welcome screen
      } else {
        setLoginError(res.message || 'Registration failed');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Failed to register account');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Forgot Password Flows
  const handleSendForgotOtp = async () => {
    setForgotError('');
    if (!forgotIdentifier) {
      setForgotError('Enter your registered email or phone');
      return;
    }
    try {
      const res = await api.forgotPassword(forgotIdentifier);
      if (res.success) {
        setIsForgotOtpSent(true);
        setForgotNotice(`Reset code sent! (Debug OTP: ${res.debugOtp})`);
      } else {
        setForgotError(res.message || 'Could not send reset code');
      }
    } catch {
      setForgotError('Error requesting reset code');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotIdentifier || !forgotCode || !newPassword) {
      setForgotError('Please fill in all fields');
      return;
    }
    try {
      const res = await api.resetPassword({
        identifier: forgotIdentifier,
        code: forgotCode,
        newPassword,
      });
      if (res.success) {
        setForgotNotice('Password reset successfully! Please log in.');
        setTimeout(() => {
          setActiveTab('login');
          setLoginIdentifier(forgotIdentifier);
        }, 1500);
      } else {
        setForgotError(res.message || 'Password reset failed');
      }
    } catch (err: any) {
      setForgotError(err.message || 'Reset failed');
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg ml-glass-elevated rounded-2xl shadow-2xl p-6 sm:p-8 text-[var(--text-primary)] my-8">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close authentication modal"
          className="absolute top-3.5 right-3.5 w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-full hover:bg-[var(--bg-surface-alt)] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <MotherlandLogo size={56} showText={false} />
          </div>
          <h2 className="text-2xl font-black tracking-wider text-[var(--text-primary)]">MOTHERLAND</h2>
          <p className="text-xs text-[var(--text-secondary)] tracking-wide mt-1">
            Next-Gen Sovereign Social Ecosystem &amp; Media Network
          </p>
        </div>

        {/* Mode Selector (Login vs Register) */}
        {activeTab !== 'forgot' && regStep !== 4 && (
          <div className="flex bg-[var(--bg-surface-alt)] p-1 rounded-xl border border-[var(--border-subtle)] mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setLoginError('');
              }}
              className={`flex-1 min-h-[42px] py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'login'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setRegStep(1);
                setLoginError('');
              }}
              className={`flex-1 min-h-[42px] py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'register'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] shadow-md'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Global Error Notice */}
        {loginError && (
          <div className="mb-4 p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/35 rounded-xl flex items-center gap-2 text-[var(--danger)] text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 1: LOGIN VIEW */}
        {/* ========================================== */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Email, Username or Phone
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="e.g. kefatahmed or kefat@motherland.social"
                  required
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
                <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('forgot');
                    setForgotError('');
                  }}
                  className="text-[11px] text-[var(--accent-primary)] hover:underline py-1"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2.5 pl-10 pr-11 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
                <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-3" />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full min-h-[44px] py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? 'Authenticating...' : 'Sign In to MOTHERLAND'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick Multi-User Test Accounts Section */}
            <div className="pt-4 border-t border-[var(--border-subtle)]">
              <p className="text-[11px] text-[var(--text-secondary)] text-center font-medium mb-2.5 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
                Test Multi-User Account Switching:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('kefatahmed')}
                  className="flex items-center gap-2 p-2.5 min-h-[44px] rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--accent-gold-border)] hover:border-[var(--accent-gold)] transition-colors text-left"
                >
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                    alt="Kefat"
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-bold text-[var(--text-primary)] truncate flex items-center gap-1">
                      Kefat Ahmed <Crown className="w-3 h-3 text-[var(--accent-gold)]" />
                    </p>
                    <p className="text-[9px] text-[var(--accent-primary)]">Founder &amp; Owner</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin('nadia_creative')}
                  className="flex items-center gap-2 p-2.5 min-h-[44px] rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary-border)] transition-colors text-left"
                >
                  <img
                    src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80"
                    alt="Nadia"
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                  <div className="overflow-hidden">
                    <p className="text-[11px] font-bold text-[var(--text-primary)] truncate">Nadia Hossain</p>
                    <p className="text-[9px] text-[var(--text-secondary)]">Creator Account</p>
                  </div>
                </button>
              </div>

              {/* Saved accounts on this device */}
              {savedAccounts.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">Saved Sessions on Device</p>
                  <div className="flex flex-wrap gap-1.5">
                    {savedAccounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          setLoginError('');
                          api.setToken(acc.token);
                          api.getCurrentUser().then((res) => {
                            if (res.user) {
                              onAuthSuccess(res.user);
                              onClose();
                            } else {
                              api.setToken('');
                              setLoginError(`Saved session for ${acc.displayName} expired. Please enter your password.`);
                              setLoginIdentifier(acc.username || '');
                            }
                          }).catch(() => {
                            api.setToken('');
                            setLoginError('Could not restore saved session. Please sign in.');
                          });
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary-border)] text-[11px] text-[var(--text-primary)] transition-colors"
                      >
                        <img src={acc.avatar} alt="" className="w-4 h-4 rounded-full" />
                        <span>{acc.displayName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </form>
        )}

        {/* ========================================== */}
        {/* TAB 2: MULTI-STEP ACCOUNT CREATION */}
        {/* ========================================== */}
        {activeTab === 'register' && (
          <div>
            {/* Step Indicators */}
            {regStep !== 4 && (
              <div className="flex items-center justify-between mb-6 px-2">
                {[1, 2, 3].map((stepNum) => (
                  <div key={stepNum} className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                        regStep === stepNum
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] ring-4 ring-[var(--accent-primary-soft)]'
                          : regStep > stepNum
                          ? 'bg-[var(--accent-gold)] text-[#0A1324]'
                          : 'bg-[var(--bg-surface-alt)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {regStep > stepNum ? '✓' : stepNum}
                    </div>
                    <span className="text-[11px] font-medium text-[var(--text-secondary)] hidden sm:inline">
                      {stepNum === 1 ? 'Credentials' : stepNum === 2 ? 'Details' : 'Photos'}
                    </span>
                    {stepNum < 3 && <div className="w-8 h-[1px] bg-[var(--border-subtle)] mx-1 hidden sm:block" />}
                  </div>
                ))}
              </div>
            )}

            {/* STEP 1: Required Information */}
            {regStep === 1 && (
              <form onSubmit={handleStep1Submit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Full Name <span className="text-[var(--accent-primary)]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Shakib Al Hasan"
                      required
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                    <User className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Unique Username <span className="text-[var(--accent-primary)]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. shakib_official"
                      required
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                    <span className="text-[var(--text-muted)] font-bold absolute left-3.5 top-2">@</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Email Address <span className="text-[var(--accent-primary)]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. shakib@example.com"
                      required
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                    <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Password <span className="text-[var(--accent-primary)]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      minLength={6}
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 pl-10 pr-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                    <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Date of Birth <span className="text-[var(--accent-primary)]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      required
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 pl-10 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                    />
                    <Calendar className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 min-h-[44px] py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  Continue to Profile Details
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* STEP 2: Optional Information */}
            {regStep === 2 && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Additional Profile Information</h3>
                  <span className="text-[11px] text-[var(--text-muted)] italic">Optional (Skippable)</span>
                </div>

                {/* Phone & OTP */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Phone Number (Optional OTP)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+880 1700 000000"
                        className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                      />
                      <Phone className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      className="px-3 py-2 bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-xs font-semibold text-[var(--accent-primary)] rounded-xl transition-colors whitespace-nowrap"
                    >
                      {isPhoneOtpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                  {isPhoneOtpSent && !isPhoneVerified && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value)}
                        placeholder="Enter 6-digit code"
                        maxLength={6}
                        className="flex-1 bg-[var(--bg-surface-alt)] border border-[var(--accent-primary-border)] rounded-xl px-3 py-1.5 text-xs text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyPhoneOtp}
                        className="px-3 py-1.5 bg-[var(--accent-primary)] text-[var(--accent-primary-contrast)] text-xs font-bold rounded-xl"
                      >
                        Verify
                      </button>
                    </div>
                  )}
                  {otpNotice && (
                    <p className={`text-[11px] mt-1 ${isPhoneVerified ? 'text-[var(--accent-primary)]' : 'text-[var(--accent-gold)]'}`}>
                      {otpNotice}
                    </p>
                  )}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="Prefer not to say">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Non-Binary">Non-Binary</option>
                  </select>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">City / Address</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Dhaka, Bangladesh"
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <MapPin className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  </div>
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Short Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell the community about yourself..."
                    rows={2}
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] resize-none"
                  />
                </div>

                {/* Website */}
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Website</label>
                  <div className="relative">
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 pl-10 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <Globe className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(1)}
                    className="px-4 min-h-[44px] py-2.5 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-primary)] font-semibold rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegStep(3)}
                    className="flex-1 min-h-[44px] py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    Next: Profile Photos
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Profile Picture & Cover Photo */}
            {regStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Photos &amp; Avatar</h3>
                  <span className="text-[11px] text-[var(--text-muted)] italic">Initially empty; customize or skip</span>
                </div>

                {/* Profile Picture Area */}
                <div className="flex flex-col items-center p-4 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl">
                  <div className="relative w-20 h-20 rounded-2xl bg-[var(--bg-surface)] border-2 border-dashed border-[var(--border-strong)] flex items-center justify-center overflow-hidden mb-3">
                    {avatar ? (
                      <img src={avatar} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-7 h-7 text-[var(--text-muted)]" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Select Avatar Preset</p>
                  <div className="flex gap-2">
                    {AVATAR_PRESETS.slice(0, 5).map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatar(preset)}
                        className={`w-10 h-10 rounded-xl overflow-hidden border-2 transition-all ${
                          avatar === preset ? 'border-[var(--accent-primary)] scale-105 ring-2 ring-[var(--accent-primary-soft)]' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={preset} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cover Image Area */}
                <div className="p-4 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Cover Banner Preset</p>
                  <div className="grid grid-cols-2 gap-2">
                    {COVER_PRESETS.map((cov, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCoverImage(cov)}
                        className={`h-14 rounded-xl overflow-hidden border-2 transition-all ${
                          coverImage === cov ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary-soft)]' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={cov} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRegStep(2)}
                    className="px-4 min-h-[44px] py-2.5 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] text-[var(--text-primary)] font-semibold rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                  <button
                    type="button"
                    disabled={isLoggingIn}
                    onClick={executeRegistration}
                    className="flex-1 min-h-[44px] py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {isLoggingIn ? 'Creating Account...' : 'Complete Registration'}
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Welcome & Onboarding Completion */}
            {regStep === 4 && registeredUser && (
              <div className="text-center py-4 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] flex items-center justify-center text-[var(--accent-primary)]">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[var(--text-primary)]">
                    Welcome to MOTHERLAND, {registeredUser.displayName}!
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    Your sovereign account has been established with unique ID{' '}
                    <span className="font-mono text-[var(--accent-primary)]">{registeredUser.id}</span>
                  </p>
                </div>

                <div className="bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] p-4 rounded-xl text-left space-y-2.5 text-xs text-[var(--text-secondary)]">
                  <p className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                    <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
                    Isolated Individual Profile Active
                  </p>
                  <p className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--accent-gold)]" />
                    Reactions, Comments &amp; Stories bound strictly to your ID
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                    Dynamic Friend Suggestions &amp; Real-Time Messaging ready
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onAuthSuccess(registeredUser);
                    onClose();
                  }}
                  className="w-full min-h-[44px] py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold rounded-xl text-sm transition-all shadow-md"
                >
                  Enter MOTHERLAND
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TAB 3: FORGOT PASSWORD RESET */}
        {/* ========================================== */}
        {activeTab === 'forgot' && (
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[var(--accent-gold)]" />
                Reset Account Password
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('login')}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1.5 px-2"
              >
                Back to Login
              </button>
            </div>

            {forgotError && (
              <div className="p-3 bg-[var(--danger-soft)] border border-[var(--danger)]/35 rounded-xl text-[var(--danger)] text-xs">
                {forgotError}
              </div>
            )}

            {forgotNotice && (
              <div className="p-3 bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] rounded-xl text-[var(--accent-primary)] text-xs">
                {forgotNotice}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Registered Email, Username or Phone
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="Enter email or username"
                  required
                  className="flex-1 bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <button
                  type="button"
                  onClick={handleSendForgotOtp}
                  className="px-3 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold text-xs rounded-xl whitespace-nowrap"
                >
                  {isForgotOtpSent ? 'Resend' : 'Send Code'}
                </button>
              </div>
            </div>

            {isForgotOtpSent && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    required
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    New Secure Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    minLength={6}
                    required
                    className="w-full bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] rounded-xl px-4 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-[var(--accent-primary-contrast)] font-bold rounded-xl text-sm shadow-md"
                >
                  Update Password &amp; Log In
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
