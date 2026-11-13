import React, { useEffect, useRef, useState } from 'react';
import { getCurrentUser, loginWithEmail, loginWithGoogle, logout, registerAccount } from './api';
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  CreditCard,
  History,
  Lock,
  Radio,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  Wifi,
  WifiOff
} from 'lucide-react';

const membersList = [
  { id: 1, name: 'Samukelisiwe Phiri', address: '0x71C...4f2B', status: 'Paid', amount: 2500, method: 'ESP32 Matrix PIN', time: '10 mins ago', role: 'Member (Next Payout)' },
  { id: 2, name: 'Thabani Ndlela', address: '0x98A...11E4', status: 'Paid', amount: 2500, method: 'NFC Tap-to-Pay', time: '1 hour ago', role: 'Group Leader' },
  { id: 3, name: 'Olive Mbuaya', address: '0x34F...8821', status: 'Paid', amount: 2500, method: 'USDT Direct', time: '3 hours ago', role: 'Member' },
  { id: 4, name: 'Kgothatso Molefe', address: '0x12B...90AA', status: 'Paid', amount: 2500, method: 'ESP32 Matrix PIN', time: 'Yesterday', role: 'Member' },
  { id: 5, name: 'Kgodiso Lebese', address: '0x66C...3321', status: 'Paid', amount: 2500, method: 'NFC Tap-to-Pay', time: 'Yesterday', role: 'Member' },
  { id: 6, name: 'Phindile Ndlovu', address: '0x44E...7789', status: 'Paid', amount: 2500, method: 'USDT Direct', time: '2 days ago', role: 'Member' },
  { id: 7, name: 'Omphile Phiri', address: '0x88D...5566', status: 'Paid', amount: 2500, method: 'ESP32 Matrix PIN', time: '2 days ago', role: 'Member' },
  { id: 8, name: 'Halaletsang Malefahlo', address: '0x22F...4411', status: 'Paid', amount: 2500, method: 'NFC Tap-to-Pay', time: '3 days ago', role: 'Member' },
  { id: 9, name: 'Philasande Phiri', address: '0x55A...9900', status: 'Paid', amount: 2500, method: 'ESP32 Matrix PIN', time: '3 days ago', role: 'Member' },
  { id: 10, name: 'Zanele Pillay', address: '0xAA1...44B3', status: 'Pending', amount: 2500, method: 'Awaiting Sweep', time: 'Pending', role: 'Member' }
];

const initialTransactions = [
  { hash: '0x8fa...c912', type: 'Deposit', member: 'Olive Mbuaya', amount: 'R 2,500', method: 'ESP32 Hardware Node', status: 'Confirmed', block: 19482910 },
  { hash: '0x3db...7710', type: 'Deposit', member: 'Samukelisiwe Phiri', amount: 'R 2,500', method: 'Keypad PIN Auth', status: 'Confirmed', block: 19482855 },
  { hash: '0x9cc...4418', type: 'Deposit', member: 'Thabani Ndlela', amount: 'R 2,500', method: 'NFC Card Tap', status: 'Confirmed', block: 19482701 },
  { hash: '0x1ea...0029', type: 'Payout', member: 'Kgothatso Molefe', amount: 'R 25,000', method: 'Smart Contract Escrow', status: 'Executed', block: 19410022 }
];

const initialGroup = {
  cycle: 4,
  totalCycles: 12,
  contributionAmount: 2500,
  usdtRate: 18.5,
  poolBalanceZar: 22500,
  targetZar: 25000,
  nextPayoutRecipient: 'Samukelisiwe F. (You)',
  nextPayoutDate: '2026-11-15',
  payoutRules: 'Rotational (Strict Monthly 15th)'
};

const formatRand = (amount) => `R ${amount.toLocaleString()}`;
const makeHash = (suffix) => `0x${Math.random().toString(16).slice(2, 10)}...${suffix}`;

export default function App() {
  const loginCanvasRef = useRef(null);
  const googleButtonRef = useRef(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [selectedGroup] = useState('Soweto Green Savings Circle');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [walletConnected, setWalletConnected] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [groupData, setGroupData] = useState(initialGroup);
  const [members, setMembers] = useState(membersList);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [lcdLine1, setLcdLine1] = useState('PACT NODE v2.4');
  const [lcdLine2, setLcdLine2] = useState('READY - ENTER PIN');
  const [inputPin, setInputPin] = useState('');
  const [queuedDeposits, setQueuedDeposits] = useState([]);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [toast, setToast] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((result) => {
        if (active && result?.user) {
          setAuthUser(result.user);
          setIsLoggedIn(true);
        }
      })
      .catch((error) => {
        if (active) setLoginError(error.message);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!googleClientId || isLoggedIn || authChecking) return undefined;
    let active = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!active || !googleButtonRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          if (!credential) {
            setLoginError('Google sign-in did not return a credential.');
            return;
          }
          setAuthLoading(true);
          setLoginError('');
          try {
            const result = await loginWithGoogle(credential);
            setAuthUser(result.user);
            setIsLoggedIn(true);
          } catch (error) {
            setLoginError(error.message);
          } finally {
            setAuthLoading(false);
          }
        },
        auto_select: false,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.min(400, Math.floor(googleButtonRef.current.clientWidth)),
      });
    };
    script.onerror = () => {
      if (active) setLoginError('Unable to load Google sign-in. Please try again later.');
    };
    document.head.appendChild(script);
    return () => {
      active = false;
      script.onload = null;
      script.onerror = null;
      script.remove();
    };
  }, [authChecking, googleClientId, isLoggedIn]);

  useEffect(() => {
    const canvas = loginCanvasRef.current;
    if (!canvas || isLoggedIn) return undefined;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, radius: 200 };
    const symbols = ['R', 'ETH', 'USDT', 'LOCK', 'PACT', 'ZK'];
    const colors = ['#10b981', '#3b82f6', '#8b5cf6'];
    let width = 0;
    let height = 0;
    let animationFrameId;
    let lastFrameTime = 0;

    const particles = Array.from({ length: 65 }, (_, index) => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      radius: Math.random() * 2.5 + 1.5,
      symbol: index % 5 === 0 ? symbols[Math.floor(Math.random() * symbols.length)] : null,
      pulse: Math.random() * Math.PI * 2,
      color: colors[index % colors.length]
    }));

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const handleMouseMove = (event) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      context.beginPath();
      context.strokeStyle = 'rgba(15, 23, 42, 0.5)';
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 70) {
        context.moveTo(x, 0);
        context.lineTo(x, height);
      }
      for (let y = 0; y < height; y += 70) {
        context.moveTo(0, y);
        context.lineTo(width, y);
      }
      context.stroke();

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];

        if (!motionPreference.matches) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.pulse += 0.03;

          if (particle.x < 0 || particle.x > width) particle.vx *= -1;
          if (particle.y < 0 || particle.y > height) particle.vy *= -1;

          const dx = mouse.x - particle.x;
          const dy = mouse.y - particle.y;
          const distanceToMouse = Math.hypot(dx, dy);
          if (distanceToMouse > 0 && distanceToMouse < mouse.radius) {
            const force = (mouse.radius - distanceToMouse) / mouse.radius;
            particle.x -= (dx / distanceToMouse) * force * 2.4;
            particle.y -= (dy / distanceToMouse) * force * 2.4;
          }
        }

        for (let j = i + 1; j < particles.length; j += 1) {
          const neighbor = particles[j];
          const distance = Math.hypot(particle.x - neighbor.x, particle.y - neighbor.y);
          if (distance < 180) {
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(neighbor.x, neighbor.y);
            context.strokeStyle = `rgba(16, 185, 129, ${(1 - distance / 180) * 0.32})`;
            context.lineWidth = 1;
            context.stroke();
          }
        }

        const pulseRadius = motionPreference.matches ? particle.radius : particle.radius + Math.sin(particle.pulse);
        context.beginPath();
        context.arc(particle.x, particle.y, Math.max(0.8, pulseRadius), 0, Math.PI * 2);
        context.fillStyle = particle.color;
        context.shadowBlur = 10;
        context.shadowColor = particle.color;
        context.fill();
        context.shadowBlur = 0;

        if (particle.symbol) {
          context.font = '10px monospace';
          context.fillStyle = 'rgba(226, 232, 240, 0.6)';
          context.fillText(particle.symbol, particle.x + 7, particle.y + 3);
        }
      }

    };

    const handleResize = () => {
      resizeCanvas();
      if (motionPreference.matches) draw();
    };

    resizeCanvas();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    if (motionPreference.matches) {
      draw();
    } else {
      const animate = (timestamp) => {
        if (timestamp - lastFrameTime >= 1000 / 30) {
          draw();
          lastFrameTime = timestamp;
        } else {
          animationFrameId = window.requestAnimationFrame(animate);
          return;
        }
        animationFrameId = window.requestAnimationFrame(animate);
      };
      animationFrameId = window.requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isLoggedIn]);

  const showToast = (message, type = 'success') => setToast({ message, type });
  const paidCount = members.filter((member) => member.status === 'Paid').length;
  const currentProgressPct = Math.min(100, Math.round((groupData.poolBalanceZar / groupData.targetZar) * 100));
  const visibleMembers = members.filter((member) =>
    `${member.name} ${member.address} ${member.role} ${member.status}`
      .toLowerCase()
      .includes(memberSearch.toLowerCase())
  );

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setLoginError('');
    try {
      const result = authMode === 'signup'
        ? await registerAccount({ name: authName, email: authEmail, password: authPassword })
        : await loginWithEmail({ email: authEmail, password: authPassword });
      setAuthUser(result.user);
      setIsLoggedIn(true);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setAuthUser(null);
      setAuthPassword('');
      setIsLoggedIn(false);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleWalletToggle = () => {
    setWalletConnected((connected) => !connected);
    showToast(walletConnected ? 'Wallet disconnected from the demo.' : 'Demo wallet connected: 0x71C...4f2B', 'info');
  };

  const queueDeposit = (method) => {
    const queuedMemberIds = new Set(queuedDeposits.map((deposit) => deposit.memberId));
    const nextMember = members.find((member) => member.status === 'Pending' && !queuedMemberIds.has(member.id));
    if (!nextMember) {
      showToast('All group members have already contributed this cycle.', 'error');
      setIsProcessingTx(false);
      return;
    }
    setQueuedDeposits((previous) => [...previous, { memberId: nextMember.id, method }]);
    setLcdLine1('OFFLINE MODE');
    setLcdLine2('SAVED TO EEPROM');
    setInputPin('');
    setIsProcessingTx(false);
    showToast('Offline contribution queued in ESP32 EEPROM storage.', 'warning');
  };

  const recordDeposit = (method) => {
    const nextMember = members.find((member) => member.status === 'Pending');
    if (!nextMember) {
      showToast('All group members have already contributed this cycle.', 'error');
      setIsProcessingTx(false);
      return;
    }
    const methodLabel = method.includes('NFC')
      ? 'NFC Card Tap'
      : method.includes('PIN')
        ? 'Keypad PIN Auth'
        : 'ESP32 Cash Verified';

    setGroupData((previous) => ({
      ...previous,
      poolBalanceZar: previous.poolBalanceZar + previous.contributionAmount
    }));
    setMembers((previous) => previous.map((member) => (
      member.id === nextMember.id
        ? { ...member, status: 'Paid', amount: groupData.contributionAmount, method, time: 'Just now' }
        : member
    )));
    setTransactions((previous) => [{
      hash: makeHash('tx'),
      type: 'Deposit',
      member: nextMember.name,
      amount: formatRand(groupData.contributionAmount),
      method: methodLabel,
      status: 'Confirmed',
      block: 19483000 + Math.floor(Math.random() * 50)
    }, ...previous]);
    setLcdLine1('DEPOSIT SUCCESS!');
    setLcdLine2(`${formatRand(groupData.contributionAmount)} -> ON-CHAIN`);
    setInputPin('');
    setIsProcessingTx(false);
    showToast(`Hardware node verified a ${formatRand(groupData.contributionAmount)} contribution for ${nextMember.name}.`);
    window.setTimeout(() => {
      setLcdLine1('PACT NODE v2.4');
      setLcdLine2('READY - ENTER PIN');
    }, 2500);
  };

  const processHardwareDeposit = (method) => {
    if (isProcessingTx) return;
    setIsProcessingTx(true);
    setLcdLine1('VERIFYING STATE...');
    setLcdLine2('CONNECTING RPC...');
    window.setTimeout(() => {
      if (!isOnline) {
        queueDeposit(method);
        return;
      }
      recordDeposit(method);
    }, 1200);
  };

  const handleKeypadPress = (key) => {
    if (isProcessingTx) return;
    if (key === 'C') {
      setInputPin('');
      setLcdLine1('PIN CLEARED');
      setLcdLine2('ENTER PIN:');
      return;
    }
    if (key === '#') {
      if (inputPin.length < 4) {
        setLcdLine1('ERROR: PIN TOO SHORT');
        setLcdLine2('TRY AGAIN');
        window.setTimeout(() => {
          setInputPin('');
          setLcdLine1('PACT NODE v2.4');
          setLcdLine2('READY - ENTER PIN');
        }, 1500);
        return;
      }
      processHardwareDeposit(`ESP32 Matrix PIN (${inputPin})`);
      return;
    }
    if (inputPin.length < 6) {
      const newPin = inputPin + key;
      setInputPin(newPin);
      setLcdLine1('INPUTTING AUTH');
      setLcdLine2(`PIN: ${'*'.repeat(newPin.length)}`);
    }
  };

  const handleSyncOfflineQueue = () => {
    if (queuedDeposits.length === 0) {
      showToast('No offline transactions in the EEPROM queue.', 'info');
      return;
    }
    if (!isOnline) {
      showToast('Cannot sync: the hardware terminal is currently offline.', 'error');
      return;
    }

    const syncableDeposits = queuedDeposits.filter((deposit) =>
      members.some((member) => member.id === deposit.memberId && member.status === 'Pending')
    );
    setIsProcessingTx(true);
    setLcdLine1('SYNCING EEPROM...');
    setLcdLine2(`UPLOADING ${syncableDeposits.length} TXS`);
    window.setTimeout(() => {
      setQueuedDeposits([]);
      if (syncableDeposits.length === 0) {
        setIsProcessingTx(false);
        setLcdLine1('SYNC COMPLETE');
        setLcdLine2('NO VALID TXS');
        showToast('Queued contributions could not be matched to pending members.', 'error');
        return;
      }
      const queuedMemberIds = new Set(syncableDeposits.map((deposit) => deposit.memberId));
      const addedAmount = syncableDeposits.length * groupData.contributionAmount;
      setGroupData((previous) => ({ ...previous, poolBalanceZar: previous.poolBalanceZar + addedAmount }));
      setMembers((previous) => previous.map((member) => {
        const deposit = syncableDeposits.find((item) => item.memberId === member.id);
        if (!deposit) return member;
        return {
          ...member,
          status: 'Paid',
          amount: groupData.contributionAmount,
          method: deposit.method,
          time: 'Just now'
        };
      }));
      setTransactions((previous) => [
        ...syncableDeposits.map((deposit, index) => {
          const member = members.find((entry) => entry.id === deposit.memberId);
          return {
            hash: makeHash('sync'),
            type: 'Deposit',
            member: member?.name ?? 'Group member',
            amount: formatRand(groupData.contributionAmount),
            method: deposit.method.includes('NFC') ? 'NFC Card Tap' : 'ESP32 Hardware Auth',
            status: 'Confirmed',
            block: 19483000 + index
          };
        }),
        ...previous
      ]);
      setIsProcessingTx(false);
      setLcdLine1('SYNC COMPLETE');
      setLcdLine2('ALL TXS ON-CHAIN');
      showToast(`Synced ${queuedMemberIds.size} queued contribution${queuedMemberIds.size === 1 ? '' : 's'} from the ESP32 demo.`);
      window.setTimeout(() => {
        setLcdLine1('PACT NODE v2.4');
        setLcdLine2('READY - ENTER PIN');
      }, 2000);
    }, 1500);
  };

  const handleExecutePayout = () => {
    if (groupData.poolBalanceZar < groupData.targetZar) {
      showToast(`Payout is not ready. The pool needs ${formatRand(groupData.targetZar - groupData.poolBalanceZar)} more.`, 'error');
      return;
    }
    if (!isOnline) {
      showToast('Connect the hardware node before executing a payout.', 'error');
      return;
    }
    setIsProcessingTx(true);
    showToast(`Executing demo payout to ${groupData.nextPayoutRecipient}...`, 'info');
    window.setTimeout(() => {
      const recipient = groupData.nextPayoutRecipient;
      const payoutAmount = groupData.poolBalanceZar;
      setTransactions((previous) => [{
        hash: makeHash('exec'),
        type: 'Payout',
        member: recipient,
        amount: formatRand(payoutAmount),
        method: 'Escrow Smart Contract',
        status: 'Executed',
        block: 19483050
      }, ...previous]);
      setGroupData((previous) => ({
        ...previous,
        cycle: Math.min(previous.cycle + 1, previous.totalCycles),
        poolBalanceZar: 0,
        nextPayoutRecipient: 'Thabani Ndlela'
      }));
      setMembers((previous) => previous.map((member) => ({
        ...member,
        status: 'Pending',
        amount: 0,
        method: 'Pending Deposit',
        time: '-'
      })));
      setIsProcessingTx(false);
      showToast(`Demo payout of ${formatRand(payoutAmount)} recorded for ${recipient}.`);
    }, 1500);
  };

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] p-4 text-sm text-slate-400">
        Checking your account...
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="relative isolate flex min-h-screen items-center justify-center overflow-x-hidden bg-[#030712] p-4 font-sans text-slate-100">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="pact-ambient-orb pact-ambient-orb-emerald absolute left-[15%] top-[10%] h-[min(65vw,450px)] w-[min(65vw,450px)] rounded-full bg-emerald-500/15 blur-[140px]" />
          <div className="pact-ambient-orb pact-ambient-orb-blue absolute bottom-[10%] right-[15%] h-[min(70vw,500px)] w-[min(70vw,500px)] rounded-full bg-blue-600/15 blur-[160px]" />
          <canvas ref={loginCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />
          <svg className="pact-network-drift absolute inset-0 h-full w-full opacity-40" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
            <g fill="none" stroke="url(#network-gradient)" strokeWidth="1">
              <path d="M75 220 205 310 360 245 505 345 665 235 825 330 1015 225 1130 315" />
              <path d="M110 660 265 540 425 675 585 555 740 690 895 555 1080 675" />
              <path d="M205 310 265 540M360 245 425 675M505 345 585 555M665 235 740 690M825 330 895 555M1015 225 1080 675" />
              <path d="M75 220 265 540M360 245 585 555M665 235 895 555M825 330 1080 675" opacity=".45" />
            </g>
            <defs>
              <linearGradient id="network-gradient" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#34d399" stopOpacity=".12" />
                <stop offset=".5" stopColor="#22d3ee" stopOpacity=".65" />
                <stop offset="1" stopColor="#34d399" stopOpacity=".16" />
              </linearGradient>
            </defs>
            <g fill="#6ee7b7">
              {[ [75, 220], [205, 310], [360, 245], [505, 345], [665, 235], [825, 330], [1015, 225], [1130, 315], [110, 660], [265, 540], [425, 675], [585, 555], [740, 690], [895, 555], [1080, 675] ].map(([cx, cy], index) => (
                <circle key={`${cx}-${cy}`} className="pact-network-node" cx={cx} cy={cy} r={index % 3 === 0 ? 4 : 2.5} style={{ animationDelay: `${index * -0.37}s` }} />
              ))}
            </g>
          </svg>
          <div className="hidden sm:block">
            <div className="pact-float-badge absolute left-[8%] top-[18%] rounded-full border border-emerald-500/40 bg-emerald-950/70 px-3.5 py-1.5 font-mono text-xs text-emerald-300 shadow-lg shadow-emerald-950/50">
              🔒 ZK-Escrow Active
            </div>
            <div className="pact-float-badge absolute right-[10%] top-[22%] rounded-full border border-amber-500/40 bg-amber-950/70 px-3.5 py-1.5 font-mono text-xs text-amber-300 shadow-lg shadow-amber-950/50" style={{ animationDelay: '-2s' }}>
              🪙 R 25,750 Pool Liquidity
            </div>
            <div className="pact-float-badge absolute bottom-[22%] left-[10%] rounded-full border border-blue-500/40 bg-blue-950/70 px-3.5 py-1.5 font-mono text-xs text-blue-300 shadow-lg shadow-blue-950/50" style={{ animationDelay: '-4s' }}>
              ⚡ ESP32 Telemetry: 14ms
            </div>
            <div className="pact-float-badge absolute bottom-[20%] right-[12%] rounded-full border border-purple-500/40 bg-purple-950/70 px-3.5 py-1.5 font-mono text-xs text-purple-300 shadow-lg shadow-purple-950/50" style={{ animationDelay: '-1s' }}>
              🌐 Node Engine Network
            </div>
          </div>
        </div>
        <div className="group relative z-10 my-4 w-full max-w-md overflow-hidden rounded-2xl border border-slate-700/60 bg-[#0b1329]/90 p-5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: 'radial-gradient(500px circle at var(--pointer-x, 50%) var(--pointer-y, 0%), rgba(34, 211, 238, 0.13), transparent 45%)' }}
          />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 to-emerald-400" />
          <div className="relative z-10 mb-5 flex flex-col items-center text-center">
            <img src="/pact-logo.png" alt="PACT network shield" className="mb-3 h-16 w-16 rounded-2xl border border-cyan-500/30 object-cover" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {authMode === 'signup' ? 'Create your account' : 'Welcome to PACT'}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {authMode === 'signup' ? 'Join your community savings group' : 'Sign in to your community account'}
            </p>
          </div>
          <div className="relative z-10 space-y-3">
            {googleClientId ? (
              <div ref={googleButtonRef} className="flex min-h-11 justify-center" />
            ) : (
              <button
                type="button"
                onClick={() => setLoginError('Google sign-in is not configured. Add VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to the environment files.')}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-white py-3 font-medium text-slate-800 transition-colors hover:bg-slate-100"
              >
                <span aria-hidden="true" className="text-lg font-bold text-blue-600">G</span>
                Continue with Google
              </button>
            )}
            <div className="flex items-center gap-3 py-1 text-xs text-slate-500">
              <span className="h-px flex-1 bg-slate-800" />
              or continue with email
              <span className="h-px flex-1 bg-slate-800" />
            </div>
          </div>
          <form onSubmit={handleAuthSubmit} className="relative z-10 space-y-3">
            {authMode === 'signup' && (
              <div>
                <label htmlFor="auth-name" className="mb-1.5 block text-sm font-medium text-slate-300">Full name</label>
                <input
                  id="auth-name"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  required
                  value={authName}
                  onChange={(event) => {
                    setAuthName(event.target.value);
                    setLoginError('');
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-slate-300">Email address</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                value={authEmail}
                onChange={(event) => {
                  setAuthEmail(event.target.value);
                  setLoginError('');
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="auth-password" className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
              <input
                id="auth-password"
                type="password"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                minLength={8}
                maxLength={128}
                required
                value={authPassword}
                onChange={(event) => {
                  setAuthPassword(event.target.value);
                  setLoginError('');
                }}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500"
                placeholder="At least 8 characters"
              />
            </div>
            {loginError && <p role="alert" className="text-sm text-rose-400">{loginError}</p>}
            <button
              type="submit"
              disabled={authLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 py-3 font-semibold text-white shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-500 hover:to-emerald-500 disabled:cursor-wait disabled:opacity-70"
            >
              <UserCheck className="h-4 w-4" />
              <span>{authLoading ? 'Please wait...' : authMode === 'signup' ? 'Create account' : 'Sign in'}</span>
            </button>
          </form>
          <p className="relative z-10 mt-5 text-center text-sm text-slate-400">
            {authMode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => {
                setAuthMode((mode) => mode === 'signup' ? 'login' : 'signup');
                setLoginError('');
              }}
              className="font-semibold text-cyan-300 hover:text-cyan-200"
            >
              {authMode === 'signup' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <div className="relative z-10 mt-2 text-center">
            <p className="text-[11px] text-slate-500">Your account is protected with secure sign-in.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100 selection:bg-cyan-500 selection:text-black">
      {toast && (
        <div role="status" className="fixed right-4 top-4 z-50 max-w-md sm:right-6 sm:top-6">
          <div className={`flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md ${
            toast.type === 'error' ? 'border-red-500 bg-red-950/95 text-red-200' :
              toast.type === 'warning' ? 'border-amber-500 bg-amber-950/95 text-amber-200' :
                toast.type === 'info' ? 'border-blue-500 bg-blue-950/95 text-blue-200' :
                  'border-emerald-500 bg-emerald-950/95 text-emerald-200'
          }`}>
            {toast.type === 'info' ? <Radio className="h-5 w-5 shrink-0 text-blue-400" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 px-4 py-4 backdrop-blur-lg sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <img src="/pact-logo.png" alt="PACT network shield" className="h-12 w-12 rounded-xl border border-cyan-500/30 object-cover shadow-lg shadow-cyan-500/10" />
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">PACT</span>
                <span className="rounded-full border border-cyan-500/30 bg-slate-800 px-2 py-0.5 font-mono text-xs text-cyan-400">Stokvel Web3</span>
              </div>
              <p className="text-xs text-slate-400">Peer-to-Peer Agreement &amp; Community Trust</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="font-mono text-slate-300">Sepolia Testnet Demo</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOnline((online) => !online)}
              title="Toggle ESP32 connectivity"
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                isOnline ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50' : 'border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>ESP32: {isOnline ? 'Online' : 'Offline Mode'}</span>
              {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleWalletToggle}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow-lg shadow-cyan-900/30 transition-all hover:from-cyan-500 hover:to-emerald-500 active:scale-95"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>{walletConnected ? '0x71C...4f2B' : 'Connect Wallet'}</span>
            </button>
            <span className="max-w-40 truncate text-xs text-slate-300">{authUser?.name}</span>
            <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-6 p-4 md:p-6 lg:grid-cols-12">
        <section className="flex flex-col gap-6 lg:col-span-8">
          <nav aria-label="Dashboard sections" className="flex gap-4 overflow-x-auto border-b border-slate-800 text-sm font-medium sm:gap-6">
            {[
              { id: 'dashboard', label: 'Group Overview', Icon: Users },
              { id: 'ledger', label: 'Verifiable On-Chain Ledger', Icon: History },
              { id: 'manage', label: 'Smart Rules', Icon: Sliders }
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-2 border-b-2 pb-3 transition-all ${
                  activeTab === id ? 'border-cyan-400 font-semibold text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {activeTab === 'dashboard' && (
            <>
              <section className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 shadow-xl sm:p-6">
                <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />
                <div className="relative">
                  <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Active Group</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-400">Cycle {groupData.cycle} of {groupData.totalCycles}</span>
                      </div>
                      <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{selectedGroup}</h1>
                    </div>
                    <button
                      type="button"
                      onClick={handleExecutePayout}
                      disabled={isProcessingTx}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:from-emerald-400 hover:to-teal-500 active:scale-95 disabled:opacity-50"
                    >
                      <Award className="h-4 w-4" />
                      <span>Execute Scheduled Payout</span>
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-end justify-between gap-4 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Total Pool Balance</p>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-2xl font-extrabold text-white sm:text-3xl">{formatRand(groupData.poolBalanceZar)} ZAR</span>
                          <span className="font-mono text-xs text-cyan-400">(~{(groupData.poolBalanceZar / groupData.usdtRate).toFixed(0)} USDT)</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Target Goal</p>
                        <p className="font-mono text-sm font-semibold text-slate-300">{formatRand(groupData.targetZar)} ZAR</p>
                      </div>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="Collection progress"
                      aria-valuenow={currentProgressPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-3 w-full overflow-hidden rounded-full border border-slate-800 bg-slate-950 p-0.5"
                    >
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 shadow-sm shadow-cyan-400 transition-all duration-700" style={{ width: `${currentProgressPct}%` }} />
                    </div>
                    <div className="flex flex-col justify-between gap-1 pt-1 text-xs text-slate-400 sm:flex-row">
                      <span>Collection Status: <strong className="text-emerald-400">{currentProgressPct}% Complete</strong></span>
                      <span>Monthly Due: <strong className="text-slate-200">{formatRand(groupData.contributionAmount)} / member</strong></span>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-4 text-xs sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <p className="mb-0.5 text-slate-400">Next Beneficiary</p>
                      <p className="flex items-center gap-1.5 font-semibold text-cyan-300"><Users className="h-3.5 w-3.5" />{groupData.nextPayoutRecipient}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <p className="mb-0.5 text-slate-400">Scheduled Payout Date</p>
                      <p className="flex items-center gap-1.5 font-semibold text-emerald-300"><Clock className="h-3.5 w-3.5" />{groupData.nextPayoutDate}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                      <p className="mb-0.5 text-slate-400">Smart Contract Rule</p>
                      <p className="flex items-center gap-1.5 font-semibold text-slate-200"><Lock className="h-3.5 w-3.5 text-cyan-400" />Multi-Sig Verified Payout</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
                <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-white">
                      <span>Stokvel Roster &amp; Payment Status</span>
                      <span className="rounded-full border border-cyan-800 bg-cyan-950 px-2 py-0.5 text-xs text-cyan-400">{paidCount}/{members.length} Paid</span>
                    </h2>
                    <p className="text-xs text-slate-400">Verifiable contribution history logged on-chain &amp; via ESP32 terminal.</p>
                  </div>
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="search"
                      aria-label="Search members"
                      placeholder="Search member..."
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-200 outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 font-semibold text-slate-400">
                        <th className="pb-3 pl-2">Member</th>
                        <th className="pb-3">Role</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Verification Method</th>
                        <th className="pb-3 pr-2">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {visibleMembers.map((member) => (
                        <tr key={member.id} className="transition-colors hover:bg-slate-950/40">
                          <td className="py-3 pl-2">
                            <p className="font-semibold text-slate-200">{member.name}</p>
                            <p className="font-mono text-[10px] text-slate-500">{member.address}</p>
                          </td>
                          <td className="py-3 text-[11px] text-slate-400">{member.role}</td>
                          <td className="py-3">
                            {member.status === 'Paid'
                              ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-800/60 bg-emerald-950/80 px-2 py-0.5 text-[10px] font-medium text-emerald-400"><CheckCircle2 className="h-3 w-3" />Paid</span>
                              : <span className="inline-flex items-center gap-1 rounded-full border border-amber-800/60 bg-amber-950/80 px-2 py-0.5 text-[10px] font-medium text-amber-400"><Clock className="h-3 w-3" />Pending</span>}
                          </td>
                          <td className="py-3 font-mono font-medium text-slate-200">{member.amount > 0 ? formatRand(member.amount) : '-'}</td>
                          <td className="py-3">
                            <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                              {member.method.includes('ESP32') || member.method.includes('PIN') ? <Cpu className="h-3 w-3 text-cyan-400" /> : null}
                              {member.method.includes('NFC') ? <Radio className="h-3 w-3 text-emerald-400" /> : null}
                              {member.method.includes('USDT') ? <CreditCard className="h-3 w-3 text-blue-400" /> : null}
                              {member.method}
                            </span>
                          </td>
                          <td className="py-3 pr-2 text-[11px] text-slate-400">{member.time}</td>
                        </tr>
                      ))}
                      {visibleMembers.length === 0 && (
                        <tr><td colSpan="6" className="py-8 text-center text-slate-500">No members match “{memberSearch}”.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {activeTab === 'ledger' && (
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
              <div className="mb-6">
                <h2 className="flex items-center gap-2 text-xl font-bold text-white"><History className="h-5 w-5 text-cyan-400" /><span>Verifiable On-Chain &amp; Hardware Ledger</span></h2>
                <p className="mt-1 text-xs text-slate-400">Demo record of deposits, hardware syncs, and smart contract payouts.</p>
              </div>
              <div className="space-y-3">
                {transactions.map((transaction, index) => (
                  <article key={`${transaction.hash}-${index}`} className="flex flex-col items-start justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950 p-4 transition-all hover:border-slate-700 md:flex-row md:items-center">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${transaction.type === 'Deposit' ? 'border-emerald-800 bg-emerald-950 text-emerald-400' : 'border-cyan-800 bg-cyan-950 text-cyan-400'}`}>
                        {transaction.type === 'Deposit' ? <ArrowUpRight className="h-4 w-4" /> : <Award className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-200">{transaction.type} - {transaction.member}</span>
                          <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] text-slate-400">Block #{transaction.block}</span>
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>Method: <strong>{transaction.method}</strong></span>
                          <span>•</span>
                          <span className="font-mono text-[10px] text-cyan-400">{transaction.hash}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-between gap-4 border-t border-slate-900 pt-2 md:w-auto md:border-0 md:pt-0">
                      <span className="font-mono text-sm font-bold text-slate-100">{transaction.amount}</span>
                      <span className="flex items-center gap-1 rounded-full border border-emerald-800/50 bg-emerald-950/60 px-2.5 py-1 text-xs text-emerald-400"><Check className="h-3 w-3" />{transaction.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'manage' && (
            <section className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl sm:p-6">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-white"><Sliders className="h-5 w-5 text-cyan-400" /><span>Stokvel Smart Contract Configuration</span></h2>
                <p className="mt-1 text-xs text-slate-400">Configure contribution cycles, payout orders, and multi-sig security settings.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <label htmlFor="contribution-amount" className="text-xs font-semibold uppercase text-slate-400">Monthly Contribution (ZAR)</label>
                  <input
                    id="contribution-amount"
                    type="number"
                    min="1"
                    value={groupData.contributionAmount}
                    onChange={(event) => {
                      const amount = Number(event.target.value);
                      setGroupData((previous) => ({ ...previous, contributionAmount: Number.isFinite(amount) ? Math.max(0, amount) : 0 }));
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-500"
                  />
                  <p className="text-[11px] text-slate-500">Estimated stablecoin equivalent: ~{(groupData.contributionAmount / groupData.usdtRate).toFixed(2)} USDT</p>
                </div>
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <label htmlFor="payout-rule" className="text-xs font-semibold uppercase text-slate-400">Payout Rotation Execution</label>
                  <select
                    id="payout-rule"
                    value={groupData.payoutRules}
                    onChange={(event) => setGroupData((previous) => ({ ...previous, payoutRules: event.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                  >
                    <option>Rotational (Strict Monthly 15th)</option>
                    <option>Bidding Auction Payout</option>
                    <option>Emergency Request Multi-Sig</option>
                  </select>
                  <p className="text-[11px] text-slate-500">Governed by PACT Smart Escrow logic.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-cyan-800/40 bg-cyan-950/30 p-4 text-xs text-cyan-200">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
                <div>
                  <h3 className="font-semibold text-cyan-300">ESP32 Hardware Authorization Enabled</h3>
                  <p className="mt-0.5 text-cyan-200/80">Group members can log cash or physical contributions at registered PACT hardware terminals using a PIN or NFC card.</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">Settings are demo-only and will reset when this page reloads.</p>
            </section>
          )}
        </section>

        <aside className="flex flex-col gap-6 lg:col-span-4">
          <section className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl lg:sticky lg:top-24">
            <div className="mb-4 flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-cyan-400" />
                <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-white"><Cpu className="h-4 w-4 text-cyan-400" /><span>PACT Hardware Node</span></h2>
              </div>
              <span className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">ESP32-WROOM</span>
            </div>
            <div className="space-y-4 rounded-2xl border-2 border-slate-800 bg-slate-950 p-4 shadow-inner">
              <div className="relative overflow-hidden rounded-xl border-4 border-slate-800 bg-[#0b1d13] p-3 font-mono text-emerald-400 shadow-inner">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                <div className="relative">
                  <div className="mb-1 flex justify-between text-[10px] text-emerald-600/70">
                    <span>I2C 16x2 LCD DISPLAY</span>
                    <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                  </div>
                  <div className="space-y-1 py-1">
                    <div className="truncate rounded border border-emerald-900/40 bg-emerald-950/40 px-2 py-1 text-sm font-bold tracking-widest">{lcdLine1}</div>
                    <div className="truncate rounded border border-emerald-900/40 bg-emerald-950/40 px-2 py-1 text-xs font-semibold tracking-wider">{lcdLine2}</div>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-emerald-900/50 pt-1 text-[9px] text-emerald-500/80">
                    <span>Queue: {queuedDeposits.length} TXs</span>
                    <span className={isProcessingTx ? 'animate-pulse' : ''}>{isProcessingTx ? '● TX BUSY' : '● READY'}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">Physical Entry Controls</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => processHardwareDeposit('NFC Tap-to-Pay')} disabled={isProcessingTx} className="flex flex-col items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900 p-2.5 text-xs font-medium text-slate-200 transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50">
                    <Radio className="h-4 w-4 text-emerald-400" /><span>NFC Tap-to-Pay</span>
                  </button>
                  <button type="button" onClick={() => processHardwareDeposit('ESP32 Cash Verified')} disabled={isProcessingTx} className="flex flex-col items-center gap-1 rounded-xl border border-slate-700/80 bg-slate-900 p-2.5 text-xs font-medium text-slate-200 transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50">
                    <CreditCard className="h-4 w-4 text-cyan-400" /><span>Cash Deposit</span>
                  </button>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '#'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleKeypadPress(key)}
                        disabled={isProcessingTx}
                        aria-label={key === 'C' ? 'Clear PIN' : key === '#' ? 'Confirm PIN' : `Enter ${key}`}
                        className={`flex h-10 items-center justify-center rounded-lg border font-mono text-sm font-bold shadow-md transition-all active:scale-90 disabled:opacity-50 ${
                          key === '#' ? 'border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-500' :
                            key === 'C' ? 'border-red-700 bg-red-900/80 text-red-200 hover:bg-red-800' :
                              'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                        }`}
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSyncOfflineQueue}
                  disabled={isProcessingTx || queuedDeposits.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-slate-900 py-2.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-slate-800 disabled:opacity-40"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isProcessingTx ? 'animate-spin' : ''}`} />
                  <span>Sync EEPROM Queue ({queuedDeposits.length} Queued)</span>
                </button>
              </div>
            </div>
            <div className="mt-4 flex justify-between border-t border-slate-800 pt-3 text-[11px] text-slate-500">
              <span>Baud Rate: 115200</span>
              <span>Memory: 512KB EEPROM</span>
            </div>
          </section>
        </aside>
      </main>

      <footer className="mt-auto border-t border-slate-800 bg-slate-950 px-6 py-6 text-center text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p>PACT • Building financial trust for community savings through smart contracts &amp; embedded nodes.</p>
          <div className="flex items-center gap-4">
            <span className="font-semibold text-cyan-400">Node Engine Hackathon 2026</span>
            <span>•</span>
            <span className="text-slate-400">Team Hack2go</span>
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-7xl text-[10px] text-slate-600">Interactive demonstration only. Wallet, deposits, and payouts shown here are simulated.</p>
      </footer>
    </div>
  );
}
