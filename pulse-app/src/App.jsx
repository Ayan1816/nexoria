import React, { useState, useEffect } from 'react';
import { Shield, Fingerprint, Activity, Cpu, Globe, Zap } from 'lucide-react';

export default function App() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (status === 'scanning') {
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setStatus('active');
            return 100;
          }
          return p + 2;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [status]);

  const getLoadingText = () => {
    if (progress < 30) return 'Establishing Arc L1 Node...';
    if (progress < 60) return 'Bypassing ETH Gas Protocols...';
    if (progress < 90) return 'Unifying Cross-Chain Balances...';
    return 'Identity Secured. Initializing...';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col items-center justify-center p-4 font-sans selection:bg-cyan-500/30 overflow-hidden relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#082f49_1px,transparent_1px),linear-gradient(to_bottom,#082f49_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] opacity-20"></div>

      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-600/20 rounded-full blur-[120px] transition-all duration-1000 ${status === 'active' ? 'opacity-100 scale-110' : 'opacity-30 scale-90'}`}></div>

      <div className="max-w-md w-full z-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] mb-6 relative overflow-hidden">
            <div className={`absolute inset-0 bg-cyan-500/10 ${status === 'scanning' ? 'animate-pulse' : 'hidden'}`}></div>
            <Shield className={`w-10 h-10 ${status === 'active' ? 'text-emerald-400' : 'text-cyan-400'}`} />
          </div>
          <h1 className="text-4xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            ARC<span className="text-white">VAULT</span>
          </h1>
          <p className="text-slate-500 font-mono text-[10px] uppercase tracking-widest mt-3 flex items-center justify-center">
            <Cpu className="w-3 h-3 mr-1" /> Enterprise Zero-Gas Protocol
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {status === 'idle' && (
            <div className="text-center animate-in fade-in duration-500">
              <p className="text-sm text-slate-400 mb-8 font-mono">
                System locked. Identity verification required to access Unified Cross-Chain Balances.
              </p>

              <button
                onClick={() => setStatus('scanning')}
                className="relative group w-32 h-32 mx-auto rounded-full bg-slate-950 border border-cyan-500/30 flex items-center justify-center hover:border-cyan-400 transition-all shadow-[0_0_40px_rgba(6,182,212,0.1)] active:scale-95"
              >
                <div className="absolute inset-0 rounded-full bg-cyan-500/5 group-hover:bg-cyan-500/10 transition-colors"></div>
                <Fingerprint className="w-16 h-16 text-cyan-500 group-hover:text-cyan-300 transition-colors" />

                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400/50 blur-[2px] hidden group-hover:block animate-[scan_2s_ease-in-out_infinite]"></div>
              </button>
              <p className="mt-6 text-xs text-cyan-500 font-mono tracking-widest uppercase">Tap to Initialize</p>
            </div>
          )}

          {status === 'scanning' && (
            <div className="text-center py-8 animate-in fade-in duration-300">
              <div className="relative w-24 h-24 mx-auto mb-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="48" cy="48" r="45" className="stroke-slate-800" strokeWidth="4" fill="none" />
                  <circle
                    cx="48"
                    cy="48"
                    r="45"
                    className="stroke-cyan-500 transition-all duration-100"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray="283"
                    strokeDashoffset={283 - (283 * progress) / 100}
                  />
                </svg>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold font-mono text-cyan-400">
                  {progress}%
                </div>
              </div>
              <p className="text-xs font-mono text-cyan-300 animate-pulse">{getLoadingText()}</p>
            </div>
          )}

          {status === 'active' && (
            <div className="animate-in slide-in-from-bottom-4 fade-in duration-700">
              <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
                <div>
                  <p className="text-[10px] text-slate-500 font-mono mb-1">NETWORK STATUS</p>
                  <div className="flex items-center text-emerald-400 font-mono text-xs font-bold">
                    <Activity className="w-3 h-3 mr-1" /> SECURE & LIVE
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 font-mono mb-1">GAS CONSUMPTION</p>
                  <p className="text-cyan-400 font-mono text-xs font-bold">0.00 USDC (NATIVE)</p>
                </div>
              </div>

              <div className="bg-black/40 rounded-2xl p-6 border border-cyan-900/50 mb-6 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-24 h-24 bg-cyan-500/5 rounded-bl-full"></div>
                <p className="text-xs text-slate-500 font-mono tracking-widest mb-2">UNIFIED BALANCE</p>
                <div className="flex items-baseline space-x-2">
                  <h2 className="text-4xl font-black text-white font-mono">1,024.50</h2>
                  <span className="text-cyan-500 font-bold">USDC</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button className="flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition-all group">
                  <Zap className="w-5 h-5 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono tracking-widest uppercase">Cross-Chain Swap</span>
                </button>
                <button className="flex flex-col items-center justify-center p-4 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 hover:border-cyan-400 transition-all group">
                  <Globe className="w-5 h-5 text-cyan-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-mono tracking-widest uppercase text-cyan-100">Deploy Escrow</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes scan {
            0% { top: 0; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
        `
      }} />
    </div>
  );
}
