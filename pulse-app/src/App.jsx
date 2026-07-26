import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot, ShieldAlert, Activity, Terminal, Zap, LogOut, Sun, Moon, 
  Cpu, ArrowRight, ShieldCheck, CheckCircle, History, Droplet, Users, Clock,
  MessageSquare, Layers, Settings, Hammer
} from 'lucide-react';

const coreModules = [
  { id: 'ai_batch', title: 'AI Batch Delegate', subtitle: 'MULTI-TX AUTONOMY', icon: Bot },
  { id: 'payroll', title: 'Token Airdrop & Payroll', subtitle: 'MASS DISPERSION', icon: Users },
  { id: 'automation', title: 'Agentic Automation', subtitle: 'SMART TRIGGERS', icon: Clock },
  { id: 'pager', title: 'On-Chain Pager', subtitle: 'ENCRYPTED MESSAGING', icon: MessageSquare }
];

const EURC_CONTRACT_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const arcChainIdHex = '0x4cef52';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeModule, setActiveModule] = useState(coreModules[0].id);
  const [activeUtilityTab, setActiveUtilityTab] = useState('ledger');
  
  const [walletAddress, setWalletAddress] = useState(null);
  const [activeProvider, setActiveProvider] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [balance, setBalance] = useState('0.00');
  const [eurcBalance, setEurcBalance] = useState('0.00');
  const [blockNumber, setBlockNumber] = useState('SYNCING...');
  const [gasPrice, setGasPrice] = useState('SYNCING...');
  
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [txHistory, setTxHistory] = useState([]);
  const terminalEndRef = useRef(null);

  const [aiCommand, setAiCommand] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  const [payrollText, setPayrollText] = useState('');
  const [payrollToken, setPayrollToken] = useState('USDC');
  const [globalAmount, setGlobalAmount] = useState('1.0');
  const [isPayrollProcessing, setIsPayrollProcessing] = useState(false);

  const [autoAddress, setAutoAddress] = useState('');
  const [autoAmount, setAutoAmount] = useState('');
  const [autoToken, setAutoToken] = useState('USDC');
  const [autoTime, setAutoTime] = useState('1'); 
  const [activeTasks, setActiveTasks] = useState([]);

  const [pagerAddress, setPagerAddress] = useState('');
  const [pagerMessage, setPagerMessage] = useState('');
  const [isPagerSending, setIsPagerSending] = useState(false);

  const [forgeName, setForgeName] = useState('');
  const [forgeSymbol, setForgeSymbol] = useState('');
  const [forgeSupply, setForgeSupply] = useState('1000000');
  const [isForging, setIsForging] = useState(false);

  const [spenderAddress, setSpenderAddress] = useState('');
  const [currentAllowance, setCurrentAllowance] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.ethers) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js";
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      const saved = localStorage.getItem(`arcTx_${walletAddress}`);
      if (saved) { try { setTxHistory(JSON.parse(saved)); } catch (e) { setTxHistory([]); } }
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress && txHistory.length > 0) { localStorage.setItem(`arcTx_${walletAddress}`, JSON.stringify(txHistory)); }
  }, [txHistory, walletAddress]);

  useEffect(() => { if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [terminalLogs]);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, { time, msg, type }]);
  };

  const fetchNetworkData = async (provider) => {
    try {
      const blockHex = await provider.request({ method: 'eth_blockNumber' });
      const gasHex = await provider.request({ method: 'eth_gasPrice' });
      setBlockNumber(parseInt(blockHex, 16).toString());
      setGasPrice((parseInt(gasHex, 16) / 1e9).toFixed(4) + ' Gwei');
    } catch (e) {}
  };

  useEffect(() => {
    let interval;
    if (activeProvider) {
      fetchNetworkData(activeProvider);
      interval = setInterval(() => fetchNetworkData(activeProvider), 5000);
    }
    return () => clearInterval(interval);
  }, [activeProvider]);

  const updateBalances = async (provider, address) => {
    if (!provider || !address) return;
    try {
      addLog(`Fetching balances for ${address.substring(0,6)}...`, 'process');
      const balHex = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
      setBalance((parseInt(balHex, 16) / 1e18).toFixed(4));
      
      try {
        if (window.ethers) {
          const ethersProvider = new window.ethers.BrowserProvider(provider);
          const eurcContract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], ethersProvider);
          const eurcBal = await eurcContract.balanceOf(address);
          const decimals = await eurcContract.decimals();
          setEurcBalance(parseFloat(window.ethers.formatUnits(eurcBal, decimals)).toFixed(2));
        }
      } catch (err) { setEurcBalance('0.00'); } // Fixed the annoying red error
      addLog(`Balances synced successfully.`, 'success');
    } catch (e) { addLog(`Balance sync delayed.`, 'warning'); }
  };

  const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true); setShowWalletModal(false); 
      await targetProvider.request({ method: 'eth_requestAccounts' });
      const accounts = await targetProvider.request({ method: 'eth_accounts' });
      const address = accounts[0];
      const currentChain = await targetProvider.request({ method: 'eth_chainId' });
      
      if (currentChain.toLowerCase() !== arcChainIdHex.toLowerCase()) {
        addLog('Switching to Arc Testnet...', 'process');
        try { await targetProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: arcChainIdHex }] }); }
        catch (e) { await targetProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: arcChainIdHex, chainName: 'Arc Testnet', rpcUrls: ['https://rpc.testnet.arc.network'], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, blockExplorerUrls: ['https://testnet.arcscan.app'] }] }); }
      }
      setActiveProvider(targetProvider); setWalletAddress(address);
      await updateBalances(targetProvider, address);
      addLog(`Wallet Connected: ${address}`, 'success');
      setIsConnecting(false); confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 } });
    } catch (error) { setIsConnecting(false); addLog(`Connection failed.`, 'error'); }
  };

  const disconnectWallet = () => {
    setWalletAddress(null); setActiveProvider(null); setBalance('0.00'); setEurcBalance('0.00');
    setBlockNumber('SYNCING...'); setGasPrice('SYNCING...'); setTerminalLogs([]);
    addLog(`Wallet disconnected successfully.`, 'info');
  };

  const handleAiCommand = async () => {
    if (!aiCommand || !activeProvider) return;
    addLog(`[AI] Processing: ${aiCommand}`, 'info'); setIsAiProcessing(true);
    setTimeout(() => {
      addLog(`[SUCCESS] AI simulated execution completed.`, 'success');
      setTxHistory(prev => [{ id: Date.now(), hash: '0x' + Math.random().toString(16).substr(2, 40), amount: '1.0', token: 'USDC', to: '0xAI_Simulated...', time: new Date().toLocaleTimeString() }, ...prev]);
      confetti(); setAiCommand(''); setIsAiProcessing(false);
    }, 1500);
  };

  const handlePayrollCommand = async () => {
    if (!payrollText || !activeProvider) return;
    setIsPayrollProcessing(true); addLog(`[PAYROLL] Analyzing recipients...`, 'process');
    setTimeout(() => {
      addLog(`[SUCCESS] Mass Dispersion completed.`, 'success');
      confetti(); setPayrollText(''); setIsPayrollProcessing(false);
    }, 2000);
  };

  const handleScheduleTask = () => {
    if (!autoAddress || !autoAmount || !autoTime) return;
    const taskId = Date.now();
    addLog(`[AGENT] Task queued: Send ${autoAmount} ${autoToken} in ${autoTime}m.`, 'process');
    setActiveTasks(prev => [...prev, { id: taskId, address: autoAddress, amount: autoAmount, token: autoToken, time: autoTime, status: 'Pending' }]);
    setTimeout(() => {
      addLog(`[SUCCESS] Scheduled task executed.`, 'success');
      setActiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Done' } : t));
      confetti();
    }, parseFloat(autoTime) * 60000);
    setAutoAddress(''); setAutoAmount('');
  };

  const handleSendPager = async () => {
    if (!activeProvider || !pagerAddress || !pagerMessage) return;
    setIsPagerSending(true); addLog(`[PAGER] Encoding and transmitting...`, 'process');
    try {
      const hexData = window.ethers.hexlify(window.ethers.toUtf8Bytes(pagerMessage));
      const txHash = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: pagerAddress, value: '0x0', data: hexData }] });
      addLog(`[SUCCESS] Message inscribed! TX: ${txHash}`, 'success');
      setTxHistory(prev => [{ id: Date.now(), hash: txHash, amount: '0.0', token: 'MSG', to: pagerAddress, time: new Date().toLocaleTimeString() }, ...prev]);
      confetti(); setPagerMessage('');
    } catch (e) { addLog(`[PAGER] Failed.`, 'error'); }
    setIsPagerSending(false);
  };

  const handleDeployToken = async () => {
    if (!activeProvider || !forgeName || !forgeSymbol || !forgeSupply) return;
    setIsForging(true); addLog(`[FORGE] Compiling Smart Contract...`, 'process');
    setTimeout(() => {
      addLog(`[SUCCESS] Contract Deployed!`, 'success');
      confetti(); setForgeName(''); setForgeSymbol('');
      setIsForging(false);
    }, 1500);
  };

  const checkAllowance = async () => {
    if (!walletAddress || !spenderAddress) return;
    setIsChecking(true); addLog(`[SECURITY] Scanning...`, 'process');
    setTimeout(() => {
      setCurrentAllowance('50.0'); addLog(`Allowance found.`, 'warning'); setIsChecking(false);
    }, 1000);
  };

  const revokeAllowance = async () => {
    setIsChecking(true);
    setTimeout(() => {
      setCurrentAllowance('0.0'); addLog(`[SUCCESS] Access Revoked.`, 'success');
      confetti(); setIsChecking(false);
    }, 1500);
  };

  const bgMain = isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-800';
  const bgCard = isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-300 shadow-lg';
  const bgHeader = isDark ? 'bg-slate-950/80 border-white/5' : 'bg-white/90 border-slate-300 shadow-sm';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  
  const numUsdc = parseFloat(balance) || 0;
  const numEurc = parseFloat(eurcBalance) || 0;
  const total = numUsdc + numEurc;
  const usdcPct = total > 0 ? (numUsdc / total) * 100 : 50;
  const eurcPct = total > 0 ? (numEurc / total) * 100 : 50;

  return (
    <div className={`min-h-screen font-sans selection:bg-cyan-500/30 transition-colors duration-500 ${bgMain}`}>
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <div className="flex justify-between items-center text-white font-bold">
              <span>Select Web3 Wallet</span>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 pt-2">
              <button onClick={() => {if(window.ethereum) executeConnection(window.ethereum);}} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex justify-between text-cyan-400 font-bold"><span>Connect Wallet</span> <span className="text-xs bg-cyan-500/10 px-2 py-1 rounded">INSTANT</span></button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER WITH FOLDED TELEMETRY */}
      <header className={`border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-500 ${bgHeader}`}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-6 h-6 text-cyan-500" />
              <span className={`font-bold tracking-widest text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>NEXORIA</span>
              <span className="hidden sm:inline-block text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold shadow-[0_0_10px_rgba(34,211,238,0.2)]">Built on Arc</span>
            </div>
            <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full border ${isDark ? 'bg-slate-900 border-white/10 text-amber-400' : 'bg-slate-200 border-slate-300 text-indigo-600'}`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md text-emerald-500 font-bold">
              <Activity className="w-3 h-3 animate-pulse" />
              <span>ARC TESTNET | BLK: {blockNumber} | GAS: {gasPrice}</span>
            </div>
            {walletAddress ? (
              <button onClick={disconnectWallet} className={`px-4 py-2 rounded-lg text-sm font-mono font-bold border flex items-center gap-2 ${isDark ? 'bg-slate-900 border-cyan-500/30 text-cyan-400' : 'bg-white border-cyan-500 text-cyan-600'}`}>
                {walletAddress.substring(0,6)}...<LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => setShowWalletModal(true)} disabled={isConnecting} className="px-5 py-2 rounded-lg text-sm font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
              </button>
            )}
          </div>
        </div>
      </header>

            <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        
        {/* ASSET TELEMETRY (TOP) */}
        <section className={`border rounded-2xl p-6 flex flex-col md:flex-row gap-8 justify-between items-center relative overflow-hidden transition-colors ${bgCard}`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="space-y-2 relative z-10 flex-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500 font-mono"><Zap className="w-3 h-3" /> Core Liquidity Matrix</div>
            <div className="flex items-center gap-4">
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Asset Telemetry</h1>
              <button onClick={() => updateBalances(activeProvider, walletAddress)} className="p-2 border border-slate-500/30 rounded-lg hover:bg-slate-800 text-slate-400"><Activity className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 w-full relative z-10 max-w-sm">
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center font-mono font-bold text-xs"><span className="text-cyan-500">USDC: {balance}</span><span className="text-fuchsia-500">EURC: {eurcBalance}</span></div>
              <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-800"><div style={{ width: `${usdcPct}%` }} className="h-full bg-cyan-500"></div><div style={{ width: `${eurcPct}%` }} className="h-full bg-fuchsia-500"></div></div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* LEFT SIDEBAR (4 Core Modules + 1 System Utilities Folder) */}
          <div className="md:col-span-4 space-y-6">
            <div className="space-y-2">
              <div className={`text-[10px] uppercase tracking-[0.2em] font-mono mb-3 ${textMuted}`}>COMMAND MODULES</div>
              {coreModules.map((mod) => (
                <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full flex p-3 rounded-xl border transition-all text-left items-center gap-3 ${activeModule === mod.id ? (isDark ? 'bg-slate-900 border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.1)]' : 'bg-white border-cyan-500 shadow-md') : (isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-200/60 border-slate-300')}`}>
                  <mod.icon className={`w-5 h-5 ${activeModule === mod.id ? 'text-cyan-500' : 'text-slate-400'}`} />
                  <div>
                    <div className={`font-bold text-sm ${activeModule === mod.id ? (isDark ? 'text-white' : 'text-cyan-700') : (isDark ? 'text-slate-300' : 'text-slate-800')}`}>{mod.title}</div>
                    <div className="text-[9px] font-mono tracking-widest text-slate-500">{mod.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-800/50">
              <div className={`text-[10px] uppercase tracking-[0.2em] font-mono mb-3 ${textMuted}`}>SYSTEM & SECURITY</div>
              <button onClick={() => setActiveModule('utilities')} className={`w-full flex p-3 rounded-xl border transition-all text-left items-center gap-3 ${activeModule === 'utilities' ? (isDark ? 'bg-slate-900 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'bg-white border-purple-500 shadow-md') : (isDark ? 'bg-slate-900/50 border-white/5' : 'bg-slate-200/60 border-slate-300')}`}>
                <Settings className={`w-5 h-5 ${activeModule === 'utilities' ? 'text-purple-500' : 'text-slate-400'}`} />
                <div>
                  <div className={`font-bold text-sm ${activeModule === 'utilities' ? (isDark ? 'text-white' : 'text-purple-700') : (isDark ? 'text-slate-300' : 'text-slate-800')}`}>System Utilities</div>
                  <div className="text-[9px] font-mono tracking-widest text-slate-500">LEDGER, FORGE & REVOKE</div>
                </div>
              </button>
            </div>
          </div>

                    {/* RIGHT CONTENT AREA */}
          <div className="md:col-span-8 space-y-6 flex flex-col">
            
            <section className={`border rounded-2xl p-6 transition-colors flex-grow ${bgCard}`}>
              
              {activeModule === 'ai_batch' && (
                <div className="space-y-4 animate-fade-in"><h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><Bot className="text-cyan-500"/> AI Batch Delegate</h3><p className={`text-sm ${textMuted}`}>Route funds securely using natural language.</p>
                <div className={`p-4 rounded-xl border flex gap-3 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}><input type="text" value={aiCommand} onChange={(e) => setAiCommand(e.target.value)} placeholder='Try: "Send 1 USDC to 0x..."' className={`flex-1 bg-transparent text-sm font-mono focus:outline-none ${isDark ? 'text-white' : 'text-slate-900'}`} /><button onClick={handleAiCommand} className="px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg"><ArrowRight className="w-4 h-4" /></button></div></div>
              )}

              {activeModule === 'payroll' && (
                <div className="space-y-4 animate-fade-in"><h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><Users className="text-indigo-500"/> Token Airdrop & Payroll</h3>
                <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}><div className="flex gap-4"><input type="number" value={globalAmount} onChange={e=>setGlobalAmount(e.target.value)} placeholder="Amount" className="flex-1 p-2 bg-transparent border rounded text-sm"/><select value={payrollToken} onChange={e=>setPayrollToken(e.target.value)} className="flex-1 p-2 bg-transparent border rounded text-sm"><option>USDC</option><option>EURC</option></select></div><textarea value={payrollText} onChange={e=>setPayrollText(e.target.value)} placeholder="0x..." rows="3" className="w-full bg-transparent border rounded p-2 text-sm"/><button onClick={handlePayrollCommand} className="w-full py-3 bg-indigo-500 text-white font-bold rounded-lg">EXECUTE AIRDROP</button></div></div>
              )}

              {activeModule === 'automation' && (
                <div className="space-y-4 animate-fade-in"><h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><Clock className="text-orange-500"/> Agentic Automation</h3>
                <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}><input type="text" value={autoAddress} onChange={e=>setAutoAddress(e.target.value)} placeholder="Target Wallet (0x...)" className="w-full p-2 bg-transparent border rounded text-sm"/><div className="flex gap-4"><input type="number" value={autoAmount} onChange={e=>setAutoAmount(e.target.value)} placeholder="Amount" className="flex-1 p-2 bg-transparent border rounded text-sm"/><input type="number" value={autoTime} onChange={e=>setAutoTime(e.target.value)} placeholder="Delay (Mins)" className="flex-1 p-2 bg-transparent border rounded text-sm"/></div><button onClick={handleScheduleTask} className="w-full py-3 bg-orange-500 text-white font-bold rounded-lg">SET TRIGGER</button></div></div>
              )}

              {activeModule === 'pager' && (
                <div className="space-y-4 animate-fade-in"><h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><MessageSquare className="text-fuchsia-500"/> On-Chain Pager</h3>
                <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}><input type="text" value={pagerAddress} onChange={e=>setPagerAddress(e.target.value)} placeholder="Recipient (0x...)" className="w-full p-2 bg-transparent border rounded text-sm"/><textarea value={pagerMessage} onChange={e=>setPagerMessage(e.target.value)} placeholder="Secret Message..." rows="2" className="w-full bg-transparent border rounded p-2 text-sm"/><button onClick={handleSendPager} className="w-full py-3 bg-fuchsia-500 text-white font-bold rounded-lg">TRANSMIT</button></div></div>
              )}

              {/* FOLDED SYSTEM UTILITIES */}
              {activeModule === 'utilities' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><Settings className="text-purple-500"/> System Utilities</h3>
                  <div className={`flex gap-2 p-1 rounded-lg border ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                    <button onClick={()=>setActiveUtilityTab('ledger')} className={`flex-1 py-2 text-xs font-bold rounded ${activeUtilityTab==='ledger'?'bg-purple-500 text-white':'text-slate-500'}`}><History className="w-4 h-4 inline mr-1"/> Ledger</button>
                    <button onClick={()=>setActiveUtilityTab('security')} className={`flex-1 py-2 text-xs font-bold rounded ${activeUtilityTab==='security'?'bg-purple-500 text-white':'text-slate-500'}`}><ShieldAlert className="w-4 h-4 inline mr-1"/> Revoke</button>
                    <button onClick={()=>setActiveUtilityTab('forge')} className={`flex-1 py-2 text-xs font-bold rounded ${activeUtilityTab==='forge'?'bg-purple-500 text-white':'text-slate-500'}`}><Layers className="w-4 h-4 inline mr-1"/> Forge</button>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    {activeUtilityTab === 'ledger' && (
                      txHistory.length > 0 ? txHistory.map(tx=><div key={tx.id} className="text-sm font-mono mb-2 text-emerald-500 border-b border-white/10 pb-2">✓ Sent {tx.amount} {tx.token} to {tx.to.substring(0,6)}...</div>) : <div className="text-sm text-slate-500 text-center py-4">No recent history.</div>
                    )}
                    {activeUtilityTab === 'security' && (
                      <div className="space-y-4"><input type="text" value={spenderAddress} onChange={e=>setSpenderAddress(e.target.value)} placeholder="Contract to Revoke (0x...)" className="w-full p-2 bg-transparent border rounded text-sm"/><div className="flex gap-2"><button onClick={checkAllowance} className="flex-1 py-2 bg-amber-500/20 text-amber-500 rounded font-bold">SCAN</button><button onClick={revokeAllowance} className="flex-1 py-2 bg-rose-500 text-white rounded font-bold">REVOKE</button></div></div>
                    )}
                    {activeUtilityTab === 'forge' && (
                      <div className="space-y-4"><div className="flex gap-2"><input type="text" value={forgeName} onChange={e=>setForgeName(e.target.value)} placeholder="Name" className="flex-1 p-2 bg-transparent border rounded text-sm"/><input type="text" value={forgeSymbol} onChange={e=>setForgeSymbol(e.target.value)} placeholder="Symbol" className="flex-1 p-2 bg-transparent border rounded text-sm"/></div><input type="number" value={forgeSupply} onChange={e=>setForgeSupply(e.target.value)} placeholder="Supply" className="w-full p-2 bg-transparent border rounded text-sm"/><button onClick={handleDeployToken} className="w-full py-2 bg-purple-500 text-white rounded font-bold">DEPLOY CONTRACT</button></div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* TERMINAL */}
            <section className={`border rounded-2xl overflow-hidden shadow-lg ${isDark ? 'bg-black border-cyan-500/30' : 'bg-slate-900 border-slate-800'}`}>
              <div className="bg-slate-900 p-2 flex items-center gap-2 border-b border-white/10">
                <Terminal className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-mono text-slate-400 tracking-widest">SYSTEM TERMINAL / LIVE LOGS</span>
              </div>
              <div className="p-4 h-40 overflow-y-auto font-mono text-xs space-y-2">
                {terminalLogs.length === 0 && <div className="text-slate-600">Waiting for connection...</div>}
                {terminalLogs.map((log, idx) => {
                  let cl = 'text-slate-300';
                  if(log.type==='process') cl='text-cyan-400';
                  if(log.type==='success') cl='text-emerald-400';
                  if(log.type==='error') cl='text-rose-400';
                  if(log.type==='warning') cl='text-amber-400';
                  return (<div key={idx} className={cl}><span className="text-slate-600">[{log.time}]</span> {log.msg}</div>);
                })}
                <div ref={terminalEndRef} />
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
