import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot, ShieldAlert, Activity, Terminal, Zap, LogOut, Sun, Moon, 
  Cpu, ArrowRight, ShieldCheck, CheckCircle, History, Droplet, RefreshCw, Users
} from 'lucide-react';

const modules = [
  { id: 'ai_batch', title: 'AI Batch Delegate', subtitle: 'MULTI-TX AUTONOMY', description: 'Command the AI to execute multiple transactions across different assets simultaneously.', accent: 'from-cyan-400 to-blue-500', icon: Bot, stat: 'AI CORE' },
  { id: 'payroll', title: 'Token Airdrop & Payroll', subtitle: 'MASS DISPERSION', description: 'Distribute tokens to multiple addresses at once. Paste your list and execute.', accent: 'from-indigo-400 to-purple-500', icon: Users, stat: 'BATCH SENDER' },
  { id: 'history', title: 'Transaction Ledger', subtitle: 'ON-CHAIN RECEIPTS', description: 'Real-time history of all your executed transactions and transfers in this session.', accent: 'from-teal-400 to-emerald-500', icon: History, stat: 'LIVE SYNC' },
  { id: 'security', title: 'Token Security Matrix', subtitle: 'SMART REVOKE', description: 'Scan and revoke third-party smart contract allowances to protect your liquidity.', accent: 'from-amber-400 to-rose-500', icon: ShieldAlert, stat: 'SCANNER' },
  { id: 'telemetry', title: 'Arc Network Telemetry', subtitle: 'LIVE NODE DATA', description: 'Direct RPC feed from Arc Testnet showing real-time block generation and gas metrics.', accent: 'from-emerald-400 to-teal-500', icon: Activity, stat: 'LIVE SYNC' }
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

  const [aiCommand, setAiCommand] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  const [payrollText, setPayrollText] = useState('');
  const [payrollToken, setPayrollToken] = useState('USDC');
  const [isPayrollProcessing, setIsPayrollProcessing] = useState(false);

  const [blockNumber, setBlockNumber] = useState('SYNCING...');
  const [gasPrice, setGasPrice] = useState('SYNCING...');
  const [spenderAddress, setSpenderAddress] = useState('');
  const [currentAllowance, setCurrentAllowance] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  // 🔥 NEW: Load History from Local Storage on Startup 🔥
  useEffect(() => {
    const savedHistory = localStorage.getItem('arcOsTxHistory');
    if (savedHistory) {
      try { setTxHistory(JSON.parse(savedHistory)); } catch (e) { console.error("History parse error", e); }
    }
  }, []);

  // 🔥 NEW: Save History to Local Storage whenever it changes 🔥
  useEffect(() => {
    if (txHistory.length > 0) {
      localStorage.setItem('arcOsTxHistory', JSON.stringify(txHistory));
    }
  }, [txHistory]);

  useEffect(() => {
    if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

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
      addLog(`Fetching omni-balances for ${address.substring(0,6)}...`, 'process');
      const balHex = await provider.request({ method: 'eth_getBalance', params: [address, 'latest'] });
      setBalance((parseInt(balHex, 16) / 1e18).toFixed(4));
      
      if (window.ethers) {
        const ethersProvider = new window.ethers.BrowserProvider(provider);
        const eurcContract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"], ethersProvider);
        const eurcBal = await eurcContract.balanceOf(address);
        const decimals = await eurcContract.decimals();
        setEurcBalance(parseFloat(window.ethers.formatUnits(eurcBal, decimals)).toFixed(2));
      }
      addLog(`Balances synced successfully.`, 'success');
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
      setIsConnecting(true); 
      setShowWalletModal(false); 
      
      try { await targetProvider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] }); } 
      catch (e) { setIsConnecting(false); return; }

      const accounts = await targetProvider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const currentChain = await targetProvider.request({ method: 'eth_chainId' });
      
      if (currentChain.toLowerCase() !== arcChainIdHex.toLowerCase()) {
        addLog('Switching to Arc Testnet...', 'process');
        try { await targetProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: arcChainIdHex }] }); }
        catch (e) {
          if (e.code === 4902 || e.code === -32603) {
            await targetProvider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: arcChainIdHex, chainName: 'Arc Testnet', rpcUrls: ['https://rpc.testnet.arc.network'], nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, blockExplorerUrls: ['https://testnet.arcscan.app'] }] });
          } else throw new Error("Cancelled");
        }
      }
      
      await new Promise(r => setTimeout(r, 1500));
      setActiveProvider(targetProvider);
      setWalletAddress(address);
      await updateBalances(targetProvider, address);
      addLog(`Wallet Connected: ${address}`, 'success');
      setIsConnecting(false);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 } });
    } catch (error) { 
      setIsConnecting(false); 
      addLog(`Connection failed: ${error.message}`, 'error'); 
    }
  };

  const handleProviderSelect = (type) => {
    if (!window.ethereum) return alert("No wallet installed!");
    const provs = window.ethereum.providers || [window.ethereum];
    let chosen = window.ethereum;
    if (type === 'rabby') chosen = provs.find(p => p.isRabby) || window.ethereum;
    else if (type === 'metamask') chosen = provs.find(p => p.isMetaMask && !p.isRabby) || window.ethereum;
    executeConnection(chosen);
  };

  const disconnectWallet = () => {
    setWalletAddress(null); setActiveProvider(null); setBalance('0.00'); setEurcBalance('0.00'); 
    setTerminalLogs([]);
    addLog(`Wallet disconnected successfully.`, 'info');
  };
    const checkAllowance = async () => {
    if (!walletAddress || !window.ethers || !spenderAddress) return;
    setIsChecking(true);
    addLog(`Scanning allowance for spender: ${spenderAddress.substring(0,8)}...`, 'process');
    try {
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function allowance(address, address) view returns (uint256)", "function decimals() view returns (uint8)"], provider);
      const allow = await contract.allowance(walletAddress, spenderAddress);
      const dec = await contract.decimals();
      const formatted = window.ethers.formatUnits(allow, dec);
      setCurrentAllowance(formatted);
      addLog(`Allowance found: ${formatted} ${tokenToCheck}`, formatted > 0 ? 'warning' : 'success');
    } catch (e) { addLog(`Scan failed: check address.`, 'error'); }
    setIsChecking(false);
  };

  const revokeAllowance = async () => {
    if (!walletAddress || !window.ethers || !spenderAddress) return;
    setIsChecking(true);
    try {
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const signer = await provider.getSigner();
      const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function approve(address, uint256) returns (bool)"], signer);
      const tx = await contract.approve(spenderAddress, 0);
      await tx.wait();
      setCurrentAllowance('0.0');
      addLog(`REVOKE SUCCESSFUL. Funds secured.`, 'success');
      confetti({ particleCount: 150, colors: ['#10b981', '#059669'] });
    } catch (e) { addLog(`Revoke rejected or failed.`, 'error'); }
    setIsChecking(false);
  };

  const handleAiCommand = async () => {
    if (!aiCommand || !activeProvider) return;
    addLog(`[AI INPUT] ${aiCommand}`, 'info');
    setIsAiProcessing(true);
    const regex = /send\s+([\d.]+)\s*(usdc|eurc)?\s+(?:to\s+)?(0x[a-fA-F0-9]{40})/gi;
    let match, intents = [];
    while ((match = regex.exec(aiCommand)) !== null) { intents.push({ amount: match[1], token: (match[2] || 'USDC').toUpperCase(), to: match[3] }); }
    if (intents.length === 0) { addLog(`AI didn't understand. Format: "Send 1 USDC to 0x..."`, 'warning'); setIsAiProcessing(false); return; }

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
        addLog(`[Task ${i+1}/${intents.length}] Execution Success! TX: ${txHash}`, 'success');
        setTxHistory(prev => [{ id: Date.now() + i, hash: txHash, amount: intent.amount, token: intent.token, to: intent.to, time: new Date().toLocaleTimeString() }, ...prev]);
      } catch(e) { addLog(`[Task ${i+1}/${intents.length}] Failed/Rejected.`, 'error'); break; }
    }
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    setTimeout(() => updateBalances(activeProvider, walletAddress), 4000);
    setAiCommand(''); setIsAiProcessing(false);
  };

  // 🔥 SUPER UPGRADED: Smart Parser for Payroll/Airdrop 🔥
  const handlePayrollCommand = async () => {
    if (!payrollText || !activeProvider) return;
    setIsPayrollProcessing(true);
    addLog(`[PAYROLL] Analyzing list data...`, 'info');

    const lines = payrollText.split('\n');
    let tasks = [];
    
    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Smart regex to extract 0x address and amount from ANY format
      const addrMatch = trimmed.match(/(0x[a-fA-F0-9]{40})/i);
      const amountMatch = trimmed.replace(/(0x[a-fA-F0-9]{40})/i, '').match(/([0-9]*[.]?[0-9]+)/);
      
      if (addrMatch && amountMatch) {
        tasks.push({ to: addrMatch[1], amount: amountMatch[1] });
      }
    }

    if (tasks.length === 0) { 
      addLog(`[PAYROLL] No valid addresses found. Please check your text.`, 'warning'); 
      setIsPayrollProcessing(false); 
      return; 
    }
    
    addLog(`[PAYROLL] Found ${tasks.length} valid recipients. Initiating mass transfer...`, 'process');

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      addLog(`[Dispersion ${i+1}/${tasks.length}] Sending ${task.amount} ${payrollToken} to ${task.to.substring(0,6)}...`, 'process');
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
        addLog(`[Dispersion ${i+1}/${tasks.length}] Success! TX: ${txHash}`, 'success');
        setTxHistory(prev => [{ id: Date.now() + i, hash: txHash, amount: task.amount, token: payrollToken, to: task.to, time: new Date().toLocaleTimeString() }, ...prev]);
      } catch(e) { addLog(`[Dispersion ${i+1}/${tasks.length}] Failed/Rejected. Stopping batch.`, 'error'); break; }
    }
    confetti({ particleCount: 300, spread: 120, origin: { y: 0.5 } });
    setTimeout(() => updateBalances(activeProvider, walletAddress), 4000);
    setPayrollText(''); setIsPayrollProcessing(false);
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
              <button onClick={() => setShowWalletModal(false)} className="text-slate-400 hover:text-white transition-colors">✕</button>
            </div>
            <div className="space-y-3 pt-2">
              <button onClick={() => handleProviderSelect('rabby')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex items-center justify-between text-cyan-400 font-bold transition-all"><span>Rabby Wallet</span> <span className="text-xs bg-cyan-500/10 px-2 py-1 rounded">INSTANT</span></button>
              <button onClick={() => handleProviderSelect('metamask')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex items-center justify-between text-amber-400 font-bold transition-all"><span>MetaMask</span> <span className="text-xs bg-amber-500/10 px-2 py-1 rounded">POPULAR</span></button>
            </div>
          </div>
        </div>
      )}

      <header className={`border-b backdrop-blur-md sticky top-0 z-40 transition-colors duration-500 ${bgHeader}`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-6 h-6 text-cyan-500" />
              <span className={`font-bold tracking-widest ${isDark ? 'text-white' : 'text-slate-900'}`}>ARC<span className="text-cyan-500">OS</span></span>
            </div>
            <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full border ${isDark ? 'bg-slate-900 border-white/10 text-amber-400' : 'bg-slate-200 border-slate-300 text-indigo-600'}`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          {walletAddress ? (
            <button onClick={disconnectWallet} className={`px-4 py-2 rounded-lg text-sm font-mono font-bold border flex items-center gap-2 ${isDark ? 'bg-slate-900 border-cyan-500/30 text-cyan-400' : 'bg-white border-cyan-500 text-cyan-600'}`}>
              {walletAddress.substring(0,6)}...{walletAddress.substring(walletAddress.length-4)} <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={() => setShowWalletModal(true)} disabled={isConnecting} className="px-5 py-2 rounded-lg text-sm font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.4)]">
              {isConnecting ? 'CONNECTING...' : 'CONNECT WALLET'}
            </button>
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
                <button onClick={() => updateBalances(activeProvider, walletAddress)} className="p-2 border border-slate-500/30 rounded-lg hover:bg-slate-800 text-slate-400 transition-colors" title="Refresh Balance">
                  <Activity className="w-4 h-4" />
                </button>
                <button onClick={() => window.open('https://faucet.circle.com/', '_blank')} className="w-fit px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 rounded-lg text-xs font-mono font-bold text-cyan-400 hover:text-white hover:bg-cyan-500/40 transition-all flex items-center gap-2 shadow-sm">
                  <Droplet className="w-4 h-4" /> TEST FAUCET
                </button>
              </div>
            </div>
            
            <p className={`max-w-lg text-sm md:text-base ${textMuted}`}>Visual representation of your omnichain assets routed through ArcOS.</p>
          </div>
          <div className="flex-1 w-full relative z-10 max-w-sm mt-4 md:mt-0">
            <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-cyan-500 font-bold">USDC: {balance}</span>
                <span className="text-xs font-mono text-fuchsia-500 font-bold">EURC: {eurcBalance}</span>
              </div>
              <div className="h-3 w-full rounded-full overflow-hidden flex bg-slate-800">
                <div style={{ width: `${usdcPct}%` }} className="h-full bg-cyan-500 transition-all duration-1000"></div>
                <div style={{ width: `${eurcPct}%` }} className="h-full bg-fuchsia-500 transition-all duration-1000"></div>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{usdcPct.toFixed(1)}% Native</span>
                <span>{eurcPct.toFixed(1)}% Euro</span>
              </div>
            </div>
          </div>
        </section>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4 space-y-3">
            <div className={`text-[10px] uppercase tracking-[0.2em] font-mono mb-4 ${textMuted}`}>COMMAND MODULES</div>
            {modules.map((mod) => {
              const isActive = activeModule === mod.id;
              const btnClass = isActive 
                ? (isDark ? `bg-slate-900 border-${mod.accent.split('-')[1]}/50 shadow-[0_0_20px_rgba(34,211,238,0.1)]` : 'bg-white border-cyan-500 shadow-md')
                : (isDark ? 'bg-slate-900/50 border-white/5 hover:bg-slate-900' : 'bg-slate-200/60 border-slate-300 hover:bg-white');
              return (
                <button key={mod.id} onClick={() => setActiveModule(mod.id)} className={`w-full flex flex-col p-4 rounded-xl border transition-all text-left ${btnClass}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <mod.icon className={`w-5 h-5 ${isActive ? 'text-cyan-500' : 'text-slate-400'}`} />
                    <span className={`font-bold text-sm ${isActive ? (isDark ? 'text-white' : 'text-cyan-700') : (isDark ? 'text-slate-300' : 'text-slate-800')}`}>{mod.title}</span>
                  </div>
                  <div className="text-[10px] font-mono tracking-widest text-slate-500">{mod.subtitle}</div>
                </button>
              );
            })}
          </div>

          <div className="md:col-span-8 space-y-6">
            <section className={`border rounded-2xl p-6 relative overflow-hidden transition-colors duration-500 ${bgCard}`}>
              
              {/* 🔥 MODULE 1: AI BATCH DELEGATE 🔥 */}
              {activeModule === 'ai_batch' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
                    <Bot className="w-6 h-6 text-cyan-500" />
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>AI Batch Delegate</h3>
                  </div>
                  <p className={`text-sm ${textMuted}`}>Hello! I am ArcOS AI. I can help you route funds securely. Try asking me to send multiple assets.</p>
                  
                  <div className={`p-4 rounded-xl border flex flex-col gap-3 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    <div className="flex gap-2">
                      <input type="text" value={aiCommand} onChange={(e) => setAiCommand(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiCommand()} placeholder='Try: "Send 1 USDC to 0x..."' className={`flex-1 bg-transparent text-sm font-mono focus:outline-none ${isDark ? 'text-white' : 'text-slate-900'}`} />
                      <button onClick={handleAiCommand} disabled={isAiProcessing || !aiCommand} className="px-4 py-2 bg-cyan-500 text-white font-bold rounded-lg hover:bg-cyan-400 disabled:opacity-50 flex items-center gap-2">
                        {isAiProcessing ? <Cpu className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <button onClick={() => setAiCommand('Send 1 USDC to ')} className={`text-[10px] font-mono px-3 py-1.5 rounded-full border transition-all ${isDark ? 'bg-slate-900 border-white/10 text-cyan-400 hover:bg-cyan-900/40' : 'bg-slate-200 border-slate-300 text-cyan-700 hover:bg-cyan-100'}`}>💡 Fast Send</button>
                      <button onClick={() => setAiCommand('Send 1 USDC to  and Send 2 EURC to ')} className={`text-[10px] font-mono px-3 py-1.5 rounded-full border transition-all ${isDark ? 'bg-slate-900 border-white/10 text-fuchsia-400 hover:bg-fuchsia-900/40' : 'bg-slate-200 border-slate-300 text-fuchsia-700 hover:bg-fuchsia-100'}`}>⚡ Batch Transfer</button>
                    </div>
                  </div>
                </div>
              )}

              {/* 🔥 MODULE 2: PAYROLL & AIRDROP 🔥 */}
              {activeModule === 'payroll' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
                    <Users className="w-6 h-6 text-indigo-500" />
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Token Airdrop & Payroll</h3>
                  </div>
                  <p className={`text-sm ${textMuted}`}>Distribute tokens to multiple addresses at once. Format: <span className="text-cyan-500 font-mono bg-cyan-500/10 px-2 py-0.5 rounded">0xAddress amount</span> (comma or space separated).</p>

                  <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    <div className="flex gap-2">
                       <button onClick={() => setPayrollToken('USDC')} className={`flex-1 py-2 rounded-lg font-bold font-mono text-sm border transition-all ${payrollToken === 'USDC' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-white/5 text-slate-500 hover:bg-slate-800'}`}>USDC</button>
                       <button onClick={() => setPayrollToken('EURC')} className={`flex-1 py-2 rounded-lg font-bold font-mono text-sm border transition-all ${payrollToken === 'EURC' ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-400' : 'bg-slate-900 border-white/5 text-slate-500 hover:bg-slate-800'}`}>EURC</button>
                    </div>
                    <textarea
                      value={payrollText}
                      onChange={(e) => setPayrollText(e.target.value)}
                      placeholder={"0x111a... 1.5\n0x2222... 2.0"}
                      rows="4"
                      className={`w-full bg-transparent text-sm font-mono focus:outline-none p-3 rounded-lg border ${isDark ? 'text-white border-white/10 bg-slate-900' : 'text-slate-900 border-slate-300 bg-white'}`}
                    />
                    <button onClick={handlePayrollCommand} disabled={isPayrollProcessing || !payrollText} className="w-full py-3 bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-400 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                      {isPayrollProcessing ? <Cpu className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} EXECUTE AIRDROP
                    </button>
                  </div>
                </div>
              )}

              {/* 🔥 MODULE 3: TRANSACTION LEDGER (HISTORY) 🔥 */}
              {activeModule === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
                    <History className="w-6 h-6 text-teal-500" />
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Transaction Ledger</h3>
                  </div>
                  {txHistory.length === 0 ? (
                    <div className={`text-center py-10 font-mono text-sm ${textMuted}`}>No transactions recorded yet. They will automatically save here!</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-end">
                        <button onClick={() => { setTxHistory([]); localStorage.removeItem('arcOsTxHistory'); }} className="text-[10px] text-rose-500 border border-rose-500/20 px-2 py-1 rounded hover:bg-rose-500/10">Clear History</button>
                      </div>
                      {txHistory.map((tx) => (
                        <div key={tx.id} className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${isDark ? 'bg-slate-950/50 border-teal-500/20' : 'bg-teal-50/50 border-teal-200'}`}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-500 flex items-center justify-center"><CheckCircle className="w-4 h-4" /></div>
                            <div>
                              <div className={`font-bold font-mono text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Sent {tx.amount} {tx.token}</div>
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

              {/* 🔥 MODULE 4: TOKEN SECURITY MATRIX 🔥 */}
              {activeModule === 'security' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
                    <ShieldAlert className="w-6 h-6 text-rose-500" />
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Token Security Matrix</h3>
                  </div>
                  <p className={`text-sm ${textMuted}`}>Protect your assets. Scan and revoke third-party smart contract allowances.</p>
                  <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    <div>
                      <label className={`block text-[10px] font-mono mb-2 ${textMuted}`}>CONTRACT ADDRESS TO SCAN</label>
                      <input type="text" value={spenderAddress} onChange={e => setSpenderAddress(e.target.value)} placeholder="0x..." className={`w-full p-3 rounded-lg border text-sm font-mono focus:outline-none ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'}`} />
                    </div>
                    <div className="flex gap-4">
                      <button onClick={checkAllowance} disabled={isChecking || !spenderAddress} className="flex-1 py-3 bg-amber-500/20 text-amber-500 border border-amber-500/50 font-bold rounded-lg hover:bg-amber-500 hover:text-white transition-colors">SCAN ALLOWANCE</button>
                      {currentAllowance !== null && parseFloat(currentAllowance) > 0 && (
                        <button onClick={revokeAllowance} disabled={isChecking} className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-lg hover:bg-rose-600 transition-colors shadow-[0_0_15px_rgba(244,63,94,0.4)]">REVOKE ACCESS</button>
                      )}
                    </div>
                    {currentAllowance !== null && (
                      <div className={`p-3 rounded border text-sm font-mono text-center ${parseFloat(currentAllowance) > 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
                        Current Allowance: {currentAllowance} {tokenToCheck}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 🔥 MODULE 5: NETWORK TELEMETRY 🔥 */}
              {activeModule === 'telemetry' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
                    <Activity className="w-6 h-6 text-emerald-500" />
                    <h3 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Arc Network Telemetry</h3>
                  </div>
                  <p className={`text-sm ${textMuted}`}>Live Node Polling. Fetching real-time RPC data from Arc Testnet.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`p-6 rounded-xl border text-center ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                      <div className={`text-[10px] font-mono mb-2 tracking-widest ${textMuted}`}>LATEST BLOCK</div>
                      <div className="text-3xl font-bold text-cyan-500 font-mono animate-pulse">{blockNumber}</div>
                    </div>
                    <div className={`p-6 rounded-xl border text-center ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                      <div className={`text-[10px] font-mono mb-2 tracking-widest ${textMuted}`}>LIVE GAS PRICE</div>
                      <div className="text-3xl font-bold text-emerald-500 font-mono">{gasPrice}</div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 🔥 DEVELOPER TERMINAL (Global Component) 🔥 */}
            <section className={`border rounded-2xl overflow-hidden shadow-lg ${isDark ? 'bg-black border-cyan-500/30' : 'bg-slate-900 border-slate-800'}`}>
              <div className="bg-slate-900 p-2 flex items-center gap-2 border-b border-white/10">
                <Terminal className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-mono text-slate-400 tracking-widest">SYSTEM TERMINAL / LIVE LOGS</span>
              </div>
              <div className="p-4 h-48 overflow-y-auto font-mono text-xs space-y-2">
                {terminalLogs.length === 0 && <div className="text-slate-600">Waiting for connection...</div>}
                {terminalLogs.map((log, idx) => {
                  let colorClass = 'text-slate-300';
                  if (log.type === 'process') colorClass = 'text-cyan-400';
                  if (log.type === 'success') colorClass = 'text-emerald-400';
                  if (log.type === 'error') colorClass = 'text-rose-400';
                  if (log.type === 'warning') colorClass = 'text-amber-400';
                  return (
                    <div key={idx} className={colorClass}>
                      <span className="text-slate-600">[{log.time}]</span> {log.msg}
                    </div>
                  );
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
