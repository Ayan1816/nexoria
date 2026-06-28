import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight, Bot, Boxes, Clock3, Cpu, Gauge, Globe2,
  Orbit, ShieldCheck, Sparkles, Wallet2, Zap, LogOut
} from 'lucide-react';

const modules = [
  { id: 'delegate', title: 'AI Agentic Delegate', subtitle: 'AUTONOMOUS POLICY ROUTING', description: 'Deploy an intent-driven delegate that negotiates treasury moves, routes liquidity, and watches risk in real time.', accent: 'from-cyan-400 to-blue-500', icon: Bot, stat: '92% SIGNAL CLARITY' },
  { id: 'escrow', title: 'Time-Stream Escrow', subtitle: 'PROGRAMMABLE MILESTONE TRUST', description: 'Release funds on a live cadence while preserving custody, compliance, and counterparty confidence.', accent: 'from-emerald-400 to-cyan-400', icon: Clock3, stat: '24/7 ESCROW PULSE' },
  { id: 'liquidity', title: 'Unified Liquidity Blackhole', subtitle: 'CONCENTRATED FLOW CONTROL', description: 'Bury fragmented balances into a single unified flow. Abstract away chain specifics entirely.', accent: 'from-fuchsia-500 to-cyan-500', icon: Boxes, stat: 'OMNICHAIN' },
  { id: 'shield', title: 'Silent Gas Shield', subtitle: 'ZERO-FRICTION EXECUTION', description: 'Native USDC gas abstraction. Users never see or pay native gas tokens like ETH or SOL again.', accent: 'from-blue-500 to-indigo-500', icon: ShieldCheck, stat: 'GAS: $0.00' },
  { id: 'passport', title: 'Holographic Web3 Passport', subtitle: 'PORTABLE IDENTITY MESH', description: 'A unified identity layer that travels with the user across the entire Arc network ecosystem.', accent: 'from-violet-500 to-fuchsia-500', icon: Orbit, stat: 'boss.arc' }
];

export default function App() {
  const [activeModule, setActiveModule] = useState(modules[0].id);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [balance, setBalance] = useState('0.00');
  const [showWalletModal, setShowWalletModal] = useState(false);

  const arcChainId = '0x1A4'; // Arc Testnet Chain ID

  const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true);
      setShowWalletModal(false);

      // ১. প্রতিবার জোর করে পারমিশন চাওয়া
      try {
        await targetProvider.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (pErr) {
        console.log("Permission request bypassed or cancelled");
      }

      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];

      // ২. জোর করে Arc Network-এ সুইচ করানো
      try {
        await targetProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: arcChainId }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          await targetProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: arcChainId,
              chainName: 'Arc Testnet',
              rpcUrls: ['https://rpc.testnet.arc.network'],
              nativeCurrency: { name: 'ARC', symbol: 'ARC', decimals: 18 }
            }],
          });
        }
      }

      // ৩. Arc চেইনের আসল ব্যালেন্স রিড করা
      const balanceHex = await targetProvider.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      
      setWalletAddress(address);
      setBalance((parseInt(balanceHex, 16) / 1e18).toFixed(4));
      setIsConnecting(false);

      confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 }, colors: ['#22d3ee', '#34d399', '#c084fc'] });
    } catch (error) {
      alert("Boss, connection cancelled or failed!");
      setIsConnecting(false);
    }
  };

  const handleProviderSelect = (walletType) => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert("No Web3 wallet found! Please open inside MetaMask or Rabby browser.");
      return;
    }
    const providers = window.ethereum.providers || [window.ethereum];
    let chosen = window.ethereum;

    if (walletType === 'rabby') {
      chosen = providers.find(p => p.isRabby) || window.ethereum;
    } else if (walletType === 'metamask') {
      chosen = providers.find(p => p.isMetaMask && !p.isRabby) || window.ethereum;
    }
    executeConnection(chosen);
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setBalance('0.00');
  };

  const handleAction = () => {
    if (!walletAddress) {
      alert('Boss, please connect your Web3 wallet first!');
      return;
    }
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22d3ee', '#f472b6'] });
  };

  const formatAddress = (addr) => addr ? `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}` : '';
  const activeData = modules.find(m => m.id === activeModule);
  const ActiveIcon = activeData.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 relative">
      
      {/* Wallet Selector Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <div className="flex justify-between items-center text-white font-bold">
              <span>Select Web3 Wallet</span>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-2 pt-2">
              <button onClick={() => handleProviderSelect('rabby')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex items-center justify-between text-cyan-400 font-bold transition-all">
                <span>Rabby Wallet</span> <span className="text-xs bg-cyan-500/10 px-2 py-1 rounded">INSTANT</span>
              </button>
              <button onClick={() => handleProviderSelect('metamask')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex items-center justify-between text-amber-400 font-bold transition-all">
                <span>MetaMask</span> <span className="text-xs bg-amber-500/10 px-2 py-1 rounded">POPULAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <span className="font-bold tracking-widest text-white">ARC<span className="text-cyan-400">OS</span></span>
          </div>
          
          {walletAddress ? (
            <button onClick={disconnectWallet} className="px-4 py-2 rounded-lg text-sm font-mono font-bold bg-slate-900 border border-cyan-500/30 text-cyan-400 flex items-center gap-2 hover:bg-rose-950/30 hover:border-rose-500/30 hover:text-rose-400 transition-all">
              {formatAddress(walletAddress)}
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => setShowWalletModal(true)} disabled={isConnecting} className="px-5 py-2 rounded-lg text-sm font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all">
              {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 justify-between items-start relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono">
              <Cpu className="w-3 h-3" /> ArcOS - Agentic Economic Matrix
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">Future-proof finance, tuned for autonomous motion.</h1>
            <p className="text-slate-400 max-w-lg text-sm md:text-base">Command liquidity, identity, and execution from a single premium cockpit built for the next era of onchain operations.</p>
          </div>
          <div className="flex flex-col gap-4 min-w-[200px] relative z-10 w-full md:w-auto">
            <div className="bg-slate-950 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-slate-500 font-mono mb-1">NETWORK STATUS</div>
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm"><Zap className="w-3 h-3" /> SECURE & LIVE</div>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-slate-500 font-mono mb-1">REAL BALANCE</div>
              <div className="text-2xl font-bold text-white font-mono">{balance} <span className="text-cyan-500 text-sm">ARC</span></div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono">Choose a control surface</h2>
            <Gauge className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="space-y-3">
            {modules.map((mod) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id;
              return (
                <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${isActive ? 'bg-slate-900 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]' : 'bg-slate-900/50 border-white/5 hover:bg-slate-900'}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}><Icon className="w-5 h-5" /></div>
                    <div>
                      <div className={`font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>{mod.title}</div>
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mt-1">{mod.subtitle}</div>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 ${isActive ? 'text-cyan-400 translate-x-1' : 'text-slate-600'}`} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${activeData.accent}`} />
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-mono"><Sparkles className="w-3 h-3 text-cyan-400" /> Active Module</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono bg-cyan-400/10 px-2 py-1 rounded">{activeData.stat}</div>
          </div>
          <div className="space-y-6">
            <div className="inline-flex p-3 rounded-xl bg-slate-800/50 border border-white/5 text-cyan-400"><ActiveIcon className="w-6 h-6" /></div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{activeData.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{activeData.description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-white/5">
                <div className="text-[10px] font-mono text-slate-500 mb-2 flex items-center gap-2"><Wallet2 className="w-3 h-3" /> TREASURY</div>
                <div className="text-sm font-medium text-slate-300">Protected and auto-routed</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-white/5">
                <div className="text-[10px] font-mono text-slate-500 mb-2 flex items-center gap-2"><Globe2 className="w-3 h-3" /> REACH</div>
                <div className="text-sm font-medium text-slate-300">Cross-chain by default</div>
              </div>
            </div>
            <div className="pt-4 border-t border-white/5 mt-6">
              <button onClick={handleAction} className="w-full md:w-auto px-8 py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-cyan-400 transition-all flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" /> EXECUTE {activeData.title.split(' ')[0].toUpperCase()}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
