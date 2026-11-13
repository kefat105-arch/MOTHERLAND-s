import React, { useState } from 'react';
import {
  X,
  Youtube,
  Instagram,
  Facebook,
  Shield,
  Key,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Radio,
  ExternalLink,
  Loader2,
  Lock,
} from 'lucide-react';
import { api } from '../api';
import type { PlatformAdapterInfo } from '../types';
import { useBackHandler } from '../hooks/useBackNavigation';

interface PlatformHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  adapters: PlatformAdapterInfo[];
  youtubeStatus: {
    configured: boolean;
    valid?: boolean;
    testSuccess?: boolean;
    message?: string;
    channelTitle?: string;
  };
  onKeyUpdated: () => void;
}

export const PlatformHubModal: React.FC<PlatformHubModalProps> = ({
  isOpen,
  onClose,
  adapters,
  youtubeStatus,
  onKeyUpdated,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useBackHandler('platform-hub-modal', isOpen, onClose, 60);

  if (!isOpen) return null;

  const handleSaveAndTestKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setIsTestingKey(true);
    setTestResult(null);

    try {
      const res = await api.setYouTubeKey(apiKeyInput.trim());
      if (res.success) {
        setTestResult({
          success: true,
          message: 'YouTube Data API v3 key successfully verified and connected! Live data enabled.',
        });
        setApiKeyInput('');
        onKeyUpdated();
      } else {
        setTestResult({
          success: false,
          message: res.error || 'Key verification failed. Please check your Google Cloud Console quota and restrictions.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Verification request failed.',
      });
    } finally {
      setIsTestingKey(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl p-5 my-auto animate-in zoom-in-95 duration-150 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[var(--accent-primary)] to-[var(--accent-gold)] p-0.5 flex items-center justify-center text-[var(--accent-primary-contrast)]">
              <Shield className="w-5 h-5 stroke-[2.25px]" />
            </div>
            <div>
              <h3 className="font-bold text-[var(--text-primary)] text-base">Platform Adapters &amp; API Hub</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">Manage credentials, API verification, and external syndication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* YouTube Data API v3 Primary Card */}
        <div className="p-4 rounded-2xl bg-[var(--bg-surface-alt)] border border-[#FF0000]/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#FF0000] flex items-center justify-center text-white shadow-sm">
                <Youtube className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-[var(--text-primary)]">YouTube Data API v3</span>
                <span className="text-[10px] text-[var(--text-secondary)] block font-mono">
                  Google Cloud Project: motherland-514304
                </span>
              </div>
            </div>

            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                youtubeStatus.configured && youtubeStatus.valid
                  ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] border border-[var(--accent-primary-border)]'
                  : 'bg-[var(--accent-gold-soft)] text-[var(--accent-gold)] border border-[var(--accent-gold-border)]'
              }`}
            >
              <Radio className="w-3 h-3 animate-pulse" />
              <span>{youtubeStatus.configured && youtubeStatus.valid ? 'Active & Verified' : 'Action Required'}</span>
            </span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {youtubeStatus.message ||
              'YouTube Data API v3 powers natural video discovery, real view counts, real like statistics, and authentic comment threads.'}
          </p>

          {/* Secure Key Input Section */}
          <form onSubmit={handleSaveAndTestKey} className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>Configure Existing Fixed YouTube API Key</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">Stored securely in server memory</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="password"
                  placeholder="Paste your existing YouTube Data API v3 Key (e.g. AIzaSy...)"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#FF0000]/50 font-mono"
                />
                <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-3 top-2.5" />
              </div>
              <button
                type="submit"
                disabled={isTestingKey || !apiKeyInput.trim()}
                className="min-h-[38px] px-4 py-2 rounded-xl bg-[#FF0000] hover:bg-red-700 text-white text-xs font-bold disabled:opacity-40 transition-colors flex items-center gap-1.5 flex-shrink-0"
              >
                {isTestingKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Activate Key</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in ${
                  testResult.success
                    ? 'bg-[var(--accent-primary-soft)] border border-[var(--accent-primary-border)] text-[var(--accent-primary)]'
                    : 'bg-[var(--danger-soft)] border border-[var(--danger)]/30 text-[var(--danger)]'
                }`}
              >
                {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </form>
        </div>

        {/* Other Platform Adapters Grid */}
        <div>
          <h4 className="text-xs font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
            Connected Platform Adapters
          </h4>
          <div className="space-y-2">
            {adapters.map((adapter) => (
              <div
                key={adapter.platform}
                className="p-3 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center font-bold"
                    style={{ backgroundColor: adapter.color + '26', color: adapter.color }}
                  >
                    {adapter.name.substring(0, 1)}
                  </div>
                  <div>
                    <span className="font-bold text-[var(--text-primary)] block">{adapter.name} Adapter</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{adapter.statusMessage}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    adapter.status === 'Connected'
                      ? 'bg-[var(--accent-primary-soft)] text-[var(--accent-primary)]'
                      : adapter.status === 'Coming Soon'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                      : 'bg-[var(--accent-gold-soft)] text-[var(--accent-gold)]'
                  }`}
                >
                  {adapter.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Help Note on Secret Configuration */}
        <div className="p-3 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
            <HelpCircle className="w-3.5 h-3.5 text-[var(--accent-gold)]" />
            <span>Where to configure credentials in AI Studio:</span>
          </div>
          <p>
            You can either enter your fixed key above (it will be activated in server memory immediately) or add{' '}
            <code className="text-[var(--accent-primary)] bg-[var(--bg-surface)] px-1 rounded">YOUTUBE_API_KEY</code> in the project's
            environment settings.
          </p>
        </div>
      </div>
    </div>
  );
};
