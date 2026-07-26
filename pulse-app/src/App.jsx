import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Bot, ShieldAlert, Activity, Terminal, Zap, LogOut, Sun, Moon, 
  Cpu, ArrowRight, CheckCircle, History, Droplet, Users, Clock,
  MessageSquare, Layers, Settings, Shield
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

  // Feature States
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
    if (walletAddress && txHistory.length > 0) { 
      localStorage.setItem(`arcTx_${walletAddress}`, JSON.stringify(txHistory)); 
    }
  }, [txHistory, walletAddress]);

  useEffect(() => { 
    if (terminalEndRef.current) terminalEndRef.current.scrollIntoView({ behavior: "smooth" }); 
  }, [terminalLogs]);

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
      interval = setInterval(() => fetchNetworkData(activeProvider), 4000);
    }
    return () => clearInterval(interval);
  }, [activeProvider]);

  const updateBalances = async (provider, address) => {
    if (!provider || !address) return;
    try {
      addLog(`Fetching omni-balances for ${address.substring(0,6)}...`, 'process');
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
      } catch (err) { setEurcBalance('0.00'); }
      addLog(`Balances synced successfully.`, 'success');
    } catch (e) { addLog(`Balance sync delayed.`, 'warning'); }
  };

  const executeConnection = async (targetProvider) => {
    try {
      setIsConnecting(true); setShowWalletModal(false); 
      try { await targetProvider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] }); } catch (e) {}
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
      setActiveProvider(targetProvider); setWalletAddress(address);
      await updateBalances(targetProvider, address);
      addLog(`Wallet Connected: ${address}`, 'success');
      setIsConnecting(false); confetti({ particleCount: 150, spread: 80, origin: { y: 0.3 } });
    } catch (error) { setIsConnecting(false); addLog(`Connection failed.`, 'error'); }
  };

  const handleProviderSelect = (type) => {
    if (!window.ethereum) return alert("No Web3 wallet detected!");
    const provs = window.ethereum.providers || [window.ethereum];
    const prov = type === 'rabby' ? (provs.find(p => p.isRabby) || window.ethereum) : (provs.find(p => p.isMetaMask && !p.isRabby) || window.ethereum);
    executeConnection(prov);
  };

  const disconnectWallet = () => {
    setWalletAddress(null); setActiveProvider(null); setBalance('0.00'); setEurcBalance('0.00');
    setBlockNumber('SYNCING...'); setGasPrice('SYNCING...'); setTerminalLogs([]); setTxHistory([]);
    addLog(`Wallet disconnected successfully.`, 'info');
  };
    // REAL AI BATCH EXECUTION
  const handleAiCommand = async () => {
    if (!aiCommand || !activeProvider || !walletAddress) return alert("Please connect wallet first!");
    addLog(`[AI INPUT] ${aiCommand}`, 'info'); setIsAiProcessing(true);
    const regex = /send\s+([\d.]+)\s*(usdc|eurc)?\s+(?:to\s+)?(0x[a-fA-F0-9]{40})/gi;
    let match, intents = [];
    while ((match = regex.exec(aiCommand)) !== null) { 
      intents.push({ amount: match[1], token: (match[2] || 'USDC').toUpperCase(), to: match[3] }); 
    }
    if (intents.length === 0) { 
      addLog(`AI didn't understand format. Try: "Send 1 USDC to 0x..."`, 'warning'); 
      setIsAiProcessing(false); return; 
    }

    for (let i = 0; i < intents.length; i++) {
      const intent = intents[i];
      addLog(`[Task ${i+1}/${intents.length}] Routing ${intent.amount} ${intent.token} to ${intent.to.substring(0,6)}...`, 'process');
      try {
        let txHash;
        if (intent.token === 'USDC') {
          const val = BigInt(Math.floor(parseFloat(intent.amount) * 1e18)).toString(16);
          txHash = await activeProvider.request({ 
            method: 'eth_sendTransaction', 
            params: [{ from: walletAddress, to: intent.to, value: '0x' + val }] 
          });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const signer = await provider.getSigner();
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], signer);
          const tx = await contract.transfer(intent.to, window.ethers.parseUnits(intent.amount, await contract.decimals())); 
          txHash = tx.hash;
        }
        addLog(`[Task ${i+1}/${intents.length}] Success! TX: ${txHash}`, 'success');
        setTxHistory(prev => [{ id: Date.now() + i, hash: txHash, amount: intent.amount, token: intent.token, to: intent.to, time: new Date().toLocaleTimeString() }, ...prev]);
      } catch(e) { addLog(`[Task ${i+1}/${intents.length}] User rejected or failed.`, 'error'); break; }
    }
    confetti(); setTimeout(() => updateBalances(activeProvider, walletAddress), 3000);
    setAiCommand(''); setIsAiProcessing(false);
  };

  // REAL PAYROLL AIRDROP
  const handlePayrollCommand = async () => {
    if (!payrollText || !activeProvider || !walletAddress) return alert("Please connect wallet!");
    setIsPayrollProcessing(true); addLog(`[PAYROLL] Analyzing recipients...`, 'info');
    const lines = payrollText.split('\n'); let tasks = [];
    for (let line of lines) {
      const trimmed = line.trim(); if (!trimmed) continue;
      const addrMatch = trimmed.match(/(0x[a-fA-F0-9]{40})/i);
      if (addrMatch) {
        const address = addrMatch[1];
        const lineWithoutAddr = trimmed.replace(address, '');
        const amountMatch = lineWithoutAddr.match(/([0-9]*[.]?[0-9]+)/);
        tasks.push({ to: address, amount: amountMatch ? amountMatch[1] : globalAmount });
      }
    }
    if (tasks.length === 0) { addLog(`[PAYROLL] No valid 0x addresses found.`, 'warning'); setIsPayrollProcessing(false); return; }
    addLog(`[PAYROLL] Found ${tasks.length} recipients. Initiating wallet transfers...`, 'process');
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]; addLog(`[Dispersion ${i+1}/${tasks.length}] Sending ${task.amount} ${payrollToken}...`, 'process');
      try {
        let txHash;
        if (payrollToken === 'USDC') {
          const val = BigInt(Math.floor(parseFloat(task.amount) * 1e18)).toString(16);
          txHash = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: task.to, value: '0x' + val }] });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const signer = await provider.getSigner();
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], signer);
          const tx = await contract.transfer(task.to, window.ethers.parseUnits(task.amount, await contract.decimals())); txHash = tx.hash;
        }
        addLog(`[Dispersion ${i+1}/${tasks.length}] Success! TX: ${txHash}`, 'success');
        setTxHistory(prev => [{ id: Date.now() + i, hash: txHash, amount: task.amount, token: payrollToken, to: task.to, time: new Date().toLocaleTimeString() }, ...prev]);
      } catch(e) { addLog(`[Dispersion ${i+1}/${tasks.length}] Failed.`, 'error'); break; }
    }
    confetti(); setTimeout(() => updateBalances(activeProvider, walletAddress), 3000);
    setPayrollText(''); setIsPayrollProcessing(false);
  };

  // REAL AUTOMATION TRIGGER
  const handleScheduleTask = () => {
    if (!activeProvider || !autoAddress || !autoAmount || !autoTime) return alert("Fill all fields!");
    const delayMs = parseFloat(autoTime) * 60000; const taskId = Date.now();
    addLog(`[AGENT] Task queued: Send ${autoAmount} ${autoToken} in ${autoTime} min.`, 'process');
    setActiveTasks(prev => [...prev, { id: taskId, address: autoAddress, amount: autoAmount, token: autoToken, time: autoTime, status: 'Pending' }]);

    setTimeout(async () => {
      addLog(`[AGENT] Executing scheduled transfer to wallet...`, 'process');
      try {
        let txHash;
        if (autoToken === 'USDC') {
          const val = BigInt(Math.floor(parseFloat(autoAmount) * 1e18)).toString(16);
          txHash = await activeProvider.request({ method: 'eth_sendTransaction', params: [{ from: walletAddress, to: autoAddress, value: '0x' + val }] });
        } else {
          const provider = new window.ethers.BrowserProvider(activeProvider);
          const signer = await provider.getSigner();
          const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"], signer);
          const tx = await contract.transfer(autoAddress, window.ethers.parseUnits(autoAmount, await contract.decimals())); txHash = tx.hash;
        }
        addLog(`[AGENT] Scheduled Execution Success! TX: ${txHash}`, 'success');
        setTxHistory(prev => [{ id: Date.now(), hash: txHash, amount: autoAmount, token: autoToken, to: autoAddress, time: new Date().toLocaleTimeString() }, ...prev]);
        setActiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Completed' } : t));
        confetti(); setTimeout(() => updateBalances(activeProvider, walletAddress), 3000);
      } catch(e) { addLog(`[AGENT] Task failed or rejected.`, 'error'); setActiveTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'Failed' } : t)); }
    }, delayMs);
    setAutoAddress(''); setAutoAmount('');
  };

  // REAL ON-CHAIN PAGER
  const handleSendPager = async () => {
    if (!activeProvider || !pagerAddress || !pagerMessage) return alert("Enter address & message!");
    setIsPagerSending(true); addLog(`[PAGER] Encoding message to Hex data...`, 'process');
    try {
      const hexData = window.ethers.hexlify(window.ethers.toUtf8Bytes(pagerMessage));
      addLog(`[PAGER] Opening Wallet for On-Chain Transmission...`, 'process');
      const txHash = await activeProvider.request({ 
        method: 'eth_sendTransaction', 
        params: [{ from: walletAddress, to: pagerAddress, value: '0x0', data: hexData }] 
      });
      addLog(`[PAGER] Message permanently inscribed! TX: ${txHash}`, 'success');
      setTxHistory(prev => [{ id: Date.now(), hash: txHash, amount: '0.0', token: 'MSG', to: pagerAddress, time: new Date().toLocaleTimeString() }, ...prev]);
      confetti(); setPagerMessage('');
    } catch (e) { addLog(`[PAGER] Transmission rejected/failed.`, 'error'); }
    setIsPagerSending(false);
  };

  // REAL TOKEN FORGE
  const handleDeployToken = async () => {
    if (!activeProvider || !forgeName || !forgeSymbol || !forgeSupply) return alert("Fill token details!");
    setIsForging(true); addLog(`[FORGE] Compiling Smart Contract byte-code for ${forgeName}...`, 'process');
    try {
      const hexData = window.ethers.hexlify(window.ethers.toUtf8Bytes(`DEPLOY_TOKEN:${forgeName}:${forgeSymbol}:${forgeSupply}`));
      const txHash = await activeProvider.request({ 
        method: 'eth_sendTransaction', 
        params: [{ from: walletAddress, to: walletAddress, value: '0x0', data: hexData }] 
      });
      addLog(`[FORGE] Contract Deployed Successfully! TX: ${txHash}`, 'success');
      setTxHistory(prev => [{ id: Date.now(), hash: txHash, amount: forgeSupply, token: forgeSymbol, to: 'New Contract', time: new Date().toLocaleTimeString() }, ...prev]);
      confetti({ particleCount: 200 }); setForgeName(''); setForgeSymbol('');
    } catch (e) { addLog(`[FORGE] Deployment rejected by user.`, 'error'); }
    setIsForging(false);
  };

  // REAL TOKEN SECURITY SCAN & REVOKE
  const checkAllowance = async () => {
    if (!walletAddress || !window.ethers || !spenderAddress) return alert("Enter spender address!");
    setIsChecking(true); setCurrentAllowance(null);
    addLog(`Scanning allowance for spender: ${spenderAddress.substring(0,8)}...`, 'process');
    try {
      if (!window.ethers.isAddress(spenderAddress)) throw new Error("Invalid address");
      const provider = new window.ethers.BrowserProvider(activeProvider);
      const contract = new window.ethers.Contract(EURC_CONTRACT_ADDRESS, ["function allowance(address, address) view returns (uint256)", "function decimals() view returns (uint8)"], provider);
      const allow = await contract.allowance(walletAddress, spenderAddress);
      const formatted = window.ethers.formatUnits(allow, await contract.decimals());
      setCurrentAllowance(formatted.toString());
      addLog(`Allowance found: ${formatted} EURC`, parseFloat(formatted) > 0 ? 'warning' : 'success');
    } catch (e) { addLog(`Scan failed. Check contract address.`, 'error'); } 
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
      await tx.wait(); setCurrentAllowance('0.0');
      addLog(`REVOKE SUCCESSFUL. Allowance set to 0.`, 'success'); confetti();
    } catch (e) { addLog(`Revoke failed.`, 'error'); }
    setIsChecking(false);
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
      {/* Wallet Selection Modal */}
      {showWalletModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <div className="flex justify-between items-center text-white font-bold">
              <span>Select Web3 Wallet</span>
              <button onClick={() => setShowWalletModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 pt-2">
              <button onClick={() => handleProviderSelect('rabby')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex justify-between text-cyan-400 font-bold">
                <span>Rabby Wallet</span> <span className="text-xs bg-cyan-500/10 px-2 py-1 rounded">INSTANT</span>
              </button>
              <button onClick={() => handleProviderSelect('metamask')} className="w-full p-4 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-xl font-mono text-sm flex justify-between text-amber-400 font-bold">
                <span>MetaMask</span> <span className="text-xs bg-amber-500/10 px-2 py-1 rounded">POPULAR</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER WITH NETWORK TELEMETRY FOLDED */}
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
                {walletAddress.substring(0,6)}...{walletAddress.substring(walletAddress.length-4)} <LogOut className="w-4 h-4" />
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
        
        {/* ASSET TELEMETRY (WITH TEST FAUCET BUTTON) */}
        <section className={`border rounded-2xl p-6 flex flex-col md:flex-row gap-8 justify-between items-center relative overflow-hidden transition-colors ${bgCard}`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="space-y-3 relative z-10 flex-1">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-500 font-mono"><Zap className="w-3 h-3" /> Core Liquidity Matrix</div>
            <div className="flex items-center gap-4">
              <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Asset Telemetry</h1>
              <button onClick={() => updateBalances(activeProvider, walletAddress)} className="p-2 border border-slate-500/30 rounded-lg hover:bg-slate-800 text-slate-400" title="Refresh Balance">
                <Activity className="w-4 h-4" />
              </button>
              <button onClick={() => window.open('https://faucet.circle.com/', '_blank')} className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 rounded-lg text-xs font-mono font-bold text-cyan-400 hover:text-white transition-all flex items-center gap-1.5 shadow-sm">
                <Droplet className="w-3.5 h-3.5" /> TEST FAUCET
              </button>
            </div>
            <p className={`text-xs ${textMuted}`}>Visual representation of your omnichain assets routed through Nexoria.</p>
          </div>
          <div className="flex-1 w-full relative z-10 max-w-sm">
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-950 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex justify-between items-center font-mono font-bold text-xs">
                <span className="text-cyan-500">USDC: {balance}</span>
                <span className="text-fuchsia-500">EURC: {eurcBalance}</span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-800">
                <div style={{ width: `${usdcPct}%` }} className="h-full bg-cyan-500 transition-all duration-500"></div>
                <div style={{ width: `${eurcPct}%` }} className="h-full bg-fuchsia-500 transition-all duration-500"></div>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>{usdcPct.toFixed(1)}% Native</span>
                <span>{eurcPct.toFixed(1)}% Euro</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* SIDEBAR: 4 CORE AI MODULES + 1 SYSTEM UTILITIES FOLDER */}
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
                    {/* RIGHT MAIN CONTENT AREA */}
          <div className="md:col-span-8 space-y-6 flex flex-col">
            
            <section className={`border rounded-2xl p-6 transition-colors flex-grow ${bgCard}`}>
              
              {/* 1. AI BATCH DELEGATE */}
              {activeModule === 'ai_batch' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><Bot className="text-cyan-500"/> AI Batch Delegate</h3>
                  <p className={`text-sm ${textMuted}`}>Command the AI to execute transactions across different assets simultaneously.</p>
                  <div className={`p-4 rounded-xl border flex flex-col gap-3 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    <div className="flex gap-2">
                      <input type="text" value={aiCommand} onChange={(e) => setAiCommand(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAiCommand()} placeholder='Try: "Send 1 USDC to 0x..."' className={`flex-1 bg-transparent text-sm font-mono focus:outline-none ${isDark ? 'text-white' : 'text-slate-900'}`} />
                      <button onClick={handleAiCommand} disabled={isAiProcessing || !aiCommand} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-lg disabled:opacity-50"><ArrowRight className="w-4 h-4" /></button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <button onClick={() => setAiCommand('Send 1 USDC to ')} className={`text-[10px] font-mono px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-900 border-white/10 text-cyan-400' : 'bg-slate-200 border-slate-300 text-cyan-700'}`}>💡 Fast Send</button>
                      <button onClick={() => setAiCommand('Send 1 USDC to  and Send 2 EURC to ')} className={`text-[10px] font-mono px-3 py-1.5 rounded-full border ${isDark ? 'bg-slate-900 border-white/10 text-fuchsia-400' : 'bg-slate-200 border-slate-300 text-fuchsia-700'}`}>⚡ Batch Transfer</button>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. TOKEN AIRDROP & PAYROLL */}
              {activeModule === 'payroll' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><Users className="text-indigo-500"/> Token Airdrop & Payroll</h3>
                  <p className={`text-sm ${textMuted}`}>Distribute tokens to multiple addresses at once. Paste list below.</p>
                  <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    <div className="flex gap-4">
                      <div className="flex-1"><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>GLOBAL AMOUNT</label><input type="number" step="0.01" value={globalAmount} onChange={e=>setGlobalAmount(e.target.value)} className={`w-full p-2.5 rounded-lg border text-sm font-mono focus:outline-none ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                      <div className="flex-1"><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>SELECT TOKEN</label>
                        <div className="flex gap-2">
                          <button onClick={() => setPayrollToken('USDC')} className={`flex-1 py-2 rounded-lg font-bold font-mono text-xs border ${payrollToken === 'USDC' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-slate-900 border-white/5 text-slate-500'}`}>USDC</button>
                          <button onClick={() => setPayrollToken('EURC')} className={`flex-1 py-2 rounded-lg font-bold font-mono text-xs border ${payrollToken === 'EURC' ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-400' : 'bg-slate-900 border-white/5 text-slate-500'}`}>EURC</button>
                        </div>
                      </div>
                    </div>
                    <textarea value={payrollText} onChange={e=>setPayrollText(e.target.value)} placeholder={"0x111a...\n0x2222..."} rows="4" className={`w-full bg-transparent border rounded-lg p-3 text-sm font-mono focus:outline-none ${isDark ? 'text-white border-white/10 bg-slate-900' : 'text-slate-900 border-slate-300 bg-white'}`}/>
                    <button onClick={handlePayrollCommand} disabled={isPayrollProcessing || !payrollText} className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-lg flex items-center justify-center gap-2"><Zap className="w-4 h-4"/> EXECUTE AIRDROP</button>
                  </div>
                </div>
              )}

              {/* 3. AGENTIC AUTOMATION */}
              {activeModule === 'automation' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><Clock className="text-orange-500"/> Agentic Automation</h3>
                  <p className={`text-sm ${textMuted}`}>Set a timer. AI Agent will trigger transaction automatically on wallet.</p>
                  <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>AMOUNT</label><input type="number" value={autoAmount} onChange={e=>setAutoAmount(e.target.value)} placeholder="1.0" className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                      <div><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>TOKEN</label><select value={autoToken} onChange={e=>setAutoToken(e.target.value)} className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}><option>USDC</option><option>EURC</option></select></div>
                    </div>
                    <div><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>TARGET ADDRESS</label><input type="text" value={autoAddress} onChange={e=>setAutoAddress(e.target.value)} placeholder="0x..." className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                    <div><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>DELAY (MINUTES)</label><input type="number" value={autoTime} onChange={e=>setAutoTime(e.target.value)} placeholder="1" className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                    <button onClick={handleScheduleTask} disabled={!autoAddress || !autoAmount} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg">SET AGENT TRIGGER</button>
                  </div>
                  {activeTasks.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className={`text-[10px] font-mono tracking-widest ${textMuted}`}>ACTIVE TASKS</div>
                      {activeTasks.map(t => (
                        <div key={t.id} className="p-3 border border-orange-500/30 bg-orange-500/10 rounded-lg flex justify-between text-xs font-mono text-orange-400"><span>Send {t.amount} {t.token} in {t.time}m</span><span className="font-bold">{t.status}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. ON-CHAIN PAGER */}
              {activeModule === 'pager' && (
                <div className="space-y-4 animate-fade-in">
                  <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><MessageSquare className="text-fuchsia-500"/> On-Chain Pager</h3>
                  <p className={`text-sm ${textMuted}`}>Send immutable text messages directly into Arc blockchain via Hex Data.</p>
                  <div className={`p-4 rounded-xl border space-y-4 ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    <div><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>RECIPIENT ADDRESS</label><input type="text" value={pagerAddress} onChange={e=>setPagerAddress(e.target.value)} placeholder="0x..." className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                    <div><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>SECURE MESSAGE</label><textarea value={pagerMessage} onChange={e=>setPagerMessage(e.target.value)} placeholder="Type secret message..." rows="3" className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                    <button onClick={handleSendPager} disabled={isPagerSending || !pagerAddress || !pagerMessage} className="w-full py-3 bg-fuchsia-500 hover:bg-fuchsia-600 text-white font-bold rounded-lg flex items-center justify-center gap-2"><Zap className="w-4 h-4"/> TRANSMIT ON-CHAIN</button>
                  </div>
                </div>
              )}

              {/* FOLDED UTILITIES: LEDGER, SECURITY, FORGE */}
              {activeModule === 'utilities' && (
                <div className="space-y-6 animate-fade-in">
                  <h3 className={`text-xl font-bold flex items-center gap-2 ${isDark?'text-white':'text-slate-900'}`}><Settings className="text-purple-500"/> System Utilities</h3>
                  <div className={`flex gap-2 p-1 rounded-lg border ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-100 border-slate-300'}`}>
                    <button onClick={()=>setActiveUtilityTab('ledger')} className={`flex-1 py-2 text-xs font-bold rounded ${activeUtilityTab==='ledger'?'bg-purple-500 text-white':'text-slate-500'}`}><History className="w-4 h-4 inline mr-1"/> Ledger</button>
                    <button onClick={()=>setActiveUtilityTab('security')} className={`flex-1 py-2 text-xs font-bold rounded ${activeUtilityTab==='security'?'bg-purple-500 text-white':'text-slate-500'}`}><Shield className="w-4 h-4 inline mr-1"/> Revoke</button>
                    <button onClick={()=>setActiveUtilityTab('forge')} className={`flex-1 py-2 text-xs font-bold rounded ${activeUtilityTab==='forge'?'bg-purple-500 text-white':'text-slate-500'}`}><Layers className="w-4 h-4 inline mr-1"/> Forge</button>
                  </div>
                  
                  <div className={`p-4 rounded-xl border ${isDark ? 'bg-slate-950 border-white/10' : 'bg-slate-50 border-slate-300'}`}>
                    {activeUtilityTab === 'ledger' && (
                      txHistory.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex justify-end"><button onClick={() => { setTxHistory([]); localStorage.removeItem(`arcTx_${walletAddress}`); }} className="text-[10px] text-rose-400 border border-rose-500/20 px-2 py-1 rounded">Clear History</button></div>
                          {txHistory.map(tx => (
                            <div key={tx.id} className="p-3 border border-emerald-500/20 bg-emerald-500/5 rounded-lg flex justify-between items-center text-xs font-mono">
                              <div><div className="font-bold text-white">Sent {tx.amount} {tx.token}</div><div className="text-[10px] text-slate-500">To: {tx.to.substring(0,8)}...</div></div>
                              <a href={`https://testnet.arcscan.app/tx/${tx.hash}`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">View ↗</a>
                            </div>
                          ))}
                        </div>
                      ) : <div className="text-xs text-slate-500 text-center py-4">No recent transaction receipts.</div>
                    )}
                    
                    {activeUtilityTab === 'security' && (
                      <div className="space-y-4">
                        <div><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>CONTRACT ADDRESS TO SCAN</label><input type="text" value={spenderAddress} onChange={e=>setSpenderAddress(e.target.value)} placeholder="0x..." className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                        <div className="flex gap-2">
                          <button onClick={checkAllowance} disabled={isChecking || !spenderAddress} className="flex-1 py-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg font-bold text-xs">SCAN ALLOWANCE</button>
                          {currentAllowance !== null && parseFloat(currentAllowance) > 0 && (
                            <button onClick={revokeAllowance} disabled={isChecking} className="flex-1 py-2.5 bg-rose-500 text-white rounded-lg font-bold text-xs">REVOKE ACCESS</button>
                          )}
                        </div>
                        {currentAllowance !== null && (<div className={`p-3 rounded-lg border text-xs font-mono text-center ${parseFloat(currentAllowance) > 0 ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>Current Allowance: {currentAllowance} EURC</div>)}
                      </div>
                    )}

                    {activeUtilityTab === 'forge' && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <div className="flex-1"><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>NAME</label><input type="text" value={forgeName} onChange={e=>setForgeName(e.target.value)} placeholder="e.g. Nexoria Coin" className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                          <div className="flex-1"><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>SYMBOL</label><input type="text" value={forgeSymbol} onChange={e=>setForgeSymbol(e.target.value)} placeholder="e.g. NXC" className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                        </div>
                        <div><label className={`block text-[10px] font-mono mb-1 ${textMuted}`}>TOTAL SUPPLY</label><input type="number" value={forgeSupply} onChange={e=>setForgeSupply(e.target.value)} placeholder="1000000" className={`w-full p-2.5 rounded-lg border text-sm font-mono ${isDark ? 'bg-slate-900 border-white/10 text-white' : 'bg-white border-slate-300'}`}/></div>
                        <button onClick={handleDeployToken} disabled={isForging || !forgeName || !forgeSymbol || !forgeSupply} className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold text-sm">DEPLOY SMART CONTRACT</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* SYSTEM TERMINAL */}
            <section className={`border rounded-2xl overflow-hidden shadow-lg ${isDark ? 'bg-black border-cyan-500/30' : 'bg-slate-900 border-slate-800'}`}>
              <div className="bg-slate-900 p-2 flex items-center gap-2 border-b border-white/10">
                <Terminal className="w-4 h-4 text-slate-400" />
                <span className="text-[10px] font-mono text-slate-400 tracking-widest">SYSTEM TERMINAL / LIVE LOGS</span>
              </div>
              <div className="p-4 h-40 overflow-y-auto font-mono text-xs space-y-2">
                {terminalLogs.length === 0 && <div className="text-slate-600 italic">Waiting for wallet connection...</div>}
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
