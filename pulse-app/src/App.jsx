import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot, History, PenTool, Orbit, 
  Sun, Moon, LogOut, Cpu, Zap, ShieldCheck
} from 'lucide-react';

const modules = [
  { id: 'delegate', title: 'AI Agentic Delegate', subtitle: 'AUTONOMOUS POLICY ROUTING', description: 'Deploy an intent-driven delegate that negotiates treasury moves, routes liquidity, and watches risk in real time.', accent: 'from-cyan-400 to-blue-500', icon: Bot, stat: '92% SIGNAL CLARITY' },
  { id: 'history', title: 'Transaction Ledger', subtitle: 'ON-CHAIN RECEIPTS', description: 'Real-time history of all your executed transactions and transfers in this session.', accent: 'from-teal-400 to-emerald-500', icon: History, stat: 'LIVE SYNC' },
  { id: 'sign', title: 'Web3 Authenticator', subtitle: 'CRYPTOGRAPHIC PROOF', description: 'Sign custom messages using your wallet private key to prove identity and ownership.', accent: 'from-amber-400 to-orange-500', icon: PenTool, stat: 'NO GAS' },
  { id: 'passport', title: 'Holographic Web3 Passport', subtitle: 'PORTABLE IDENTITY MESH', description: 'A unified identity layer that travels with the user across the entire Arc network ecosystem.', accent: 'from-violet-500 to-fuchsia-500', icon: Orbit, stat: 'boss.arc' }
];

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
  
  const [aiCommand, setAiCommand] = useState('');
  const [aiLogs, setAiLogs] = useState([{ role: 'system', msg: 'System online. ArcOS AI Core ready. (Type: "Send 1 EURC to 0x..." or "Send 1 USDC to 0x...")' }]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const [txHistory, setTxHistory] = useState([]);
  const [signMessage, setSignMessage] = useState('');
  const [signature, setSignature] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

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
    } catch (e) { console.log("Balance fetch error", e); }
  };

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
      
      await updateBalances(targetProvider, address);
      setWalletAddress(address); setIsConnecting(false);
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
    setWalletAddress(null); setBalance('0.00'); setEurcBalance('0.00'); 
    setActiveProvider(null); setTxHistory([]); setSignature(''); 
  };

  const handleSignMessage = async () => {
    if (!walletAddress || !activeProvider || !signMessage) return;
    try {
      setIsExecuting(true); setSignature('');
      const sig = await activeProvider.request({ method: 'personal_sign', params: [signMessage, walletAddress] });
      setSignature(sig);
      setIsExecuting(false);
      confetti({ particleCount: 100, spread: 60, origin: { y: 0.7 }, colors: ['#fbbf24', '#f59e0b'] });
    } catch(e) { setIsExecuting(false); alert("Signing rejected!"); }
  };

  const handleAiCommand = async (cmd) => {
    if (!cmd) return;
    setAiLogs(prev => [...prev, { role: 'user', msg: cmd }]);
    setAiCommand('');
    setIsAiProcessing(true);
    const sendRegex = /(?:send|transfer|route)\s+([\d.]+)\s*(usdc|eurc)?\s+(?:to\s+)?(0x[a-fA-F0-9]{40})/i;
    const match = cmd.match(sendRegex);
    if (match) {
      const amountStr = match[1];
      const tokenSymbol = match[2] ? match[2].toUpperCase() : 'USDC';
      const toAddress = match[3];
      setAiLogs(prev => [...prev, { role: 'ai', msg: `⚡ Intent matched: Transfer ${amountStr} ${tokenSymbol} to ${toAddress.substring(0, 6)}... Requesting signature...` }]);
      if (!walletAddress || !activeProvider) {
         setIsAiProcessing(false);
         setAiLogs(prev => [...prev, { role: 'system', msg: `ERROR: Wallet not connected.` }]);
         return;
      }
      try {
        let txHashRes;
        if (tokenSymbol === 'USDC') {
          const val = BigInt(Math.floor(parseFloat(amountStr) * 1e18)).toString(16);
          txHashRes = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: toAddress, value: '0x' + val }] });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const signer = await provider.getSigner();
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], signer);
          const decimals = await contract.decimals();
          const tx = await contract.transfer(toAddress, window.ethers.parseUnits(amountStr, decimals));
          txHashRes = tx.hash;
        }
        setAiLogs(prev => [...prev, { role: 'ai', msg: `✅ On-chain Execution Successful! TX: ${txHashRes}` }]);
        setTxHistory(prev => [{ id: Date.now(), hash: txHashRes, amount: amountStr, token: tokenSymbol, to: toAddress, time: new Date().toLocaleTimeString() }, ...prev]);
        confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
        
        setTimeout(async () => {
          await updateBalances(activeProvider, walletAddress); 
        }, 5000);
      } catch(e) {
        setAiLogs(prev => [...prev, { role: 'system', msg: `ERROR: Execution failed or rejected by user.` }]);
      }
    } else {
       setTimeout(() => {
         setAiLogs(prev => [...prev, { role: 'ai', msg: `⚡ Intent received: "${cmd}". (Note: For REAL transfer, type "Send [amount] [USDC/EURC] to [0xAddress]")` }]);
       }, 1500);
    }
    setIsAiProcessing(false);
  };
    const formatAddr = (a) => a ? `${a.substring(0, 6)}...${a.substring(a.length - 4)}` : '';
  const activeData = modules.find(m => m.id === activeModule);
  const ActiveIcon = activeData.icon;

  const bgMain = isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-800';
  const bgCard = isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-300 shadow-lg';
  const bgHeader = isDark ? 'bg-slate-950/80 border-white/5' : 'bg-white/90 border-slate-300 shadow-sm';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDark ? 'bg-slate-950 border-white/10 text-white' : 'bg-slate-50 border-slate-300 text-slate-900';

  return (
    <div className={`min-h-screen font-sans selection:bg-cyan-500/30 transition-colors duration-500 relative ${bgMain}`}>
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

      <header className={`border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-500 ${bgHeader}`}>
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-cyan-500" />
              <span className={`font-bold tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>ARC<span className="text-cyan-500">OS</span></span>
            </div>
            <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full border ${isDark ? 'bg-slate-900 border-white/10 text-amber-400' : 'bg-slate-200 border-slate-300 text-indigo-600'} hover:scale-110 transition-all`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          {walletAddress ? (
            <button onClick={disconnectWallet} className={`px-4 py-2 rounded-lg text-sm font-mono font-bold border flex items-center gap-2 transition-all ${isDark ? 'bg-slate-900 border-cyan-500/30 text-cyan-400 hover:bg-rose-950/30 hover:border-rose-500/30 hover:text-rose-400' : 'bg-white border-cyan-500 text-cyan-600 hover:bg-rose-50 hover:border-rose-500 hover:text-rose-600'}`}>
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
        <section className={`border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 justify-between items-start relative overflow-hidden transition-colors duration-500 ${bgCard}`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500 font-mono">
              <Cpu className="w-3 h-3" /> ArcOS - Agentic Economic Matrix
            </div>
            <h1 className={`text-3xl md:text-5xl font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Future-proof finance, built for scale.</h1>
            <p className={`max-w-lg text-sm md:text-base ${textMuted}`}>Command liquidity, verify identity, and track on-chain motion from a single unified cockpit.</p>
          </div>
          <div className="flex flex-col gap-4 min-w-[200px] relative z-10 w-full md:w-auto">
            <div className={`rounded-xl p-4 border transition-colors ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`text-[10px] font-mono mb-1 ${textMuted}`}>NETWORK STATUS</div>
              <div className="flex items-center gap-2 text-emerald-500 font-mono text-sm"><Zap className="w-3 h-3" /> SECURE & LIVE</div>
            </div>
            <div className={`rounded-xl p-4 border transition-colors space-y-2 ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`text-[10px] font-mono ${textMuted}`}>OMNI-PORTFOLIO BALANCES</div>
              <div className={`flex justify-between items-center border-b pb-1 ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
                <span className="text-xs font-mono text-cyan-500 font-bold">USDC</span>
                <span className={`text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{balance}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs font-mono text-fuchsia-500 font-bold">EURC</span>
                <span className={`text-lg font-bold font-mono ${isDark ? 'text-white' : 'text-slate-900'}`}>{eurcBalance}</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-[10px] uppercase tracking-[0.2em] font-mono ${textMuted}`}>Choose a control surface</h2>
          </div>
          <div className="space-y-3">
            {modules.map((mod) => {
              const Icon = mod.icon;
              const isActive = activeModule === mod.id;
              const btnClass = isActive 
                ? (isDark ? 'bg-slate-900 border-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]' : 'bg-white border-cyan-500 shadow-md')
                : (isDark ? 'bg-slate-900/50 border-white/5 hover:bg-slate-900' : 'bg-slate-200/60 border-slate-300 hover:bg-white');
              
              return (
                <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left ${btnClass}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-cyan-500/20 text-cyan-500' : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-300 text-slate-600')}`}><Icon className="w-5 h-5" /></div>
                    <div>
                      <div className={`font-bold ${isActive ? (isDark ? 'text-white' : 'text-cyan-700') : (isDark ? 'text-slate-300' : 'text-slate-800')}`}>{mod.title}</div>
                      <div className="text-[10px] font-mono tracking-widest text-slate-500 mt-1">{mod.subtitle}</div>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 ${isActive ? 'text-cyan-500 translate-x-1' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </div>
        </section>
                <section className={`border rounded-2xl p-6 md:p-8 relative overflow-hidden transition-colors duration-500 ${bgCard}`}>
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${activeData.accent}`} />
          <div className="flex items-center justify-between mb-8">
            <div className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-mono ${textMuted}`}><ActiveIcon className="w-3 h-3 text-cyan-500" /> Active Module</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-600 font-mono bg-cyan-500/10 px-2 py-1 rounded font-bold">{activeData.stat}</div>
          </div>
          
          <div className="space-y-6">
            <div className={`inline-flex p-3 rounded-xl border text-cyan-500 ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-cyan-50 border-cyan-200'}`}><ActiveIcon className="w-6 h-6" /></div>
            <div>
              <h3 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>{activeData.title}</h3>
              <p className={`text-sm leading-relaxed max-w-2xl ${textMuted}`}>{activeData.description}</p>
            </div>

            {/* 🔥 MODULE 1: AI DELEGATE 🔥 */}
            {activeModule === 'delegate' && (
              <div className={`pt-6 mt-4 border-t ${isDark ? 'border-cyan-500/20' : 'border-cyan-200'}`}>
                <div className={`border rounded-2xl overflow-hidden flex flex-col h-[400px] shadow-lg relative ${isDark ? 'bg-slate-950/80 border-cyan-500/30' : 'bg-slate-50 border-cyan-300'}`}>
                  <div className={`p-3 border-b flex items-center justify-between ${isDark ? 'bg-cyan-950/30 border-cyan-500/20' : 'bg-cyan-100 border-cyan-200'}`}>
                    <div className="flex items-center gap-2">
                      <Bot className={`w-5 h-5 text-cyan-500 ${isAiProcessing ? 'animate-bounce' : ''}`} />
                      <span className="text-xs font-mono text-cyan-600 font-bold tracking-widest">ARC-AGENT_v1.0</span>
                    </div>
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] text-emerald-500 font-mono">ONLINE</span>
                    </div>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
                    {aiLogs.map((log, i) => (
                      <div key={i} className={`flex ${log.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-lg ${log.role === 'user' ? (isDark ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-100' : 'bg-cyan-600 text-white') : (isDark ? 'bg-slate-900 border border-white/10 text-emerald-400' : 'bg-white border border-slate-300 text-emerald-700')}`}>
                          {log.role === 'system' && <span className="text-slate-500 mr-2">SYS&gt;</span>}
                          {log.role === 'ai' && <span className="text-cyan-500 mr-2">AI&gt;</span>}
                          {log.msg}
                        </div>
                      </div>
                    ))}
                    {isAiProcessing && (
                      <div className="flex justify-start">
                        <div className={`border p-3 rounded-lg flex items-center gap-2 ${isDark ? 'bg-slate-900 border-white/10 text-cyan-400' : 'bg-white border-slate-300 text-cyan-600'}`}>
                          <Cpu className="w-4 h-4 animate-spin" /> Processing intent...
                        </div>
                      </div>
                    )}
                  </div>
                  <div className={`p-3 border-t flex gap-2 ${isDark ? 'bg-slate-900/50 border-white/10' : 'bg-slate-200 border-slate-300'}`}>
                    <input type="text" value={aiCommand} onChange={(e) => setAiCommand(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiCommand(aiCommand)} placeholder='Try: "Send 1 EURC to 0x..."' className={`flex-1 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500 transition-all ${inputBg}`} />
                    <button onClick={() => handleAiCommand(aiCommand)} disabled={isAiProcessing || !aiCommand} className="px-4 bg-cyan-500 text-white font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50 transition-colors">SEND</button>
                  </div>
                </div>
              </div>
            )}

            {/* 🔥 MODULE 2: TRANSACTION LEDGER 🔥 */}
            {activeModule === 'history' && (
              <div className={`pt-6 mt-4 border-t ${isDark ? 'border-teal-500/20' : 'border-teal-200'}`}>
                {txHistory.length === 0 ? (
                  <div className={`text-center py-10 font-mono text-sm ${textMuted}`}>No transactions recorded yet in this session. Send some assets!</div>
                ) : (
                  <div className="space-y-3">
                    {txHistory.map((tx) => (
                      <div key={tx.id} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-slate-950/50 border-teal-500/20' : 'bg-teal-50/50 border-teal-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-500 flex items-center justify-center"><CheckCircle className="w-4 h-4" /></div>
                          <div>
                            <div className={`font-bold font-mono text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Locked/Sent {tx.amount} {tx.token}</div>
                            <div className={`text-[10px] font-mono mt-1 ${textMuted}`}>To: {tx.to.substring(0,8)}... | Time: {tx.time}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-mono font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>SUCCESS</div>
                          <a href={`https://testnet.arcscan.app/tx/${tx.hash}`} target="_blank" rel="noreferrer" className={`text-[10px] font-mono hover:underline ${textMuted}`}>View Tx ↗</a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 🔥 MODULE 3: WEB3 AUTHENTICATOR 🔥 */}
            {activeModule === 'sign' && (
              <div className={`pt-6 mt-4 border-t ${isDark ? 'border-amber-500/20' : 'border-amber-200'}`}>
                <div className="mb-4">
                  <label className={`block text-[10px] font-mono mb-2 ${textMuted}`}>CUSTOM CRYPTOGRAPHIC MESSAGE</label>
                  <textarea rows="3" placeholder="I am verifying ownership of this wallet for ArcOS authentication..." value={signMessage} onChange={e => setSignMessage(e.target.value)} className={`w-full rounded-xl p-3 font-mono text-sm focus:outline-none focus:border-amber-500 transition-all resize-none ${inputBg}`} />
                </div>
                <button onClick={handleSignMessage} disabled={isExecuting || !signMessage} className="w-full md:w-auto px-8 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 mb-6">
                  <PenTool className="w-4 h-4" /> {isExecuting ? 'AWAITING WALLET SIGNATURE...' : 'SIGN MESSAGE NOW'}
                </button>
                {signature && (
                  <div className={`p-4 rounded-xl border break-all font-mono text-xs ${isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <div className="text-[10px] font-bold mb-2 text-amber-500 uppercase tracking-widest">Digital Signature Proof Generated:</div>
                    {signature}
                  </div>
                )}
              </div>
            )}

            {/* 🔥 MODULE 4: PASSPORT 🔥 */}
            {activeModule === 'passport' && (
              <div className={`pt-8 mt-6 border-t ${isDark ? 'border-fuchsia-500/20' : 'border-fuchsia-200'}`}>
                <div className="relative group w-full max-w-sm mx-auto">
                  <div className={`absolute inset-0 rounded-2xl blur-xl opacity-40 group-hover:opacity-70 transition duration-700 animate-pulse ${isDark ? 'bg-gradient-to-r from-fuchsia-600 to-cyan-600' : 'bg-gradient-to-r from-fuchsia-300 to-cyan-300'}`}></div>
                  <div className={`relative backdrop-blur-xl border rounded-2xl p-6 overflow-hidden ${isDark ? 'bg-slate-950/90 border-fuchsia-500/50 shadow-[0_0_40px_rgba(217,70,239,0.15)]' : 'bg-white/90 border-fuchsia-300 shadow-xl'}`}>
                    <div className="flex justify-between items-center mb-6">
                      <div className={`font-mono text-xs tracking-[0.3em] font-bold ${isDark ? 'text-fuchsia-400' : 'text-fuchsia-600'}`}>ARC CITIZEN</div>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center border border-white/20">
                        <Orbit className="w-5 h-5 text-white animate-spin-slow" />
                      </div>
                    </div>
                    <div className="space-y-5 relative z-10">
                      <div>
                        <div className={`text-[10px] font-mono mb-1 ${textMuted}`}>UNIVERSAL ID (ADDRESS)</div>
                        <div className={`text-sm font-mono p-3 rounded-lg border break-all text-center tracking-wider ${isDark ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-white' : 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900'}`}>
                          {walletAddress ? walletAddress : "SYSTEM OFFLINE"}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className={`flex-1 p-2 rounded-lg border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                          <div className={`text-[10px] font-mono mb-1 ${textMuted}`}>NETWORK MESH</div>
                          <div className="text-xs text-cyan-500 font-bold font-mono">ARC TESTNET</div>
                        </div>
                        <div className={`flex-1 p-2 rounded-lg border ${isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                          <div className={`text-[10px] font-mono mb-1 ${textMuted}`}>LIVE STATUS</div>
                          <div className="text-xs text-emerald-500 font-bold font-mono flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> {walletAddress ? "VERIFIED" : "AWAITING"}
                          </div>
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
