/**
 * YouTube Google Account Authorization & Channel Switcher Modal
 * - Real Google OAuth 2.0 authentication with Account Chooser (prompt: 'select_account')
 * - Requests scopes: userinfo.profile, userinfo.email, youtube, youtube.readonly, youtube.upload
 * - Dynamically resolves real Google OAuth Client ID from runtime server config / env (zero fake fallback IDs)
 * - Displays copyable Authorized JavaScript Origin & Redirect URI for easy Google Cloud Console setup
 * - Supports Bearer access token verification for direct YouTube account login & video management
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
  ExternalLink,
  Key,
  LogOut,
  Youtube,
  RefreshCw,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import {
  GoogleAuthUser,
  completeGoogleSignInWithToken,
  saveStoredGoogleAuth,
  removeStoredGoogleAuth,
  disconnectYouTubeChannel,
  getOfficialGoogleOAuthUrl,
  resolveGoogleClientId,
  setRuntimeGoogleClientId,
  getGoogleRedirectUri,
  GOOGLE_OAUTH_SCOPES,
} from '../../services/youtubeAuthService';
import { api } from '../../api';

interface YouTubeAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAuth: GoogleAuthUser | null;
  onAuthUpdated: (auth: GoogleAuthUser | null) => void;
}

export const YouTubeAccountModal: React.FC<YouTubeAccountModalProps> = ({
  isOpen,
  onClose,
  currentAuth,
  onAuthUpdated,
}) => {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState(() => resolveGoogleClientId());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'signin' | 'token' | 'setup'>('signin');
  const [copiedKey, setCopiedKey] = useState<'origin' | 'callback' | null>(null);
  const [serverCallbackUrl, setServerCallbackUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    api
      .getYouTubeOAuthStatus()
      .then((status) => {
        if (status.googleClientId) {
          setRuntimeGoogleClientId(status.googleClientId);
          setClientIdInput(status.googleClientId);
        }
        if (status.callbackUrl) {
          setServerCallbackUrl(status.callbackUrl);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const activeClientId = (clientIdInput || resolveGoogleClientId()).trim();
  const originUri = getGoogleRedirectUri();
  const callbackUri = serverCallbackUrl || `${originUri}/api/youtube/oauth/callback`;

  const copyText = (text: string, which: 'origin' | 'callback') => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(which);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Real Google Sign In Flow via Google Identity Services (prompt: 'select_account')
  const handleGoogleSignIn = async () => {
    if (!activeClientId) {
      setActiveTab('setup');
      setErrorMessage(
        'Google OAuth Client ID is not configured yet for this app URL. Add your Google Cloud Web Client ID below or enter a Bearer OAuth access token directly.'
      );
      return;
    }

    setRuntimeGoogleClientId(activeClientId);
    setIsAuthorizing(true);
    setErrorMessage(null);

    try {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: GOOGLE_OAUTH_SCOPES,
          prompt: 'select_account',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setIsAuthorizing(false);
              setErrorMessage(
                `Google OAuth error (${tokenResponse.error}). Make sure "${originUri}" is added under Authorized JavaScript Origins in your Google Cloud OAuth Client.`
              );
              return;
            }

            try {
              const { authUser } = await completeGoogleSignInWithToken(
                tokenResponse.access_token,
                tokenResponse.expires_in || 3600
              );

              if (api.getToken()) {
                api
                  .updateProfile({
                    displayName: authUser.name,
                    avatar: authUser.avatarUrl,
                  })
                  .catch(() => {});
              }

              onAuthUpdated(authUser);
              setIsAuthorizing(false);
              onClose();
            } catch (err: unknown) {
              setIsAuthorizing(false);
              setErrorMessage(err instanceof Error ? err.message : String(err));
            }
          },
        });
        client.requestAccessToken();
      } else {
        setIsAuthorizing(false);
        setActiveTab('setup');
        setErrorMessage(
          'Google Identity popup was blocked inside this preview frame. Click "Launch Google OAuth in Full Tab" below after ensuring Redirect URI is registered, or paste an OAuth access token.'
        );
      }
    } catch (err: unknown) {
      setIsAuthorizing(false);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleManualTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = tokenInput.trim();
    if (!token) return;

    setIsAuthorizing(true);
    setErrorMessage(null);

    try {
      const { authUser } = await completeGoogleSignInWithToken(token, 3600);

      if (api.getToken()) {
        api
          .updateProfile({
            displayName: authUser.name,
            avatar: authUser.avatarUrl,
          })
          .catch(() => {});
      }

      onAuthUpdated(authUser);
      setIsAuthorizing(false);
      onClose();
    } catch (err: unknown) {
      setIsAuthorizing(false);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDisconnectYouTubeOnly = async () => {
    if (!currentAuth) return;
    try {
      const res = api.getToken() ? await api.getCurrentUser() : { user: null };
      await disconnectYouTubeChannel(res.user?.id || '');
    } catch {
      // ignore if unavailable
    }

    const updated: GoogleAuthUser = {
      ...currentAuth,
      hasYouTubeChannel: false,
      channelId: undefined,
      channelTitle: undefined,
      channelHandle: undefined,
      subscriberCount: undefined,
      videoCount: undefined,
      viewCount: undefined,
      description: undefined,
    };

    saveStoredGoogleAuth(updated);
    onAuthUpdated(updated);
  };

  const handleFullSignOut = () => {
    removeStoredGoogleAuth();
    onAuthUpdated(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-md bg-[#0c1220] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md">
              <Youtube className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Google & YouTube Account</h3>
              <p className="text-[11px] text-slate-400">Official Google OAuth 2.0 Authorization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Authenticated Google & YouTube Identity */}
        {currentAuth ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#111728] border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src={currentAuth.avatarUrl}
                  alt={currentAuth.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-sm text-white truncate">{currentAuth.name}</h4>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-slate-300 font-mono truncate flex items-center gap-1 mt-0.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{currentAuth.email}</span>
                  </p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">
                    Google Account Connected
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/5">
                {currentAuth.hasYouTubeChannel && currentAuth.channelId ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Youtube className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                        <span>Channel: {currentAuth.channelTitle}</span>
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                        {currentAuth.subscriberCount} Subscribers
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{currentAuth.channelHandle || '@creator'}</span>
                      <span>{currentAuth.videoCount} Uploaded Videos</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-white/5 text-[11px] text-slate-300 space-y-1">
                    <p className="font-semibold text-white">No YouTube Channel Created Yet</p>
                    <p className="text-slate-400 text-[10px]">
                      This Google account is authenticated for MOTHERLAND, but has not yet created a public YouTube channel.
                    </p>
                    <a
                      href="https://studio.youtube.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-semibold pt-1"
                    >
                      <span>Create Channel on YouTube Studio</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isAuthorizing}
                  className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  <span>Switch Account</span>
                </button>

                <button
                  onClick={handleFullSignOut}
                  className="py-2.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>

              {currentAuth.hasYouTubeChannel && (
                <button
                  onClick={handleDisconnectYouTubeOnly}
                  className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 text-[11px] transition-colors"
                >
                  Disconnect YouTube Permissions Only (Keep MOTHERLAND Login)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Scopes & Permissions Notice */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Google & YouTube Studio Access</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Sign in with your Google account to view, upload, edit, and delete videos on your YouTube channel directly inside MOTHERLAND.
              </p>
            </div>

            {/* CONTINUE WITH GOOGLE Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isAuthorizing}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-3 shadow-xl active:scale-98 transition-all cursor-pointer"
            >
              {isAuthorizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                  <span>Opening Google Account Chooser...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                  <span>CONTINUE WITH GOOGLE</span>
                </>
              )}
            </button>

            {/* Setup & URL Check / Token Controls */}
            <div className="pt-2 border-t border-white/5 space-y-2.5 text-center">
              <div className="flex items-center justify-center gap-3 text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'setup' ? 'signin' : 'setup')}
                  className="text-emerald-400 hover:underline font-semibold"
                >
                  {activeTab === 'setup' ? 'Hide OAuth Client & URLs' : 'Google Cloud URLs & Client ID'}
                </button>
                <span className="text-slate-600">•</span>
                <button
                  type="button"
                  onClick={() => setActiveTab(activeTab === 'token' ? 'signin' : 'token')}
                  className="text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <Key className="w-3 h-3" />
                  <span>{activeTab === 'token' ? 'Hide Token' : 'Use OAuth Token'}</span>
                </button>
              </div>

              {activeTab === 'setup' && (
                <div className="p-3 rounded-2xl bg-[#111728] border border-white/10 text-left space-y-2.5 animate-in fade-in">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                      Google Web OAuth Client ID
                    </label>
                    <input
                      type="text"
                      value={clientIdInput}
                      onChange={(e) => {
                        setClientIdInput(e.target.value);
                        setRuntimeGoogleClientId(e.target.value);
                      }}
                      placeholder="xxxxxx.apps.googleusercontent.com"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#090d16] border border-white/10 text-[11px] text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-slate-300 uppercase mb-1">
                      Authorized JavaScript Origin (add in Google Cloud):
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[#090d16] px-2.5 py-1.5 rounded-lg border border-white/10">
                      <span className="font-mono text-[10px] text-emerald-300 break-all">{originUri}</span>
                      <button
                        type="button"
                        onClick={() => copyText(originUri, 'origin')}
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        title="Copy JavaScript Origin"
                      >
                        {copiedKey === 'origin' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold text-slate-300 uppercase mb-1">
                      Authorized Redirect URI (add in Google Cloud):
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-[#090d16] px-2.5 py-1.5 rounded-lg border border-white/10">
                      <span className="font-mono text-[10px] text-slate-300 break-all">{callbackUri}</span>
                      <button
                        type="button"
                        onClick={() => copyText(callbackUri, 'callback')}
                        className="text-slate-400 hover:text-white flex-shrink-0"
                        title="Copy Callback URI"
                      >
                        {copiedKey === 'callback' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {activeClientId && (
                    <a
                      href={getOfficialGoogleOAuthUrl(activeClientId)}
                      target="_top"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5"
                    >
                      <span>Launch Google OAuth Consent Flow</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {activeTab === 'token' && (
                <form onSubmit={handleManualTokenSubmit} className="space-y-2 pt-1 animate-in fade-in">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Paste Google OAuth Bearer access token..."
                    className="w-full px-3 py-2 rounded-xl bg-[#111728] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-red-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!tokenInput.trim() || isAuthorizing}
                    className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs"
                  >
                    Verify &amp; Authenticate
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
