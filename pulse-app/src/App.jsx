import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot, ShieldAlert, Activity, Terminal, Zap, LogOut, Sun, Moon, 
  Cpu, ArrowRight, ShieldCheck, CheckCircle, History, Droplet, Users, Clock
} from 'lucide-react';

const modules = [
  { id: 'ai_batch', title: 'AI Batch Delegate', subtitle: 'MULTI-TX AUTONOMY', description: 'Command the AI to execute multiple transactions across different assets simultaneously.', accent: 'from-cyan-400 to-blue-500', icon: Bot, stat: 'AI CORE' },
  { id: 'payroll', title: 'Token Airdrop & Payroll', subtitle: 'MASS DISPERSION', description: 'Distribute tokens to multiple addresses at once.', accent: 'from-indigo-400 to-purple-500', icon: Users, stat: 'BATCH SENDER' },
  { id: 'automation', title: 'Agentic Automation', subtitle: 'SMART TRIGGERS', description: 'Set time-delayed smart contract triggers for autonomous execution.', accent: 'from-orange-400 to-red-500', icon: Clock, stat: 'KEEPERS' },
  { id: 'history', title: 'Transaction Ledger', subtitle: 'ON-CHAIN RECEIPTS', description: 'Real-time history of all executed transactions.', accent: 'from-teal-400 to-emerald-500', icon: History, stat: 'LIVE SYNC' },
  { id: 'security', title: 'Token Security Matrix', subtitle: 'SMART REVOKE', description: 'Scan and revoke third-party smart contract allowances.', accent: 'from-amber-400 to-rose-500', icon: ShieldAlert, stat: 'SCANNER' },
  { id: 'telemetry', title: 'Arc Network Telemetry', subtitle: 'LIVE NODE DATA', description: 'Direct RPC feed from Arc Testnet showing real-time metrics.', accent: 'from-emerald-400 to-teal-500', icon: Activity, stat: 'LIVE SYNC' }
];

const EURC_CONTRACT_ADDRESS = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const arcChainIdHex = '0x4cef52';

export default function App() {
  const [isDark, setIsDark] = useState(true);
  const [activeModule, setActiveModule] = useState(modules[0].id);
  
  const [walletAddress, setWalletAddress] = useState(null);
  const [activeProvider, setActiveProvider] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [balance, setBalance] = useState('0.00');
  const [eurcBalance, setEurcBalance] = useState('0.00');
  
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [txHistory, setTxHistory] = useState([]);
  const terminalEndRef = useRef(null);

  // States
  const [aiCommand, setAiCommand] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  const [payrollText, setPayrollText] = useState('');
  const [payrollToken, setPayrollToken] = useState('USDC');
  const [globalAmount, setGlobalAmount] = useState('1.0');
  const [isPayrollProcessing, setIsPayrollProcessing] = useState(false);

  // Automation States
  const [autoAddress, setAutoAddress] = useState('');
  const [autoAmount, setAutoAmount] = useState('');
  const [autoToken, setAutoToken] = useState('USDC');
  const [autoTime, setAutoTime] = useState('1'); // Minutes
  const [activeTasks, setActiveTasks] = useState([]);

  const [blockNumber, setBlockNumber] = useState('SYNCING...');
  const [gasPrice, setGasPrice] = useState('SYNCING...');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [currentAllowance, setCurrentAllowance] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      const savedHistory = localStorage.getItem(`arcTx_${walletAddress}`);
      if (savedHistory) { try { setTxHistory(JSON.parse(savedHistory)); } catch (e) { setTxHistory([]); } }
    }
  }, [walletAddress]);

  useEffect(() => {
    if (walletAddress && txHistory.length > 0) { localStorage.setItem(`arcTx_${walletAddress}`, JSON.stringify(txHistory)); }
  }, [txHistory, walletAddress]);

  useEffect(() => { if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [terminalLogs]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.ethers) {
      const script = document.createElement('script');
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.1/ethers.umd.min.js";
      document.body.appendChild(script);
    }
  }, []);
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
    } catch (e) { console.log(e); }
  };

  const updateBalances = async (provider, address) => {
    if (!provider || !address) return;
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
    } catch (e) { addLog(`Balance fetch error: ${e.message}`, 'error'); }
  };

  useEffect(() => {
    let interval;
    if (activeProvider && activeModule === 'telemetry') {
      fetchNetworkData(activeProvider);
      interval = setInterval(() => fetchNetworkData(activeProvider), 3000);
    }
    return () => clearInterval(interval);
  }, [activeProvider, activeModule]);

  const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true); setShowWalletModal(false); 
      try { await targetProvider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] }); } catch (e) { setIsConnecting(false); return; }
      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const currentChain = await targetProvider.request({ method: 'eth_chainId' });
      if (currentChain.toLowerCase() !== arcChainIdHex.toLowerCase()) {
        try { await targetProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: arcChainIdHex }] }); }
        catch (e) {
          if (e.code === 4902 || e.code === -32603) { await targetProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: arcChainIdHex, chainName: 'Arc Testnet', rpcUrls: ['https://rpc.testnet.arc.network'], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 } }] }); }
        }
      }
      await new Promise(r => setTimeout(r, 1500));
      setActiveProvider(targetProvider); setWalletAddress(address);
      await updateBalances(targetProvider, address);
      addLog(`Wallet Connected: ${address}`, 'success');
      setIsConnecting(false); confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 } });
    } catch (error) { setIsConnecting(false); addLog(`Connection failed.`, 'error'); }
  };

  const handleProviderSelect = (type) => {
    if (!window.ethereum) return alert("No wallet installed!");
    const provs = window.ethereum.providers || [window.ethereum];
    executeConnection(type === 'rabby' ? (provs.find(p => p.isRabby) || window.ethereum) : (provs.find(p => p.isMetaMask && !p.isRabby) || window.ethereum));
  };
    // 🔥 AUTOMATION LOGIC 🔥
  const handleScheduleTask = () => {
    if (!activeProvider || !autoAddress || !autoAmount || !autoTime) return;
    const delayMs = parseFloat(autoTime) * 60000;
    const taskId = Date.now();
    
    addLog(`[AGENT] Task queued: Send ${autoAmount} ${autoToken} in ${autoTime} minutes.`, 'process');
    setActiveTasks(prev => [...prev, { id: taskId, address: autoAddress, amount: autoAmount, token: autoToken, time: autoTime, status: 'Pending' }]);

    setTimeout(async () => {
      addLog(`[AGENT] Executing scheduled task for ${autoAddress.substring(0,6)}...`, 'process');
      try {
        let txHash;
        if (autoToken === 'USDC') {
          const val = BigInt(Math.floor(parseFloat(autoAmount) * 1e18)).toString(16);
          txHash = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: autoAddress, value: '0x' + val }] });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const signer = await provider.getSigner();
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], signer);
          const tx = await contract.transfer(autoAddress, window.ethers.parseUnits(autoAmount, await contract.decimals()));
          txHash = tx.hash;
        }
        addLog(`[AGENT] Scheduled Execution Success! TX: ${txHash}`, 'success');
        setTxHistory(prev => [{ id: Date.now(), hash: txHash, amount: autoAmount, token: autoToken, to: autoAddress, time: new Date().toLocaleTimeString() }, ...prev]);
        setActiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Completed' } : t));
        confetti(); setTimeout(() => updateBalances(activeProvider, walletAddress), 3000);
      } catch(e) { 
        addLog(`[AGENT] Scheduled task failed or rejected by user.`, 'error'); 
        setActiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Failed' } : t));
      }
    }, delayMs);
    
    setAutoAddress(''); setAutoAmount('');
  };

  const handleAiCommand = async () => {
    if (!aiCommand || !activeProvider) return;
    addLog(`[AI INPUT] ${aiCommand}`, 'info');
    setIsAiProcessing(true);
    const regex = /send\s+([\d.]+)\s*(usdc|eurc)?\s+(?:to\s+)?(0x[a-fA-F0-9]{40})/gi;
    let match, intents = [];
    while ((match = regex.exec(aiCommand)) !== null) { intents.push({ amount: match[1], token: (match[2] || 'USDC').toUpperCase(), to: match[3] }); }
    if (intents.length === 0) { addLog(`AI didn't understand.`, 'warning'); setIsAiProcessing(false); return; }

    for (let i = 0; i < intents.length; i++) {
      const intent = intents[i];
      addLog(`[Task ${i+1}/${intents.length}] AI Executing: Route ${intent.amount} ${intent.token} to ${intent.to.substring(0,6)}...`, 'process');
      try {
        let txHash;
        if (intent.token === 'USDC') {
          const val = BigInt(Math.floor(parseFloat(intent.amount) * 1e18)).toString(16);
          txHash = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: intent.to, value: '0x' + val }] });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const signer = await provider.getSigner();
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], signer);
          const tx = await contract.transfer(intent.to, window.ethers.parseUnits(intent.amount, await contract.decimals()));
          txHash = tx.hash;
        }
        addLog(`[Task ${i+1}/${intents.length}] Success! TX: ${txHash}`, 'success');
        setTxHistory(prev => [{ id: Date.now() + i, hash: txHash, amount: intent.amount, token: intent.token, to: intent.to, time: new Date().toLocaleTimeString() }, ...prev]);
      } catch(e) { addLog(`[Task ${i+1}/${intents.length}] Failed.`, 'error'); break; }
    }
    confetti(); setTimeout(() => updateBalances(activeProvider, walletAddress), 4000);
    setAiCommand(''); setIsAiProcessing(false);
  };
    const handlePayrollCommand = async () => {
    if (!payrollText || !activeProvider) return;
    setIsPayrollProcessing(true);
    addLog(`[PAYROLL] Analyzing list data...`, 'info');
    const lines = payrollText.split('\n');
    let tasks = [];
    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const addrMatch = trimmed.match(/(0x[a-fA-F0-9]{40})/i);
      if (addrMatch) {
        const address = addrMatch[1];
        const lineWithoutAddr = trimmed.replace(address, '');
        const amountMatch = lineWithoutAddr.match(/([0-9]*[.]?[0-9]+)/);
        tasks.push({ to: address, amount: amountMatch ? amountMatch[1] : globalAmount });
      }
    }
    if (tasks.length === 0) { addLog(`[PAYROLL] No valid addresses.`, 'warning'); setIsPayrollProcessing(false); return; }
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      addLog(`[Dispersion ${i+1}/${tasks.length}] Sending ${task.amount} ${payrollToken}...`, 'process');
      try {
        let txHash;
        if (payrollToken === 'USDC') {
          const val = BigInt(Math.floor(parseFloat(task.amount) * 1e18)).toString(16);
          txHash = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: task.to, value: '0x' + val }] });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const signer = await provider.getSigner();
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], signer);
          const tx = await contract.transfer(task.to, window.ethers.parseUnits(task.amount, await contract.decimals()));
          txHash = tx.hash;
        }
        setTxHistory(prev => [{ id: Date.now() + i, hash: txHash, amount: task.amount, token: payrollToken, to: task.to, time: new Date().toLocaleTimeString() }, ...prev]);
      } catch(e) { addLog(`[Dispersion ${i+1}/${tasks.length}] Failed.`, 'error'); break; }
    }
    confetti(); setTimeout(() => updateBalances(activeProvider, walletAddress), 4000);
    setPayrollText(''); setIsPayrollProcessing(false);
  };

  const bgMain = isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-800';
  const bgCard = isDark ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-300 shadow-lg';
  const bgHeader = isDark ? 'bg-slate-950/80 border-white/5' : 'bg-white/90 border-slate-300 shadow-sm';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const numUsdc = parseFloat(balance) || 0; const numEurc = parseFloat(eurcBalance) || 0;
  const total = numUsdc + numEurc;
  const usdcPct = total > 0 ? (numUsdc / total) * 100 : 50;
  const eurcPct = total > 0 ? (numEurc / total) * 100 : 50;
    return (
    <div className={`min-h-screen font-sans selection:bg-cyan-500/30 transition-colors duration-500 ${bgMain}`}>
      <header className={`border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-500 ${bgHeader}`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2"><Cpu className="w-6 h-6 text-cyan-500" /><span className={`font-bold tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>ARC<span className="text-cyan-500">OS</span></span></div>
            <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full border ${isDark ? 'bg-slate-900 border-white/10 text-amber-400' : 'bg-slate-200 border-slate-300 text-indigo-600'}`}>{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          </div>
          {walletAddress ? (
            <button onClick={() => {setWalletAddress(null); setActiveProvider(null); setTerminalLogs([]);}} className={`px-4 py-2 rounded-lg text-sm font-mono font-bold border flex items-center gap-2 ${isDark ? 'bg-slate-900 border-cyan-500/30 text-cyan-400' : 'bg-white border-cyan-500 text-cyan-600'}`}>
              {walletAddress.substring(0,6)}...{walletAddress.substring(walletAddress.length-4)} <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => handleProviderSelect('metamask')} className="px-5 py-2 rounded-lg text-sm font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950">CONNECT WALLET</button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <section className={`border rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-8 justify-between items-center relative overflow-hidden transition-colors duration-500 ${bgCard}`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="space-y-4 relative z-10 flex-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500 font-mono"><Zap className="w-3 h-3" /> Core Liquidity Matrix</div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h1 className={`text-3xl md:text-5xl font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Asset Telemetry</h1>
              <div className="flex items-center gap-2">
                <button onClick={() => updateBalances(activeProvider, walletAddress)} className="p-2 border border-slate-500/30 rounded-lg hover:bg-slate-800 text-slate-400"><Activity className="w-4 h-4" /></button>
                <button onClick={() => window.open('https://faucet.circle.com/', '_blank')} className="w-fit px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 rounded-lg text-xs font-mono font-bold text-cyan-400 flex items-center gap-2"><Droplet className="w-4 h-4" /> TEST FAUCET</button>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full relative z-10 max-w-sm">
            <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center"><span className="text-xs font-mono text-cyan-500 font-bold">USDC: {balance}</span><span className="text-xs font-mono text-fuchsia-500 font-bold">EURC: {eurcBalance}</span></div>
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800"><div style={{ width: `${usdcPct}%` }} className="h-full bg-cyan-500 transition-all duration-1000"></div><div style={{ width: `${eurcPct}%` }} className="h-full bg-fuchsia-500 transition-all duration-1000"></div></div>
            </div>
          </div>
        </section>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-3">
            <div className={`text-[10px] uppercase tracking-[0.2em] font-mono mb-4 ${textMuted}`}>COMMAND MODULES</div>
            {modules.map((mod) => {
              const isActive = activeModule === mod.id;
              const btnClass = isActive ? (isDark ? `bg-slate-900 border-${mod.accent.split('-')[1]}/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]` : 'bg-white border-cyan-500 shadow-md') : (isDark ? 'bg-slate-900/50 border-white/5 hover:bg-slate-900' : 'bg-slate-200/60 border-slate-300 hover:bg-white');
              return (
                <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full flex flex-col p-4 rounded-xl border transition-all text-left ${btnClass}`}>
                  <div className="flex items-center gap-3 mb-2"><mod.icon className={`w-5 h-5 ${isActive ? 'text-cyan-500' : 'text-slate-400'}`} /><span className={`font-bold text-sm ${isActive ? (isDark ? 'text-white' : 'text-cyan-700') : (isDark ? 'text-slate-300' : 'text-slate-800')}`}>{mod.title}</span></div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-500">{mod.subtitle}</div>
                </button>
              );
            })}
          </div>

          <div className="md:col-span-8 space-y-6">
            <section className={`border rounded-2xl p-6 relative overflow-hidden transition-colors duration-500 ${bgCard}`}>
              
              {/* MODULE 1: AI BATCH */}
              {activeModule === 'ai_batch' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4"><Bot className="w-6 h-6 text-cyan-500" /><h3 className="text-xl font-bold">AI Batch Delegate</h3></div>
                  <div className="p-4 rounded-xl border flex flex-col gap-3 bg-slate-950 border-white/10">
                    <div className="flex gap-2"><input type="text" value={aiCommand} onChange={(e) => setAiCommand(e.target.value)} placeholder='Try: "Send 1 USDC to 0x..."' className="flex-1 bg-transparent text-sm font-mono focus:outline-none" /><button onClick={handleAiCommand} className="px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg hover:bg-cyan-400"><ArrowRight className="w-4 h-4" /></button></div>
                    <div className="flex flex-wrap gap-2 mt-1"><button onClick={() => setAiCommand('Send 1 USDC to ')} className="text-[10px] font-mono px-3 py-1.5 rounded-full border bg-slate-900 border-white/10 text-cyan-400">💡 Fast Send</button></div>
                  </div>
                </div>
              )}

              {/* MODULE 2: PAYROLL */}
              {activeModule === 'payroll' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4"><Users className="w-6 h-6 text-indigo-500" /><h3 className="text-xl font-bold">Token Airdrop & Payroll</h3></div>
                  <div className="p-4 rounded-xl border space-y-4 bg-slate-950 border-white/10">
                    <textarea value={payrollText} onChange={(e) => setPayrollText(e.target.value)} placeholder={"0x111a...\n0x2222..."} rows="4" className="w-full bg-transparent text-sm font-mono focus:outline-none p-3 rounded-lg border border-white/10" />
                    <button onClick={handlePayrollCommand} className="w-full py-3 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-400 flex items-center justify-center gap-2"><Zap className="w-4 h-4" /> EXECUTE AIRDROP</button>
                  </div>
                </div>
              )}

              {/* 🔥 MODULE 3: AGENTIC AUTOMATION (NEW) 🔥 */}
              {activeModule === 'automation' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4"><Clock className="w-6 h-6 text-orange-500" /><h3 className="text-xl font-bold">Agentic Automation</h3></div>
                  <p className={`text-sm ${textMuted}`}>Set a timer. The AI Agent will automatically execute the transaction when the time is up.</p>
                  
                  <div className="p-4 rounded-xl border space-y-4 bg-slate-950 border-white/10">
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-[10px] font-mono text-slate-500 mb-2">AMOUNT</label><input type="number" value={autoAmount} onChange={e => setAutoAmount(e.target.value)} placeholder="1.0" className="w-full p-2 bg-slate-900 border border-white/10 rounded font-mono text-sm" /></div>
                      <div>
                        <label className="block text-[10px] font-mono text-slate-500 mb-2">TOKEN</label>
                        <select value={autoToken} onChange={e => setAutoToken(e.target.value)} className="w-full p-2 bg-slate-900 border border-white/10 rounded font-mono text-sm"><option value="USDC">USDC</option><option value="EURC">EURC</option></select>
                      </div>
                    </div>
                    <div><label className="block text-[10px] font-mono text-slate-500 mb-2">TARGET WALLET ADDRESS</label><input type="text" value={autoAddress} onChange={e => setAutoAddress(e.target.value)} placeholder="0x..." className="w-full p-2 bg-slate-900 border border-white/10 rounded font-mono text-sm" /></div>
                    <div><label className="block text-[10px] font-mono text-slate-500 mb-2">DELAY (IN MINUTES)</label><input type="number" value={autoTime} onChange={e => setAutoTime(e.target.value)} placeholder="1" className="w-full p-2 bg-slate-900 border border-white/10 rounded font-mono text-sm" /></div>
                    <button onClick={handleScheduleTask} disabled={!autoAddress || !autoAmount} className="w-full py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-400">SET AGENT TRIGGER</button>
                  </div>

                  {activeTasks.length > 0 && (
                    <div className="mt-6 space-y-2">
                      <div className="text-[10px] font-mono text-slate-500 tracking-widest">ACTIVE AGENT TASKS</div>
                      {activeTasks.map(task => (
                        <div key={task.id} className="p-3 border border-orange-500/30 bg-orange-500/10 rounded flex justify-between items-center">
                          <div className="text-xs font-mono text-orange-400">Send {task.amount} {task.token} in {task.time}m</div>
                          <div className={`text-[10px] font-bold px-2 py-1 rounded ${task.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : task.status === 'Failed' ? 'bg-rose-500/20 text-rose-400' : 'bg-orange-500/20 text-orange-400 animate-pulse'}`}>{task.status}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MODULE 4: HISTORY */}
              {activeModule === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4"><History className="w-6 h-6 text-teal-500" /><h3 className="text-xl font-bold">Transaction Ledger</h3></div>
                  <div className="space-y-3">
                    {txHistory.map((tx) => (
                      <div key={tx.id} className="p-4 rounded-xl border bg-slate-950/50 border-teal-500/20 flex justify-between items-center">
                        <div><div className="font-bold font-mono text-sm">Sent {tx.amount} {tx.token}</div><div className="text-[10px] font-mono text-slate-500 mt-1">To: {tx.to.substring(0,8)}...</div></div>
                        <a href={`https://testnet.arcscan.app/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-[10px] text-teal-400 hover:underline">View Tx ↗</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="bg-black border border-cyan-500/30 rounded-2xl overflow-hidden shadow-lg">
              <div className="bg-slate-900 p-2 flex items-center gap-2 border-b border-white/10"><Terminal className="w-4 h-4 text-slate-400" /><span className="text-[10px] font-mono text-slate-400 tracking-widest">SYSTEM TERMINAL / LIVE LOGS</span></div>
              <div className="p-4 h-48 overflow-y-auto font-mono text-xs space-y-2">
                {terminalLogs.map((log, idx) => (<div key={idx} className={log.type === 'process' ? 'text-cyan-400' : log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-rose-400' : 'text-slate-300'}><span className="text-slate-600">[{log.time}]</span> {log.msg}</div>))}
                <div ref={terminalEndRef} />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
