import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  Bot,
  Boxes,
  Clock3,
  Cpu,
  Gauge,
  Globe2,
  Orbit,
  ShieldCheck,
  Sparkles,
  Wallet2,
  Zap,
  LogOut
} from 'lucide-react';

const modules = [
  {
    id: 'delegate',
    title: 'AI Agentic Delegate',
    subtitle: 'AUTONOMOUS POLICY ROUTING',
    description: 'Deploy an intent-driven delegate that negotiates treasury moves, routes liquidity, and watches risk in real time.',
    accent: 'from-cyan-400 to-blue-500',
    icon: Bot,
    stat: '92% SIGNAL CLARITY'
  },
  {
    id: 'escrow',
    title: 'Time-Stream Escrow',
    subtitle: 'PROGRAMMABLE MILESTONE TRUST',
    description: 'Release funds on a live cadence while preserving custody, compliance, and counterparty confidence.',
    accent: 'from-emerald-400 to-cyan-400',
    icon: Clock3,
    stat: '24/7 ESCROW PULSE'
  },
  {
    id: 'liquidity',
    title: 'Unified Liquidity Blackhole',
    subtitle: 'CONCENTRATED FLOW CONTROL',
    description: 'Bury fragmented balances into a single unified flow. Abstract away chain specifics entirely.',
    accent: 'from-fuchsia-500 to-cyan-500',
    icon: Boxes,
    stat: 'OMNICHAIN'
  },
  {
    id: 'shield',
    title: 'Silent Gas Shield',
    subtitle: 'ZERO-FRICTION EXECUTION',
    description: 'Native USDC gas abstraction. Users never see or pay native gas tokens like ETH or SOL again.',
    accent: 'from-blue-500 to-indigo-500',
    icon: ShieldCheck,
    stat: 'GAS: $0.00'
  },
  {
    id: 'passport',
    title: 'Holographic Web3 Passport',
    subtitle: 'PORTABLE IDENTITY MESH',
    description: 'A unified identity layer that travels with the user across the entire Arc network ecosystem.',
    accent: 'from-violet-500 to-fuchsia-500',
    icon: Orbit,
    stat: 'boss.arc'
  }
];

export default function App() {
  const [activeModule, setActiveModule] = useState(modules[0].id);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [balance, setBalance] = useState('0.00');

  const arcChainId = '0x1A4'; // Arc Testnet Chain ID

  const connectRealWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        setIsConnecting(true);
        
        // ১. একাউন্ট কানেক্ট রিকোয়েস্ট
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];

        // ২. Arc Network-এ সুইচ করার চেষ্টা
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: arcChainId }],
          });
        } catch (switchError) {
          // নেটওয়ার্ক না থাকলে অ্যাড করে নেবে
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: arcChainId,
                  chainName: 'Arc Testnet',
                  rpcUrls: ['https://rpc.testnet.arc.network'],
                  nativeCurrency: {
                    name: 'ARC Token',
                    symbol: 'ARC',
                    decimals: 18,
                  },
                },
              ],
            });
          } else {
            throw switchError;
          }
        }

        // ৩. ব্যালেন্স রিড করা
        const balanceHex = await window.ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest']
        });
        
        const realBalance = (parseInt(balanceHex, 16) / 1e18).toFixed(4);
        
        setWalletAddress(address);
        setBalance(realBalance);
        setIsConnecting(false);

        // সাকসেস এনিমেশন
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.3 },
          colors: ['#22d3ee', '#34d399', '#c084fc']
        });

      } catch (error) {
        console.error("Connection error:", error);
        alert("Boss, wallet connection failed! Please try again.");
        setIsConnecting(false);
      }
    } else {
      alert('Boss, Please open this site inside MetaMask or Trust Wallet DApp browser! 🚀');
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setBalance('0.00');
  };

  const handleAction = () => {
    if (!walletAddress) {
      alert('Boss, please connect your Web3 wallet first! 🚀');
      return;
    }
    confetti({
      particleCount: 100,
      angle: 90,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22d3ee', '#f472b6']
    });
  };

  const formatAddress = (address) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const activeData = modules.find(m => m.id === activeModule);
  const ActiveIcon = activeData.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
      
      <header className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            <span className="font-bold tracking-widest text-white">ARC<span className="text-cyan-400">OS</span></span>
          </div>
          
          {walletAddress ? (
            <button 
              onClick={disconnectWallet}
              className="px-4 py-2 rounded-lg text-sm font-mono font-bold bg-slate-900 border border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)] flex items-center gap-2 hover:bg-slate-800 transition-all"
            >
              {formatAddress(walletAddress)}
              <LogOut className="w-4 h-4 text-rose-400" />
            </button>
          ) : (
            <button 
              onClick={connectRealWallet}
              disabled={isConnecting}
              className="px-5 py-2 rounded-lg text-sm font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all duration-300"
            >
              {isConnecting ? 'SYNCING...' : 'CONNECT WALLET'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        <section className="bg-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 justify-between items-start relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono">
              <Cpu className="w-3 h-3" />
              ArcOS - Agentic Economic Matrix
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">
              Future-proof finance, tuned for autonomous motion.
            </h1>
            <p className="text-slate-400 max-w-lg text-sm md:text-base">
              Command liquidity, identity, and execution from a single premium cockpit built for the next era of onchain operations.
            </p>
          </div>

          <div className="flex flex-col gap-4 min-w-[200px] relative z-10 w-full md:w-auto">
            <div className="bg-slate-950 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-slate-500 font-mono mb-1 uppercase tracking-wider">Network Status</div>
              <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm">
                <Zap className="w-3 h-3" />
                ARC LIVE
              </div>
            </div>
            
            <div className="bg-slate-950 rounded-xl p-4 border border-white/5">
              <div className="text-[10px] text-slate-500 font-mono mb-1 uppercase tracking-wider">Arc Balance</div>
              <div className="text-2xl font-bold text-white font-mono">
                {balance} <span className="text-cyan-500 text-sm">ARC</span>
              </div>
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
                <button
                  key={mod.id}
                  onClick={() => setActiveModule(mod.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 text-left ${
                    isActive 
                      ? 'bg-slate-900 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]' 
                      : 'bg-slate-900/50 border-white/5 hover:bg-slate-900 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className={`font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>{mod.title}</div>
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mt-1">{mod.subtitle}</div>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 transition-transform ${isActive ? 'text-cyan-400 translate-x-1' : 'text-slate-600'}`} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${activeData.accent}`} />
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-400 font-mono">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              Active Module
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-400 font-mono bg-cyan-400/10 px-2 py-1 rounded">
              {activeData.stat}
            </div>
          </div>

          <div className="space-y-6">
            <div className="inline-flex p-3 rounded-xl bg-slate-800/50 border border-white/5 text-cyan-400">
              <ActiveIcon className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">{activeData.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
                {activeData.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-white/5">
                <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                  <Wallet2 className="w-3 h-3" /> TREASURY
                </div>
                <div className="text-sm font-medium text-slate-300">Protected and auto-routed</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-950 border border-white/5">
                <div className="text-[10px] font-mono tracking-widest text-slate-500 mb-2 flex items-center gap-2">
                  <Globe2 className="w-3 h-3" /> REACH
                </div>
                <div className="text-sm font-medium text-slate-300">Cross-chain by default</div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 mt-6">
              <button 
                onClick={handleAction}
                className="w-full md:w-auto px-8 py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                EXECUTE {activeData.title.split(' ')[0].toUpperCase()}
              </button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
