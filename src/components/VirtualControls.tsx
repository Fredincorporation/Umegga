import React from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';

export const VirtualControls: React.FC = () => {
  const triggerKey = (key: string, type: 'keydown' | 'keyup') => {
    const event = new KeyboardEvent(type, { key, code: key, bubbles: true });
    window.dispatchEvent(event);
  };

  return (
    <div className="fixed right-4 bottom-4 z-30 flex flex-col items-center gap-1.5 p-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-3xl shadow-2xl md:hidden select-none">
      <button
        onPointerDown={() => triggerKey('w', 'keydown')}
        onPointerUp={() => triggerKey('w', 'keyup')}
        onPointerLeave={() => triggerKey('w', 'keyup')}
        className="w-11 h-11 rounded-2xl bg-slate-800 active:bg-sky-600 border border-slate-700 text-slate-200 active:text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
      <div className="flex gap-1.5">
        <button
          onPointerDown={() => triggerKey('a', 'keydown')}
          onPointerUp={() => triggerKey('a', 'keyup')}
          onPointerLeave={() => triggerKey('a', 'keyup')}
          className="w-11 h-11 rounded-2xl bg-slate-800 active:bg-sky-600 border border-slate-700 text-slate-200 active:text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onPointerDown={() => triggerKey('s', 'keydown')}
          onPointerUp={() => triggerKey('s', 'keyup')}
          onPointerLeave={() => triggerKey('s', 'keyup')}
          className="w-11 h-11 rounded-2xl bg-slate-800 active:bg-sky-600 border border-slate-700 text-slate-200 active:text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
        <button
          onPointerDown={() => triggerKey('d', 'keydown')}
          onPointerUp={() => triggerKey('d', 'keyup')}
          onPointerLeave={() => triggerKey('d', 'keyup')}
          className="w-11 h-11 rounded-2xl bg-slate-800 active:bg-sky-600 border border-slate-700 text-slate-200 active:text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
