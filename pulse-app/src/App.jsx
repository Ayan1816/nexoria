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

const ESCROW_CONTRACT_ADDRESS = "0x384182B8041e6b959Adab44745efd728da7ADB0C";

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

  const [locks, setLocks] = useState([]);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState(null);

  const [aiCommand, setAiCommand] = useState('');
  const [aiLogs, setAiLogs] = useState([{ role: 'system', msg: 'System online. ArcOS AI Core ready for REAL on-chain execution. (Type: "Send 0.01 to 0x...")' }]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const arcChainIdHex = '0x4cef52'; 

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.ethers) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const fetchLockStatus = async () => {
    if (!walletAddress || !activeProvider || !window.ethers) return;
    try {
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const contract = new window.ethers.Contract(
        ESCROW_CONTRACT_ADDRESS,
        ["function getUserLocks(address) view returns (tuple(uint256 amount, uint256 unlockTime, bool claimed)[])"],
        provider
      );
      const data = await contract.getUserLocks(walletAddress);
      const formatted = data.map(d => ({
        amount: window.ethers.formatEther(d.amount),
        unlockTime: Number(d.unlockTime),
        claimed: d.claimed
      }));
      setLocks(formatted);
    } catch (e) { console.log("Lock fetch error:", e); }
  };

  useEffect(() => {
    if (activeModule === 'escrow' && walletAddress) fetchLockStatus();
  }, [activeModule, walletAddress, txHash]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true); setShowWalletModal(false); setActiveProvider(targetProvider); 
      try { await targetProvider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] }); } 
      catch (e) { setIsConnecting(false); return; }

      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const currentChain = await targetProvider.request({ method: 'eth_chainId' });
      
      if (currentChain.toLowerCase() !== arcChainIdHex.toLowerCase()) {
        try { await targetProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: arcChainIdHex }] }); } 
        catch (switchError) {
          if (switchError.code === 4902 || switchError.code === -32603) {
            await targetProvider.request({
              method: 'wallet_addEthereumChain',
              params: [{ chainId: arcChainIdHex, chainName: 'Arc Testnet', rpcUrls: ['https://rpc.testnet.arc.network'], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, blockExplorerUrls: ['https://testnet.arcscan.app'] }],
            });
          } else throw new Error("Cancelled");
        }
      }
      await new Promise(r => setTimeout(r, 1500));
      const balHex = await targetProvider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
      setWalletAddress(address); setBalance((parseInt(balHex, 16) / 1e18).toFixed(4)); setIsConnecting(false);
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

  const disconnectWallet = () => { setWalletAddress(null); setBalance('0.00'); setActiveProvider(null); setTxHash(null); setLocks([]); };

  const handleAction = async () => {
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
  };  const handleClaim = async (index) => {
    if (!window.ethers) return;
    try {
      setIsExecuting(true); setTxHash(null);
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const signer = await provider.getSigner();
      const contract = new window.ethers.Contract(ESCROW_CONTRACT_ADDRESS, ["function claimFunds(uint256) external"], signer);
      const tx = await contract.claimFunds(index);
      setTxHash(tx.hash); setIsExecuting(false);
      confetti({ particleCount: 300, spread: 150, origin: { y: 0.5 }, colors: ['#f59e0b', '#10b981'] });
      setTimeout(async () => {
        fetchLockStatus();
        const b = await activeProvider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] });
        setBalance((parseInt(b, 16) / 1e18).toFixed(4));
      }, 5000);
    } catch (e) { setIsExecuting(false); alert("Claim failed or time not over yet!"); }
  };

  // 🔥 রিয়েল AI ট্রানজেকশন লজিক
  const handleAiCommand = async (cmd) => {
    if (!cmd) return;
    setAiLogs(prev => [...prev, { role: 'user', msg: cmd }]);
    setAiCommand('');
    setIsAiProcessing(true);

    const sendRegex = /(?:send|transfer|route)\s+([\d.]+)\s*(?:usdc|eth)?\s+(?:to\s+)?(0x[a-fA-F0-9]{40})/i;
    const match = cmd.match(sendRegex);

    if (match) {
      const amountStr = match[1];
      const toAddress = match[2];

      setAiLogs(prev => [...prev, { role: 'ai', msg: `⚡ Intent matched: Transfer ${amountStr} USDC to ${toAddress.substring(0, 6)}... Requesting signature...` }]);

      if (!walletAddress || !activeProvider) {
         setIsAiProcessing(false);
         setAiLogs(prev => [...prev, { role: 'system', msg: `ERROR: Wallet not connected.` }]);
         return;
      }

      try {
        const val = BigInt(Math.floor(parseFloat(amountStr) * 1e18)).toString(16);
        const tx = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: toAddress, value: '0x' + val }] });
        
        setAiLogs(prev => [...prev, { role: 'ai', msg: `✅ On-chain Execution Successful! TX: ${tx}` }]);
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        
        setTimeout(async () => {
          const b = await activeProvider.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] });
          setBalance((parseInt(b, 16) / 1e18).toFixed(4));
        }, 5000);
      } catch(e) {
        setAiLogs(prev => [...prev, { role: 'system', msg: `ERROR: Execution failed or rejected by user.` }]);
      }
    } else {
       setTimeout(() => {
         setAiLogs(prev => [...prev, { role: 'ai', msg: `⚡ Intent received: "${cmd}". (Note: For REAL transfer, type "Send [amount] to [0xAddress]")` }]);
       }, 1500);
    }
    setIsAiProcessing(false);
  };

  const formatAddr = (a) => a ? `${a.substring(0, 6)}...${a.substring(a.length - 4)}` : '';
  const activeData = modules.find(m => m.id === activeModule);
  const ActiveIcon = activeData.icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30 relative">
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <div className="flex justify-between items-center text-white font-bold">
              <span>Select Web3 Wallet</span>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <div className="space-y-3 pt-2">
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
              {formatAddr(walletAddress)} <LogOut className="w-4 h-4" />
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
              <div className="text-[10px] text-slate-500 font-mono mb-1">ARC BALANCE</div>
              <div className="text-2xl font-bold text-white font-mono">{balance} <span className="text-cyan-500 text-sm">USDC</span></div>
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

            {/* 🔥 AI AGENTIC DELEGATE MODULE 🔥 */}
            {activeModule === 'delegate' && (
              <div className="pt-6 mt-4 border-t border-cyan-500/20">
                <div className="bg-slate-950/80 border border-cyan-500/30 rounded-2xl overflow-hidden flex flex-col h-[400px] shadow-[0_0_30px_rgba(34,211,238,0.1)] relative">
                  <div className="bg-cyan-950/30 p-3 border-b border-cyan-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bot className={`w-5 h-5 text-cyan-400 ${isAiProcessing ? 'animate-bounce' : ''}`} />
                      <span className="text-xs font-mono text-cyan-400 font-bold tracking-widest">ARC-AGENT_v1.0</span>
                    </div>
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] text-emerald-500 font-mono">ONLINE</span>
                    </div>
                  </div>

                  <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
                    {aiLogs.map((log, i) => (
                      <div key={i} className={`flex ${log.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-lg ${log.role === 'user' ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-100' : 'bg-slate-900 border border-white/10 text-emerald-400'}`}>
                          {log.role === 'system' && <span className="text-slate-500 mr-2">SYS&gt;</span>}
                          {log.role === 'ai' && <span className="text-cyan-500 mr-2">AI&gt;</span>}
                          {log.msg}
                        </div>
                      </div>
                    ))}
                    {isAiProcessing && (
                      <div className="flex justify-start">
                        <div className="bg-slate-900 border border-white/10 text-cyan-400 p-3 rounded-lg flex items-center gap-2">
                          <Cpu className="w-4 h-4 animate-spin" /> Processing intent...
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-slate-900/50 border-t border-white/10 flex gap-2">
                    <input 
                      type="text" 
                      value={aiCommand} 
                      onChange={(e) => setAiCommand(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAiCommand(aiCommand)}
                      placeholder='Try: "Send 0.01 to 0x..."' 
                      className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500/50 transition-all"
                    />
                    <button 
                      onClick={() => handleAiCommand(aiCommand)}
                      disabled={isAiProcessing || !aiCommand}
                      className="px-4 bg-cyan-500 text-slate-950 font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50 transition-colors"
                    >
                      SEND
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'escrow' && locks.length > 0 && (
              <div className="space-y-4 mt-6">
                {locks.map((lock, index) => {
                  if (parseFloat(lock.amount) === 0 || lock.claimed) return null;
                  
                  const diff = lock.unlockTime - currentTime;
                  const canClaim = diff <= 0;
                  const h = Math.floor(Math.max(0, diff) / 3600);
                  const m = Math.floor((Math.max(0, diff) % 3600) / 60);
                  const s = Math.max(0, diff) % 60;
                  const timeLeftStr = canClaim ? 'Ready to Claim!' : `${h}h ${m}m ${s}s remaining`;

                  return (
                    <div key={index} className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 text-[10px] font-mono text-emerald-500/50">ID: #{index}</div>
                      <div className="flex justify-between items-center text-emerald-400 font-mono text-sm border-b border-emerald-500/10 pb-2">
                        <span className="flex items-center gap-2">🔒 LOCKED FUND</span>
                        <span className="text-xl font-bold text-white">{lock.amount} USDC</span>
                      </div>
                      <div className="text-xs font-mono text-slate-300 flex justify-between items-center">
                        <span>⏱️ STATUS: <b className={canClaim ? "text-emerald-400" : "text-amber-400"}>{timeLeftStr}</b></span>
                        {canClaim && (
                          <button onClick={() => handleClaim(index)} disabled={isExecuting} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold rounded-lg hover:scale-105 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                            🎉 CLAIM
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {activeModule === 'shield' && (
              <div className="pt-4 space-y-4 border-t border-white/5 mt-4">
                <div>
                  <label className="block text-[10px] text-slate-500 font-mono mb-2">RECIPIENT ADDRESS</label>
                  <input type="text" placeholder="0x..." value={recipient} onChange={e => setRecipient(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 font-mono mb-2">AMOUNT (USDC)</label>
                  <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50 transition-all" />
                </div>
              </div>
            )}

            {activeModule === 'escrow' && (
              <div className="pt-4 space-y-4 border-t border-emerald-500/20 mt-4 bg-slate-950/50 p-4 rounded-xl">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] text-emerald-500 font-mono mb-2 flex items-center gap-1"><Lock className="w-3 h-3"/> AMOUNT TO LOCK (USDC)</label>
                    <input type="number" placeholder="2.00" value={escrowAmount} onChange={e => setEscrowAmount(e.target.value)} className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-400 transition-all" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-emerald-500 font-mono mb-2 flex items-center gap-1"><Timer className="w-3 h-3"/> LOCK DURATION</label>
                    <select value={escrowDuration} onChange={e => setEscrowDuration(e.target.value)} className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-emerald-400 font-mono text-sm focus:outline-none focus:border-emerald-400 transition-all">
                      <option value="1">1 Hour</option>
                      <option value="6">6 Hours</option>
                      <option value="24">24 Hours</option>
                      <option value="72">3 Days</option>
                    </select>
                  </div>
                </div>
                <button 
                  onClick={handleAction} 
                  disabled={isExecuting}
                  className="w-full px-8 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold rounded-xl disabled:opacity-50 hover:bg-emerald-500 hover:text-slate-950 transition-all flex items-center justify-center gap-2 mt-4"
                >
                  <Lock className="w-4 h-4" /> 
                  {isExecuting ? 'LOCKING FUND...' : `CREATE NEW LOCK`}
                </button>
              </div>
            )}

            {txHash && activeModule === 'shield' && (
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400 text-xs font-mono break-all mt-4">
                ✅ TX Hash: <a href={`https://testnet.arcscan.app/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline hover:text-cyan-300 mt-1 inline-block">{txHash}</a>
              </div>
            )}
            
            {activeModule === 'shield' && (
              <div className="pt-4 border-t border-white/5 mt-6">
                <button onClick={handleAction} disabled={isExecuting} className="w-full md:w-auto px-8 py-3 bg-white text-slate-950 font-bold rounded-xl hover:bg-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" /> {isExecuting ? 'EXECUTING ONCHAIN...' : `EXECUTE ${activeData.title.split(' ')[0].toUpperCase()}`}
                </button>
              </div>
            )}

            {activeModule === 'passport' && (
              <div className="pt-8 mt-6 border-t border-fuchsia-500/20">
                <div className="relative group w-full max-w-sm mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 to-cyan-600 rounded-2xl blur-xl opacity-40 group-hover:opacity-70 transition duration-700 animate-pulse"></div>
                  <div className="relative bg-slate-950/90 backdrop-blur-xl border border-fuchsia-500/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(217,70,239,0.15)] overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>
                    <div className="flex justify-between items-center mb-6">
                      <div className="text-fuchsia-400 font-mono text-xs tracking-[0.3em] font-bold">ARC CITIZEN</div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center border border-white/20 shadow-[0_0_15px_rgba(217,70,239,0.5)]">
                        <Orbit className="w-5 h-5 text-white animate-spin-slow" />
                      </div>
                    </div>
                    <div className="space-y-5 relative z-10">
                      <div>
                        <div className="text-[10px] text-slate-500 font-mono mb-1">UNIVERSAL ID (ADDRESS)</div>
                        <div className="text-sm md:text-base text-white font-mono bg-fuchsia-500/10 p-3 rounded-lg border border-fuchsia-500/30 break-all text-center tracking-wider">
                          {walletAddress ? walletAddress : "SYSTEM OFFLINE"}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1 bg-slate-900/50 p-2 rounded-lg border border-white/5">
                          <div className="text-[10px] text-slate-500 font-mono mb-1">NETWORK MESH</div>
                          <div className="text-xs text-cyan-400 font-bold font-mono">ARC TESTNET</div>
                        </div>
                        <div className="flex-1 bg-slate-900/50 p-2 rounded-lg border border-white/5">
                          <div className="text-[10px] text-slate-500 font-mono mb-1">LIVE STATUS</div>
                          <div className="text-xs text-emerald-400 font-bold font-mono flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> {walletAddress ? "VERIFIED" : "AWAITING"}
                          </div>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-fuchsia-500/20 flex justify-between items-end">
                        <div className="flex gap-1">
                          {[...Array(14)].map((_, i) => (
                            <div key={i} className="w-1 bg-fuchsia-500/60 rounded-full" style={{ height: `${Math.random() * 20 + 10}px` }}></div>
                          ))}
                        </div>
                        <div className="text-[10px] text-fuchsia-500 font-mono tracking-[0.2em] bg-fuchsia-500/10 px-2 py-1 rounded">
                          SEQ-{walletAddress ? walletAddress.substring(2, 6).toUpperCase() : "0000"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </section>
      </main>
    </div>
  );
}

  
