import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot, Clock3, History, PenTool, Orbit, 
  ShieldCheck, Sun, Moon, LogOut, Lock, Timer, 
  CheckCircle, Cpu, Zap
} from 'lucide-react';

const modules = [
  { id: 'delegate', title: 'AI Agentic Delegate', subtitle: 'AUTONOMOUS POLICY ROUTING', description: 'Deploy an intent-driven delegate that negotiates treasury moves, routes liquidity, and watches risk in real time.', accent: 'from-cyan-400 to-blue-500', icon: Bot, stat: '92% SIGNAL CLARITY' },
  { id: 'escrow', title: 'Time-Stream Escrow', subtitle: 'PROGRAMMABLE MILESTONE TRUST', description: 'Lock funds securely in a time-locked smart contract. Watch live countdown and claim funds once time expires.', accent: 'from-emerald-400 to-cyan-400', icon: Clock3, stat: '24/7 ESCROW PULSE' },
  { id: 'history', title: 'Transaction Ledger', subtitle: 'ON-CHAIN RECEIPTS', description: 'Real-time history of all your executed transactions and transfers in this session.', accent: 'from-teal-400 to-emerald-500', icon: History, stat: 'LIVE SYNC' },
  { id: 'sign', title: 'Web3 Authenticator', subtitle: 'CRYPTOGRAPHIC PROOF', description: 'Sign custom messages using your wallet private key to prove identity and ownership.', accent: 'from-amber-400 to-orange-500', icon: PenTool, stat: 'NO GAS' },
  { id: 'passport', title: 'Holographic Web3 Passport', subtitle: 'PORTABLE IDENTITY MESH', description: 'A unified identity layer that travels with the user across the entire Arc network ecosystem.', accent: 'from-violet-500 to-fuchsia-500', icon: Orbit, stat: 'boss.arc' }
];

const ESCROW_CONTRACT_ADDRESS = "0x384182B8041e6b959Adab44745efd728da7ADB0C";
const EURC_CONTRACT_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a"; 
const arcChainIdHex = '0x4cef52';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeModule, setActiveModule] = useState(modules[0].id);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [balance, setBalance] = useState('0.00');
  const [eurcBalance, setEurcBalance] = useState('0.00');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [activeProvider, setActiveProvider] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [locks, setLocks] = useState([]);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const [aiCommand, setAiCommand] = useState('');
  const [aiLogs, setAiLogs] = useState([{ role: 'system', msg: 'System online. ArcOS AI Core ready.' }]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [txHistory, setTxHistory] = useState([]);
  const [signMessage, setSignMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [escrowAmount, setEscrowAmount] = useState('');
  const [escrowDuration, setEscrowDuration] = useState('1');

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.ethers) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);
    const updateBalances = async (provider, address) => {
    try {
      const balHex = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
      setBalance((parseInt(balHex, 16) / 1e18).toFixed(4));
      
      if (window.ethers) {
        const ethersProvider = new window.ethers.BrowserProvider(provider);
        const eurcContract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], ethersProvider);
        const eurcBal = await eurcContract.balanceOf(address);
        const decimals = await eurcContract.decimals();
        setEurcBalance(parseFloat(window.ethers.formatUnits(eurcBal, decimals)).toFixed(2));
      }
    } catch (e) { console.log("Balance update error", e); }
  };

  const fetchLockStatus = async () => {
    if (!walletAddress || !activeProvider || !window.ethers) return;
    try {
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const contract = new window.ethers.Contract(ESCROW_CONTRACT_ADDRESS, ["function getUserLocks(address) view returns (tuple(uint256 amount, uint256 unlockTime, bool claimed)[])"], provider);
      const data = await contract.getUserLocks(walletAddress);
      setLocks(data.map(d => ({ amount: window.ethers.formatEther(d.amount), unlockTime: Number(d.unlockTime), claimed: d.claimed })));
    } catch (e) { console.log("Lock fetch error:", e); }
  };

  useEffect(() => {
    if (activeModule === 'escrow' && walletAddress) fetchLockStatus();
  }, [activeModule, walletAddress, txHash]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
    const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true); setShowWalletModal(false); setActiveProvider(targetProvider);
      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      setWalletAddress(address);
      await updateBalances(targetProvider, address);
      setIsConnecting(false);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 } });
    } catch (error) { setIsConnecting(false); }
  };

  const handleEscrowLock = async () => {
    if (!window.ethers || !escrowAmount) return;
    try {
      setIsExecuting(true);
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const signer = await provider.getSigner();
      const contract = new window.ethers.Contract(ESCROW_CONTRACT_ADDRESS, ["function lockFunds(uint256) external payable"], signer);
      const tx = await contract.lockFunds(parseInt(escrowDuration) * 3600, { value: window.ethers.parseEther(escrowAmount) });
      
      setTxHistory(prev => [{ id: Date.now(), hash: tx.hash, amount: escrowAmount, token: 'USDC', to: 'Escrow Vault', time: new Date().toLocaleTimeString() }, ...prev]);
      
      await tx.wait();
      setTxHash(tx.hash);
      await updateBalances(activeProvider, walletAddress);
      fetchLockStatus();
      setIsExecuting(false);
      confetti({ particleCount: 250, spread: 120, origin: { y: 0.6 } });
    } catch (e) { setIsExecuting(false); alert("Lock failed!"); }
  };
    const handleAiCommand = async (cmd) => {
    if (!cmd) return;
    setAiLogs(prev => [...prev, { role: 'user', msg: cmd }]);
    setAiCommand('');
    setIsAiProcessing(true);
    const match = cmd.match(/(?:send|transfer)\s+([\d.]+)\s*(usdc|eurc)?\s+(?:to\s+)?(0x[a-fA-F0-9]{40})/i);
    if (match) {
      try {
        let txHashRes;
        const [_, amount, token, to] = match;
        const symbol = (token || 'USDC').toUpperCase();
        
        if (symbol === 'USDC') {
          txHashRes = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to, value: '0x' + BigInt(Math.floor(parseFloat(amount) * 1e18)).toString(16) }] });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], await provider.getSigner());
          txHashRes = (await contract.transfer(to, window.ethers.parseUnits(amount, await contract.decimals()))).hash;
        }
        
        setTxHistory(prev => [{ id: Date.now(), hash: txHashRes, amount, token: symbol, to, time: new Date().toLocaleTimeString() }, ...prev]);
        setAiLogs(prev => [...prev, { role: 'ai', msg: `✅ Success! Tx: ${txHashRes}` }]);
        await updateBalances(activeProvider, walletAddress);
      } catch(e) { setAiLogs(prev => [...prev, { role: 'system', msg: `ERROR: Execution failed.` }]); }
    }
    setIsAiProcessing(false);
  };
    const formatAddr = (a) => a ? `${a.substring(0, 6)}...${a.substring(a.length - 4)}` : '';
  const activeData = modules.find(m => m.id === activeModule);
  
  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
      <header className={`border-b ${isDark ? 'bg-slate-950/80 border-white/5' : 'bg-white border-slate-300'}`}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold tracking-widest text-white">ARC<span className="text-cyan-500">OS</span></div>
          <div className="flex gap-4 items-center">
            <div className="text-sm font-mono text-cyan-500">{balance} USDC</div>
            <div className="text-sm font-mono text-fuchsia-500">{eurcBalance} EURC</div>
            {walletAddress ? (
              <button onClick={() => {setWalletAddress(null); setActiveProvider(null)}} className="px-4 py-1 rounded bg-rose-500/20 text-rose-400 text-xs border border-rose-500/30">DISCONNECT</button>
            ) : (
              <button onClick={() => setShowWalletModal(true)} className="px-4 py-1 rounded bg-cyan-500 text-slate-900 text-xs font-bold">CONNECT</button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="md:col-span-2 space-y-3">
            {modules.map(mod => (
              <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full p-4 rounded-xl border ${activeModule === mod.id ? 'bg-cyan-500/10 border-cyan-500' : 'bg-slate-900 border-white/5'}`}>
                <div className="flex items-center gap-3">
                  <mod.icon className="w-5 h-5 text-cyan-500" />
                  <span className="font-bold text-sm">{mod.title}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="md:col-span-3 p-6 rounded-2xl border bg-slate-900 border-white/5">
                        {activeModule === 'delegate' && (
              <div className="space-y-4">
                {aiLogs.map((log, i) => <div key={i} className="font-mono text-xs p-2 bg-slate-950 rounded">{log.msg}</div>)}
                <div className="flex gap-2">
                  <input className="flex-1 bg-slate-950 p-2 rounded text-sm" value={aiCommand} onChange={e => setAiCommand(e.target.value)} placeholder="Send 1 USDC to 0x..." />
                  <button onClick={() => handleAiCommand(aiCommand)} className="bg-cyan-500 px-4 rounded text-xs font-bold text-slate-900">SEND</button>
                </div>
              </div>
            )}
            
            {activeModule === 'escrow' && (
              <div className="space-y-4">
                <input type="number" placeholder="Amount" className="w-full bg-slate-950 p-2 rounded text-sm" onChange={e => setEscrowAmount(e.target.value)} />
                <button onClick={handleEscrowLock} className="w-full bg-emerald-500 p-2 rounded text-sm font-bold">LOCK FUNDS</button>
              </div>
            )}

            {activeModule === 'history' && (
              <div className="space-y-2">
                {txHistory.map(tx => <div key={tx.id} className="p-2 border-b border-white/5 text-xs font-mono">Sent {tx.amount} {tx.token} at {tx.time}</div>)}
              </div>
            )}
            
            {activeModule === 'sign' && (
              <div className="space-y-4">
                <textarea className="w-full bg-slate-950 p-2 rounded text-sm" placeholder="Sign message..." onChange={e => setSignMessage(e.target.value)} />
                <button onClick={async () => setSignature(await activeProvider.request({ method: 'personal_sign', params: [signMessage, walletAddress] }))} className="bg-amber-500 px-4 py-2 rounded text-sm font-bold text-slate-900">SIGN</button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
