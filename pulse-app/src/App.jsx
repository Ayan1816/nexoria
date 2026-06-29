import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowRight, Bot, Boxes, Clock3, Cpu, Gauge, Globe2,
  Orbit, ShieldCheck, Sparkles, Wallet2, Zap, LogOut, Lock, Timer, Unlock
} from 'lucide-react';

const modules = [
  { id: 'delegate', title: 'AI Agentic Delegate', subtitle: 'AUTONOMOUS POLICY ROUTING', description: 'Deploy an intent-driven delegate that negotiates treasury moves, routes liquidity, and watches risk in real time.', accent: 'from-cyan-400 to-blue-500', icon: Bot, stat: '92% SIGNAL CLARITY' },
  { id: 'escrow', title: 'Time-Stream Escrow', subtitle: 'PROGRAMMABLE MILESTONE TRUST', description: 'Lock funds securely in a time-locked smart contract. Watch live countdown and claim funds once time expires.', accent: 'from-emerald-400 to-cyan-400', icon: Clock3, stat: '24/7 ESCROW PULSE' },
  { id: 'liquidity', title: 'Unified Liquidity Blackhole', subtitle: 'CONCENTRATED FLOW CONTROL', description: 'Bury fragmented balances into a single unified flow. Abstract away chain specifics entirely.', accent: 'from-fuchsia-500 to-cyan-500', icon: Boxes, stat: 'OMNICHAIN' },
  { id: 'shield', title: 'Silent Gas Shield', subtitle: 'ZERO-FRICTION EXECUTION', description: 'Native USDC gas abstraction. Users never see or pay native gas tokens like ETH or SOL again. Test Real Transaction Here.', accent: 'from-blue-500 to-indigo-500', icon: ShieldCheck, stat: 'GAS: $0.00' },
  { id: 'passport', title: 'Holographic Web3 Passport', subtitle: 'PORTABLE IDENTITY MESH', description: 'A unified identity layer that travels with the user across the entire Arc network ecosystem.', accent: 'from-violet-500 to-fuchsia-500', icon: Orbit, stat: 'boss.arc' }
];

const ESCROW_CONTRACT_ADDRESS = "0xB10A0aF8618CA1f288993B35Dbb72997E15B5B90";

export default function App() {
  const [activeModule, setActiveModule] = useState(modules[0].id);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [balance, setBalance] = useState('0.00');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);
  
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');

  const [escrowAmount, setEscrowAmount] = useState('');
  const [escrowDuration, setEscrowDuration] = useState('1');

  // 🔥 নতুন: Live Escrow States
  const [lockedData, setLockedData] = useState({ amount: '0', unlockTime: 0, claimed: false });
  const [timeLeft, setTimeLeft] = useState('');
  const [canClaim, setCanClaim] = useState(false);

  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState(null);

  const arcChainIdHex = '0x4cef52'; 

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.ethers) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // স্মার্ট কন্ট্রাক্ট থেকে লাইভ ডাটা চেক করা
  const fetchLockStatus = async () => {
    if (!walletAddress || !activeProvider || !window.ethers) return;
    try {
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const contract = new window.ethers.Contract(
        ESCROW_CONTRACT_ADDRESS,
        ["function userLocks(address) view returns (uint256 amount, uint256 unlockTime, bool claimed)"],
        provider
      );
      const data = await contract.userLocks(walletAddress);
      const amt = window.ethers.formatEther(data.amount);
      setLockedData({
        amount: amt,
        unlockTime: Number(data.unlockTime),
        claimed: data.claimed
      });
    } catch (e) { console.log("Lock fetch error:", e); }
  };

  useEffect(() => {
    if (activeModule === 'escrow' && walletAddress) {
      fetchLockStatus();
    }
  }, [activeModule, walletAddress, txHash]);

  // লাইভ টাইমার লজিক
  useEffect(() => {
    if (lockedData.unlockTime === 0 || lockedData.claimed || parseFloat(lockedData.amount) === 0) {
      setTimeLeft('');
      setCanClaim(false);
      return;
    }
    const timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = lockedData.unlockTime - now;
      if (diff <= 0) {
        setTimeLeft('Unlocked! Ready to Claim.');
        setCanClaim(true);
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        setTimeLeft(`${h}h ${m}m ${s}s remaining`);
        setCanClaim(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedData]);

  const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true);
      setShowWalletModal(false);
      setActiveProvider(targetProvider); 
      try {
        await targetProvider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      } catch (e) { setIsConnecting(false); return; }

      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const currentChain = await targetProvider.request({ method: 'eth_chainId' });
      
      if (currentChain.toLowerCase() !== arcChainIdHex.toLowerCase()) {
        try {
          await targetProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: arcChainIdHex }] });
        } catch (switchError) {
          if (switchError.code === 4902 || switchError.code === -32603) {
            await targetProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: arcChainIdHex, chainName: 'Arc Testnet',
                rpcUrls: ['https://rpc.testnet.arc.network'],
                nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, 
                blockExplorerUrls: ['https://testnet.arcscan.app']
              }],
            });
          } else throw new Error("Cancelled");
        }
      }
      await new Promise(r => setTimeout(r, 1500));
      const balHex = await targetProvider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
      setWalletAddress(address);
      setBalance((parseInt(balHex, 16) / 1e18).toFixed(4));
      setIsConnecting(false);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 } });
    } catch (error) { setIsConnecting(false); }
  };

  const handleProviderSelect = (type) => {
    if (!window.ethereum) return alert("No wallet!");
    const provs = window.ethereum.providers || [window.ethereum];
    let chosen = window.ethereum;
    if (type === 'rabby') chosen = provs.find(p => p.isRabby) || window.ethereum;
    else if (type === 'metamask') chosen = provs.find(p => p.isMetaMask && !p.isRabby) || window.ethereum;
    executeConnection(chosen);
  };

  const disconnectWallet = () => {
    setWalletAddress(null); setBalance('0.00'); setActiveProvider(null); setTxHash(null);
  };  const handleAction = async () => {
    if (!walletAddress || !activeProvider) return alert('Connect wallet first!');

    if (activeModule === 'shield') {
      if (!recipient || !amount) return alert('Fill fields!');
      try {
        setIsExecuting(true); setTxHash(null);
        const val = BigInt(Math.floor(parseFloat(amount) * 1e18)).toString(16);
        const tx = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: recipient, value: '0x' + val }] });
        setTxHash(tx); setIsExecuting(false); confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        setTimeout(async () => {
          const b = await activeProvider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] });
          setBalance((parseInt(b, 16) / 1e18).toFixed(4));
        }, 5000);
      } catch (e) { setIsExecuting(false); }

    } else if (activeModule === 'escrow') {
      if (!escrowAmount || parseFloat(escrowAmount) <= 0) return alert('Enter valid amount!');
      if (!window.ethers) return alert('Engine loading, click again!');
      try {
        setIsExecuting(true); setTxHash(null);
        const dur = parseInt(escrowDuration) * 3600;
        const provider = new window.ethers.BrowserProvider(activeProvider);
        const signer = await provider.getSigner();
        const contract = new window.ethers.Contract(ESCROW_CONTRACT_ADDRESS, ["function lockFunds(uint256) external payable"], signer);
        const tx = await contract.lockFunds(dur, { value: window.ethers.parseEther(escrowAmount) });
        setTxHash(tx.hash); setIsExecuting(false); confetti({ particleCount: 250, spread: 120, origin: { y: 0.6 } });
        setTimeout(() => { fetchLockStatus(); }, 4000);
      } catch (e) { setIsExecuting(false); alert("Failed!"); }
    }
  };

  // 🔥 নতুন: টাকা তোলার (Claim) ফাংশন
  const handleClaim = async () => {
    if (!window.ethers) return;
    try {
      setIsExecuting(true);
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const signer = await provider.getSigner();
      const contract = new window.ethers.Contract(ESCROW_CONTRACT_ADDRESS, ["function claimFunds() external"], signer);
      const tx = await contract.claimFunds();
      setTxHash(tx.hash);
      setIsExecuting(false);
      confetti({ particleCount: 300, spread: 150, origin: { y: 0.5 }, colors: ['#f59e0b', '#10b981'] });
      setTimeout(async () => {
        fetchLockStatus();
        const b = await activeProvider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] });
        setBalance((parseInt(b, 16) / 1e18).toFixed(4));
      }, 5000);
    } catch (e) { setIsExecuting(false); alert("Claim failed or time not over yet!"); }
  };

  const formatAddr = (a) => a ? `${a.substring(0, 6)}...${a.substring(a.length - 4)}` : '';
  const activeData = modules.find(m => m.id === activeModule);
  const ActiveIcon = activeData.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative">
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex justify-between text-white font-bold"><span>Select Wallet</span><button onClick={() => setShowWalletModal(false)}>✕</button></div>
            <div className="space-y-3 pt-2">
              <button onClick={() => handleProviderSelect('rabby')} className="w-full p-4 bg-slate-950 border border-white/5 rounded-xl text-cyan-400 font-bold flex justify-between"><span>Rabby</span><span className="text-xs bg-cyan-500/10 px-2 py-1 rounded">INSTANT</span></button>
              <button onClick={() => handleProviderSelect('metamask')} className="w-full p-4 bg-slate-950 border border-white/5 rounded-xl text-amber-400 font-bold flex justify-between"><span>MetaMask</span><span className="text-xs bg-amber-500/10 px-2 py-1 rounded">POPULAR</span></button>
            </div>
          </div>
        </div>
      )}

      <header className="border-b border-white/5 bg-slate-950/80 sticky top-0 z-40 h-16 flex items-center justify-between px-4 max-w-4xl mx-auto">
        <div className="flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-cyan-400" /><span className="font-bold text-white tracking-widest">ARC<span className="text-cyan-400">OS</span></span></div>
        {walletAddress ? <button onClick={disconnectWallet} className="px-4 py-2 rounded-lg bg-slate-900 border border-cyan-500/30 text-cyan-400 font-mono text-sm font-bold flex gap-2">{formatAddr(walletAddress)}<LogOut className="w-4 h-4"/></button> : <button onClick={() => setShowWalletModal(true)} className="px-5 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold font-mono text-sm">CONNECT WALLET</button>}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <section className="bg-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 flex justify-between items-start">
          <div className="space-y-4"><div className="text-[10px] text-cyan-400 font-mono tracking-widest">ArcOS Matrix</div><h1 className="text-3xl md:text-5xl font-bold text-white">Future-proof finance.</h1></div>
          <div className="bg-slate-950 p-4 rounded-xl border border-white/5"><div className="text-[10px] text-slate-500 font-mono">BALANCE</div><div className="text-2xl font-bold text-white font-mono">{balance} <span className="text-cyan-500 text-sm">USDC</span></div></div>
        </section>

        <section className="space-y-3">
          {modules.map(mod => {
            const Icon = mod.icon; const act = activeModule === mod.id;
            return <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full flex justify-between p-4 rounded-xl border transition-all text-left ${act ? 'bg-slate-900 border-cyan-500/50 text-white' : 'bg-slate-900/50 border-white/5 text-slate-400'}`}><div className="flex gap-4 items-center"><Icon className="w-5 h-5 text-cyan-400"/><div><div className="font-bold">{mod.title}</div><div className="text-[10px] font-mono">{mod.subtitle}</div></div></div><ArrowRight className="w-4 h-4"/></button>;
          })}
        </section>

        <section className="bg-slate-900 border border-white/5 rounded-2xl p-6 md:p-8 space-y-6">
          <h3 className="text-2xl font-bold text-white flex gap-2 items-center"><ActiveIcon className="text-cyan-400"/>{activeData.title}</h3>
          <p className="text-slate-400 text-sm">{activeData.description}</p>

          {/* 🔥 LIVE ESCROW STATUS DASHBOARD */}
          {activeModule === 'escrow' && parseFloat(lockedData.amount) > 0 && !lockedData.claimed && (
            <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-emerald-400 font-mono text-sm border-b border-emerald-500/20 pb-2">
                <span className="flex items-center gap-2">🔒 CURRENTLY LOCKED:</span>
                <span className="text-xl font-bold text-white">{lockedData.amount} USDC</span>
              </div>
              <div className="text-xs font-mono text-slate-300 flex justify-between items-center">
                <span>⏱️ STATUS: <b className="text-amber-400">{timeLeft}</b></span>
                {canClaim && (
                  <button onClick={handleClaim} disabled={isExecuting} className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold rounded-lg animate-pulse hover:scale-105 transition-all">
                    🎉 CLAIM YOUR {lockedData.amount} USDC
                  </button>
                )}
              </div>
            </div>
          )}

          {activeModule === 'shield' && (
            <div className="space-y-4 pt-4 border-t border-white/5"><input type="text" placeholder="To 0x..." value={recipient} onChange={e=>setRecipient(e.target.value)} className="w-full p-3 bg-slate-950 rounded-xl border border-white/10 text-white font-mono text-sm"/><input type="number" placeholder="Amount" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full p-3 bg-slate-950 rounded-xl border border-white/10 text-white font-mono text-sm"/></div>
          )}

          {activeModule === 'escrow' && (
            <div className="flex gap-4 pt-4 border-t border-white/5"><input type="number" placeholder="Lock Amount (USDC)" value={escrowAmount} onChange={e=>setEscrowAmount(e.target.value)} className="w-full p-3 bg-slate-950 rounded-xl border border-white/10 text-white font-mono text-sm"/><select value={escrowDuration} onChange={e=>setEscrowDuration(e.target.value)} className="w-full p-3 bg-slate-950 rounded-xl border border-white/10 text-white font-mono text-sm"><option value="1">1 Hour</option><option value="6">6 Hours</option></select></div>
          )}

          {txHash && <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 text-xs font-mono break-all">✅ TX: <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">{txHash}</a></div>}

          <button onClick={handleAction} disabled={isExecuting} className="w-full py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-cyan-400 transition-all">{isExecuting ? 'EXECUTING...' : `LOCK / EXECUTE`}</button>
        </section>
      </main>
    </div>
  );
          }

  
