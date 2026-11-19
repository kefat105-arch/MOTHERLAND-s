import React from 'react';
import { Check, Sparkles, UserCheck, X } from 'lucide-react';
import type { RobloxAvatarConfig } from '../../../types';

interface AvatarCustomizerModalProps {
  config: RobloxAvatarConfig;
  onChange: (next: RobloxAvatarConfig) => void;
  onClose: () => void;
}

const SKIN_OPTIONS = [
  { label: 'Warm Fair', hex: 0xf3c297 },
  { label: 'Golden Tan', hex: 0xd99b66 },
  { label: 'Classic Yellow', hex: 0xfacc15 },
  { label: 'Rich Brown', hex: 0x8d5524 },
  { label: 'Deep Espresso', hex: 0x4a2c16 },
  { label: 'Pale', hex: 0xfde2cc },
];

const COLOR_SWATCHES = [
  0x0f172a, 0x0284c7, 0xe11d48, 0x0f766e, 0x7c3aed, 0xd97706, 0x16a34a, 0xf8fafc,
];

const HATS: Array<{ id: RobloxAvatarConfig['hatStyle']; label: string }> = [
  { id: 'hair_swept', label: 'Classic Hair' },
  { id: 'hair_spiky', label: 'Spiky Anime' },
  { id: 'cap', label: 'Street Cap' },
  { id: 'sheriff_hat', label: 'Sheriff Hat' },
  { id: 'bandana', label: 'Ninja Band' },
  { id: 'crown', label: 'Gold Crown' },
  { id: 'none', label: 'No Hat' },
];

const FACES: Array<{ id: RobloxAvatarConfig['faceMood']; label: string }> = [
  { id: 'smile', label: 'Classic Smile' },
  { id: 'confident', label: 'Confident' },
  { id: 'focused', label: 'Focused' },
  { id: 'cool_shades', label: 'Cool Shades' },
];

const ACCESSORIES: Array<{ id: RobloxAvatarConfig['accessory']; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'cape', label: 'Hero Cape' },
  { id: 'back_sword', label: 'Diamond Sword' },
  { id: 'aura', label: 'Energy Aura' },
];

export const AvatarCustomizerModal: React.FC<AvatarCustomizerModalProps> = ({
  config,
  onChange,
  onClose,
}) => {
  const update = (patch: Partial<RobloxAvatarConfig>) => {
    onChange({ ...config, ...patch });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3">
      <div className="w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-3xl bg-[#0e1526] border border-white/15 p-5 text-slate-100 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-teal-400" />
            <div>
              <h2 className="text-base font-black text-white">ক্যারেক্টার মডিফাই করুন (Avatar Editor)</h2>
              <p className="text-[11px] text-slate-300">সব ২৫-প্লেয়ার গেমে আপনার কাস্টম ক্যারেক্টার দেখা যাবে</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200"
            aria-label="Close Customizer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Skin Tone */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-300">Skin Tone</p>
          <div className="flex flex-wrap gap-2">
            {SKIN_OPTIONS.map((s) => (
              <button
                key={s.hex}
                type="button"
                onClick={() => update({ skinHex: s.hex })}
                className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-transform ${
                  config.skinHex === s.hex ? 'border-white scale-110' : 'border-white/15'
                }`}
                style={{ backgroundColor: `#${s.hex.toString(16).padStart(6, '0')}` }}
                title={s.label}
              >
                {config.skinHex === s.hex && <Check className="w-4 h-4 text-slate-950" />}
              </button>
            ))}
          </div>
        </div>

        {/* Hat & Hair */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-300">Hair & Hat</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {HATS.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => update({ hatStyle: h.id })}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  config.hatStyle === h.id
                    ? 'bg-teal-500 text-slate-950 border-teal-300'
                    : 'bg-slate-900 text-slate-200 border-white/10 hover:border-teal-400/50'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>

        {/* Hair Color */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-300">Hair Color</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={`hair_${c}`}
                type="button"
                onClick={() => update({ hairHex: c })}
                className={`w-8 h-8 rounded-lg border-2 ${
                  config.hairHex === c ? 'border-amber-400 scale-110' : 'border-white/15'
                }`}
                style={{ backgroundColor: `#${c.toString(16).padStart(6, '0')}` }}
              />
            ))}
          </div>
        </div>

        {/* Shirt & Pants Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-300">Jacket / Shirt</p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={`shirt_${c}`}
                  type="button"
                  onClick={() => update({ shirtHex: c })}
                  className={`w-7 h-7 rounded-lg border-2 ${
                    config.shirtHex === c ? 'border-amber-400 scale-110' : 'border-white/15'
                  }`}
                  style={{ backgroundColor: `#${c.toString(16).padStart(6, '0')}` }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-300">Pants</p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={`pants_${c}`}
                  type="button"
                  onClick={() => update({ pantsHex: c })}
                  className={`w-7 h-7 rounded-lg border-2 ${
                    config.pantsHex === c ? 'border-amber-400 scale-110' : 'border-white/15'
                  }`}
                  style={{ backgroundColor: `#${c.toString(16).padStart(6, '0')}` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Face Expression */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-300">Face</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {FACES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => update({ faceMood: f.id })}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border ${
                  config.faceMood === f.id
                    ? 'bg-amber-500 text-slate-950 border-amber-300'
                    : 'bg-slate-900 text-slate-200 border-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Back Accessories */}
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Back Accessory & Aura</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {ACCESSORIES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => update({ accessory: a.id })}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border ${
                  config.accessory === a.id
                    ? 'bg-rose-500 text-white border-rose-300'
                    : 'bg-slate-900 text-slate-200 border-white/10'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-black"
        >
          সেভ করে গেমে ফিরুন
        </button>
      </div>
    </div>
  );
};
