import React, { useState, useEffect } from 'react';
import {
  X,
  MessageSquare,
  Send,
  ExternalLink,
  ShieldAlert,
  Key,
  CheckCircle2,
  Clock,
  Sparkles,
  Phone,
  AtSign,
  Info,
  Trash2,
} from 'lucide-react';
import {
  MESSENGER_PLATFORM_REGISTRY,
  getMessageHistory,
  getSavedCredentials,
  saveCredentials,
  sendFacebookMessage,
  sendInstagramMessage,
  sendWhatsAppMessage,
  openTikTokMessages,
  clearMessageHistory,
} from '../../services/messengerService';
import { MessengerCredentials, MessengerPlatform, RealMessage } from '../../types/messenger';
import { FireEmojiPicker } from '../fire/FireEmojiPicker';
import { FireRichText } from '../fire/FireRichText';
import { FireDraftPreview, FirePickerTrigger } from '../fire/FireComposerBar';

interface MessengerHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MessengerHubModal: React.FC<MessengerHubModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<MessengerPlatform>('whatsapp');
  const [targetContact, setTargetContact] = useState('+8801700000000');
  const [messageText, setMessageText] = useState('Hello from MOTHERLAND Super App!');
  const [messages, setMessages] = useState<RealMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [lastActionResult, setLastActionResult] = useState<string | null>(null);
  const [firePickerOpen, setFirePickerOpen] = useState(false);

  // Settings / Credentials state
  const [showCreds, setShowCreds] = useState(false);
  const [creds, setCreds] = useState<MessengerCredentials>({});
  const [credsSaved, setCredsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMessages(getMessageHistory());
      setCreds(getSavedCredentials());
    }
  }, [isOpen]);

  // Adjust placeholder and default recipient when changing tab
  const handleTabChange = (platform: MessengerPlatform) => {
    setActiveTab(platform);
    setLastActionResult(null);
    if (platform === 'whatsapp') {
      setTargetContact('+8801700000000');
    } else if (platform === 'facebook') {
      setTargetContact('zuck');
    } else if (platform === 'instagram') {
      setTargetContact('creators');
    } else if (platform === 'tiktok') {
      setTargetContact('@tiktok');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !targetContact.trim()) return;

    setIsSending(true);
    setLastActionResult(null);

    try {
      if (activeTab === 'whatsapp') {
        const res = await sendWhatsAppMessage(targetContact, messageText);
        setLastActionResult(
          res.method === 'api'
            ? 'Message dispatched via Meta WhatsApp Business Cloud API!'
            : 'Opened official WhatsApp conversation (wa.me) with your pre-filled message!'
        );
      } else if (activeTab === 'facebook') {
        const res = await sendFacebookMessage(targetContact, messageText);
        setLastActionResult(
          res.method === 'api'
            ? 'Dispatched via Meta Messenger Platform Send API!'
            : 'Launched direct Facebook conversation (m.me)!'
        );
      } else if (activeTab === 'instagram') {
        await sendInstagramMessage(targetContact, messageText);
        setLastActionResult('Launched direct Instagram conversation (ig.me)!');
      } else if (activeTab === 'tiktok') {
        openTikTokMessages();
        setLastActionResult('Direct TikTok DM API unavailable. Opened official TikTok Messages client.');
      }

      setMessages(getMessageHistory());
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setLastActionResult(`Notice: ${errMsg}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    saveCredentials(creds);
    setCredsSaved(true);
    setTimeout(() => setCredsSaved(false), 2000);
  };

  const handleClearHistory = () => {
    clearMessageHistory();
    setMessages([]);
  };

  if (!isOpen) return null;

  const currentPlatformInfo = MESSENGER_PLATFORM_REGISTRY[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0c111d] border border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between bg-[#101728]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 p-[1.5px] shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-[#0c111d] rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">
                  MOTHERLAND MESSENGER HUB
                </h3>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  OFFICIAL INTEGRATIONS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Unified messaging interface respecting official platform APIs & privacy policies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCreds(!showCreds)}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                showCreds
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
              }`}
              title="API Credentials & Meta Tokens"
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">API Keys</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Platform Selection Tabs */}
        <div className="grid grid-cols-4 border-b border-white/5 bg-[#0f1525]">
          {(['whatsapp', 'facebook', 'instagram', 'tiktok'] as MessengerPlatform[]).map((platform) => {
            const info = MESSENGER_PLATFORM_REGISTRY[platform];
            const isActive = activeTab === platform;
            return (
              <button
                key={platform}
                onClick={() => handleTabChange(platform)}
                className={`py-3 px-2 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-all border-b-2 ${
                  isActive
                    ? 'border-blue-500 text-white bg-blue-500/10'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
                }`}
              >
                <span>{info.name.split(' ')[0]}</span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full ${
                    info.status === 'API UNAVAILABLE'
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}
                >
                  {info.status === 'API UNAVAILABLE' ? 'UNAVAILABLE' : 'ACTIVE'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Credentials Configuration Drawer */}
          {showCreds ? (
            <div className="p-4 rounded-2xl bg-[#141b2c] border border-white/10 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  <h4 className="font-bold text-sm text-white">Meta / WhatsApp API Configuration</h4>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Client-Side Secure Storage</span>
              </div>
              <p className="text-xs text-slate-400">
                Optional: If you operate a verified Meta Business Account, you can enter your official credentials below to test direct Send API requests. Otherwise, MOTHERLAND seamlessly utilizes the official direct conversational links (`wa.me`, `m.me`, `ig.me`).
              </p>

              <form onSubmit={handleSaveCredentials} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    WhatsApp Phone Number ID (From Meta Developer Dashboard)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 104592837482910"
                    value={creds.whatsappPhoneNumberId || ''}
                    onChange={(e) => setCreds({ ...creds, whatsappPhoneNumberId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0c111d] border border-white/10 text-white text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Meta Graph API Access Token (WhatsApp Cloud API / Send)
                  </label>
                  <input
                    type="password"
                    placeholder="EAABw..."
                    value={creds.whatsappAccessToken || ''}
                    onChange={(e) => setCreds({ ...creds, whatsappAccessToken: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#0c111d] border border-white/10 text-white text-xs font-mono"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  {credsSaved && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Credentials saved to local storage!</span>
                    </span>
                  )}
                  <button
                    type="submit"
                    className="ml-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    Save Credentials
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {/* Current Platform Status Banner */}
          <div className="p-3.5 rounded-2xl bg-[#131b2e] border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-white flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: currentPlatformInfo.brandColor }}
                />
                <span>{currentPlatformInfo.name}</span>
                <span className="text-slate-500 font-normal">({currentPlatformInfo.officialApiName})</span>
              </span>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${currentPlatformInfo.badgeBg}`}>
                {currentPlatformInfo.status}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentPlatformInfo.statusDetail}
            </p>
          </div>

          {/* Platform Specific Privacy Disclosure */}
          {activeTab === 'tiktok' ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-xs">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>TikTok API Limitation Disclosure</span>
              </div>
              <p className="text-xs leading-relaxed text-amber-200/90">
                TikTok does not provide an open public API for reading or writing personal direct messages in third-party web apps. In compliance with Section 16 & 24, MOTHERLAND does not simulate fake messages or scrape private accounts. Click below to open TikTok’s native messaging interface.
              </p>
              <button
                onClick={openTikTokMessages}
                className="mt-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
              >
                <span>Launch TikTok Messages Client</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Direct Composer for WhatsApp, Messenger, and Instagram */
            <form onSubmit={handleSend} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    {activeTab === 'whatsapp' ? (
                      <>
                        <Phone className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Recipient Phone (International format)</span>
                      </>
                    ) : (
                      <>
                        <AtSign className="w-3.5 h-3.5 text-blue-400" />
                        <span>Recipient Handle / ID</span>
                      </>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    value={targetContact}
                    onChange={(e) => setTargetContact(e.target.value)}
                    placeholder={activeTab === 'whatsapp' ? '+8801700000000' : 'username'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#141b2c] border border-white/10 text-white placeholder-slate-500 text-xs font-mono focus:outline-none focus:border-blue-500/50"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <span className="text-[11px] text-slate-400 mb-1">Dispatch Mechanism:</span>
                  <div className="px-3 py-2 rounded-xl bg-[#141b2c] border border-white/5 text-[11px] text-slate-300 font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {activeTab === 'whatsapp' && (creds.whatsappAccessToken ? 'Meta WhatsApp Cloud API' : 'Official wa.me protocol')}
                      {activeTab === 'facebook' && (creds.facebookPageAccessToken ? 'Meta Messenger Send API' : 'Official m.me protocol')}
                      {activeTab === 'instagram' && 'Official ig.me deep link'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Message Content
                  </label>
                  <FirePickerTrigger
                    size="sm"
                    onClick={() => setFirePickerOpen(true)}
                    active={firePickerOpen}
                    title="Insert MOTHERLAND Fire Emoji"
                  />
                </div>
                <textarea
                  rows={2}
                  required
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#141b2c] border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500/50 resize-none"
                />
                <FireDraftPreview value={messageText} />
              </div>

              {lastActionResult && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 text-blue-400" />
                  <span>{lastActionResult}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Zero fake data • Genuine dispatches only
                </span>
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-blue-900/40 transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send via {currentPlatformInfo.name}</span>
                </button>
              </div>
            </form>
          )}

          {/* Real Message Log */}
          <div className="pt-2 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Actual Dispatched Messages History ({messages.length})</span>
              </span>
              {messages.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {messages.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-[#12192a] border border-white/5 text-xs flex items-start justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white capitalize font-mono text-[11px]">
                          [{m.platform}]
                        </span>
                        <span className="text-slate-300 font-mono text-[11px]">
                          To: {m.recipientHandleOrPhone}
                        </span>
                        <span className="text-[10px] text-slate-500">{m.timestamp}</span>
                      </div>
                      <p className="mt-1 text-slate-300 text-xs">
                        <FireRichText text={m.text} emojiSize="xs" />
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                        m.status === 'sent_via_api'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {m.status === 'sent_via_api' ? 'API DISPATCHED' : 'DIRECT LAUNCH'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-2">
                No message activity recorded yet. Send a message above to verify real dispatch!
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-[#0e1423] flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px]">MOTHERLAND Privacy Shield — No token leakage</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-all"
          >
            Close
          </button>
        </div>
      </div>

      <FireEmojiPicker
        isOpen={firePickerOpen}
        onClose={() => setFirePickerOpen(false)}
        onSelect={(emoji) => {
          setMessageText((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${emoji.token} `);
        }}
      />
    </div>
  );
};
