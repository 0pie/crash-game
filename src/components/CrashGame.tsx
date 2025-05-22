import { useState, useEffect, useRef } from "react";
import {
    connectWallet,
    startGame,
    withdrawFromGame,
    checkGameStatus,
    getCurrentMultiplier,
    getGameInfo,
    getPlayerCurrentGame,
    getWalletBalance,
    getContractBalance,
    setupEventListeners
} from "../utils/ethers";

export default function CrashGame() {
    // États de l'application
    const [account, setAccount] = useState<string | null>(null);
    const [walletBalance, setWalletBalance] = useState<string>("0");
    const [contractBalance, setContractBalance] = useState<string>("0");
    
    // États du jeu
    const [gameId, setGameId] = useState<number | null>(null);
    const [gameStatus, setGameStatus] = useState<'idle' | 'waiting' | 'playing' | 'crashed' | 'won'>('idle');
    const [multiplier, setMultiplier] = useState<number>(100); // 100 = 1.00x
    const [countdown, setCountdown] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [lastPayout, setLastPayout] = useState<string | null>(null);
    
    // Refs pour les timers
    const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
    const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
    const statusCheckRef = useRef<NodeJS.Timeout | null>(null);

    // Effet de nettoyage
    useEffect(() => {
        return () => {
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
            if (statusCheckRef.current) clearInterval(statusCheckRef.current);
        };
    }, []);

    // Vérification de la connexion wallet au chargement
    useEffect(() => {
        checkWalletConnection();
    }, []);

    const checkWalletConnection = async () => {
        try {
            const wallet = await connectWallet();
            if (wallet) {
                setAccount(wallet);
                await updateBalances();
                await checkExistingGame(wallet);
            }
        } catch (error) {
            console.error("Erreur connexion wallet :", error);
        }
    };

    const updateBalances = async () => {
        try {
            const walletInfo = await getWalletBalance();
            const contractBal = await getContractBalance();
            setWalletBalance(parseFloat(walletInfo.balance).toFixed(4));
            setContractBalance(parseFloat(contractBal).toFixed(4));
        } catch (error) {
            console.error("Erreur mise à jour soldes :", error);
        }
    };

    const checkExistingGame = async (walletAddress: string) => {
        try {
            const currentGameId = await getPlayerCurrentGame(walletAddress);
            if (currentGameId > 0) {
                const gameInfo = await getGameInfo(currentGameId);
                if (gameInfo.isActive && !gameInfo.hasWithdrawn && !gameInfo.hasCrashed) {
                    setGameId(currentGameId);
                    setGameStatus('playing');
                    startGameLoop(currentGameId);
                }
            }
        } catch (error) {
            console.error("Erreur vérification jeu existant :", error);
        }
    };

    const handleConnectWallet = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const wallet = await connectWallet();
            setAccount(wallet);
            await updateBalances();
            await checkExistingGame(wallet);
        } catch (error: any) {
            setError(error.message || "Erreur de connexion");
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartGame = async () => {
        try {
            setIsLoading(true);
            setError(null);
            setLastPayout(null);
            
            // Vérifier le solde
            const walletInfo = await getWalletBalance();
            if (parseFloat(walletInfo.balance) < 1) {
                throw new Error("Solde insuffisant (minimum 1 ETH requis)");
            }

            const newGameId = await startGame();
            setGameId(newGameId);
            setGameStatus('waiting');
            setMultiplier(100);
            
            // Démarrer le compte à rebours de 3 secondes
            setCountdown(3);
            countdownTimerRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        if (countdownTimerRef.current) {
                            clearInterval(countdownTimerRef.current);
                        }
                        setGameStatus('playing');
                        startGameLoop(newGameId);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            
            await updateBalances();
        } catch (error: any) {
            setError(error.message || "Erreur lors du démarrage du jeu");
            setGameStatus('idle');
        } finally {
            setIsLoading(false);
        }
    };

    const startGameLoop = (currentGameId: number) => {
        // Timer pour mettre à jour le multiplicateur
        gameTimerRef.current = setInterval(async () => {
            try {
                const currentMult = await getCurrentMultiplier(currentGameId);
                setMultiplier(currentMult);
            } catch (error) {
                console.error("Erreur récupération multiplicateur :", error);
            }
        }, 100); // Mise à jour toutes les 100ms pour plus de fluidité

        // Timer pour vérifier le statut du jeu
        statusCheckRef.current = setInterval(async () => {
            try {
                const isActive = await checkGameStatus(currentGameId);
                if (!isActive) {
                    // Le jeu a crashé
                    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
                    if (statusCheckRef.current) clearInterval(statusCheckRef.current);
                    
                    const gameInfo = await getGameInfo(currentGameId);
                    setGameStatus('crashed');
                    setMultiplier(gameInfo.crashPoint);
                    await updateBalances();
                }
            } catch (error) {
                console.error("Erreur vérification statut :", error);
            }
        }, 1000); // Vérification chaque seconde
    };

    const handleWithdraw = async () => {
        if (!gameId) return;
        
        try {
            setIsLoading(true);
            setError(null);
            
            const result = await withdrawFromGame(gameId);
            
            if (result) {
                setLastPayout(result.payout);
                setGameStatus('won');
                setMultiplier(result.multiplier);
            }
            
            // Arrêter les timers
            if (gameTimerRef.current) clearInterval(gameTimerRef.current);
            if (statusCheckRef.current) clearInterval(statusCheckRef.current);
            
            await updateBalances();
        } catch (error: any) {
            setError(error.message || "Erreur lors du retrait");
        } finally {
            setIsLoading(false);
        }
    };

    const resetGame = () => {
        setGameId(null);
        setGameStatus('idle');
        setMultiplier(100);
        setCountdown(0);
        setError(null);
        setLastPayout(null);
        
        // Nettoyer les timers
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        if (statusCheckRef.current) clearInterval(statusCheckRef.current);
    };

    const formatMultiplier = (mult: number) => {
        return (mult / 100).toFixed(2) + 'x';
    };

    const getMultiplierColor = () => {
        const value = multiplier / 100;
        if (value < 1.5) return 'text-green-400';
        if (value < 2.0) return 'text-yellow-400';
        if (value < 3.0) return 'text-orange-400';
        return 'text-red-400';
    };

    const getStatusColor = () => {
        switch (gameStatus) {
            case 'idle': return 'text-gray-400';
            case 'waiting': return 'text-blue-400';
            case 'playing': return 'text-green-400';
            case 'crashed': return 'text-red-400';
            case 'won': return 'text-green-400';
            default: return 'text-gray-400';
        }
    };

    const getStatusText = () => {
        switch (gameStatus) {
            case 'idle': return 'Prêt à jouer';
            case 'waiting': return `Démarrage dans ${countdown}s...`;
            case 'playing': return 'En cours...';
            case 'crashed': return 'CRASH! 💥';
            case 'won': return 'Gagné! 🎉';
            default: return '';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 text-white">
            <div className="container mx-auto px-4 py-8">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
                        🚀 CRASH GAME
                    </h1>
                    <p className="text-gray-300">Retirez avant le crash pour gagner gros!</p>
                </div>

                {/* Wallet Connection */}
                {!account ? (
                    <div className="text-center mb-8">
                        <button
                            onClick={handleConnectWallet}
                            disabled={isLoading}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-lg text-xl font-bold hover:from-blue-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-200 disabled:opacity-50"
                        >
                            {isLoading ? "Connexion..." : "🦊 Connecter MetaMask"}
                        </button>
                    </div>
                ) : (
                    <div className="bg-gray-800 rounded-lg p-6 mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-gray-400">Wallet</p>
                                <p className="text-sm font-mono">{`${account.slice(0, 6)}...${account.slice(-4)}`}</p>
                            </div>
                            <div>
                                <p className="text-gray-400">Votre solde</p>
                                <p className="text-lg font-bold text-green-400">{walletBalance} ETH</p>
                            </div>
                            <div>
                                <p className="text-gray-400">Pot du contrat</p>
                                <p className="text-lg font-bold text-yellow-400">{contractBalance} ETH</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Game Display */}
                <div className="text-center mb-8">
                    {/* Multiplicateur principal */}
                    <div className="bg-black rounded-lg p-8 mb-6 border-2 border-gray-700">
                        <div className={`text-8xl font-bold ${getMultiplierColor()} mb-4`}>
                            {formatMultiplier(multiplier)}
                        </div>
                        <div className={`text-2xl ${getStatusColor()}`}>
                            {getStatusText()}
                        </div>
                        
                        {/* Graphique simple */}
                        <div className="mt-6">
                            <div className="bg-gray-800 h-32 rounded-lg relative overflow-hidden">
                                <div className="absolute inset-0 flex items-end justify-center">
                                    <div 
                                        className={`bg-gradient-to-t ${
                                            gameStatus === 'crashed' 
                                                ? 'from-red-500 to-red-300' 
                                                : 'from-green-500 to-green-300'
                                        } transition-all duration-100 ease-out rounded-t`}
                                        style={{
                                            height: `${Math.min((multiplier / 100) * 20, 100)}%`,
                                            width: '60px'
                                        }}
                                    />
                                </div>
                                {gameStatus === 'crashed' && (
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-4xl">
                                        💥
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Messages d'état */}
                    {lastPayout && gameStatus === 'won' && (
                        <div className="bg-green-800 border border-green-600 rounded-lg p-4 mb-4">
                            <h3 className="text-xl font-bold text-green-300 mb-2">🎉 Félicitations!</h3>
                            <p className="text-green-100">
                                Vous avez gagné <span className="font-bold">{lastPayout} ETH</span> 
                                avec un multiplicateur de <span className="font-bold">{formatMultiplier(multiplier)}</span>
                            </p>
                        </div>
                    )}

                    {gameStatus === 'crashed' && !lastPayout && (
                        <div className="bg-red-800 border border-red-600 rounded-lg p-4 mb-4">
                            <h3 className="text-xl font-bold text-red-300 mb-2">💥 Crash!</h3>
                            <p className="text-red-100">
                                Le jeu a crashé à <span className="font-bold">{formatMultiplier(multiplier)}</span>
                                <br />Vous avez perdu votre mise de 1 ETH
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-800 border border-red-600 rounded-lg p-4 mb-4">
                            <h3 className="text-xl font-bold text-red-300 mb-2">❌ Erreur</h3>
                            <p className="text-red-100">{error}</p>
                        </div>
                    )}
                </div>

                {/* Game Controls */}
                <div className="text-center">
                    {account && (
                        <>
                            {gameStatus === 'idle' && (
                                <button
                                    onClick={handleStartGame}
                                    disabled={isLoading || parseFloat(walletBalance) < 1}
                                    className="bg-gradient-to-r from-green-500 to-blue-500 text-white px-12 py-6 rounded-lg text-2xl font-bold hover:from-green-600 hover:to-blue-600 transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        "🔄 Démarrage..."
                                    ) : parseFloat(walletBalance) < 1 ? (
                                        "❌ Solde insuffisant"
                                    ) : (
                                        "🎮 Jouer (1 ETH)"
                                    )}
                                </button>
                            )}

                            {gameStatus === 'waiting' && (
                                <div className="text-center">
                                    <div className="text-6xl font-bold text-blue-400 mb-4">
                                        {countdown}
                                    </div>
                                    <p className="text-xl text-blue-300">Le jeu commence bientôt...</p>
                                </div>
                            )}

                            {gameStatus === 'playing' && (
                                <button
                                    onClick={handleWithdraw}
                                    disabled={isLoading}
                                    className="bg-gradient-to-r from-yellow-500 to-red-500 text-white px-12 py-6 rounded-lg text-2xl font-bold hover:from-yellow-600 hover:to-red-600 transform hover:scale-105 transition-all duration-200 animate-pulse disabled:opacity-50"
                                >
                                    {isLoading ? "🔄 Retrait..." : "💰 RETIRER MAINTENANT"}
                                </button>
                            )}

                            {(gameStatus === 'crashed' || gameStatus === 'won') && (
                                <button
                                    onClick={resetGame}
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-12 py-6 rounded-lg text-2xl font-bold hover:from-purple-600 hover:to-pink-600 transform hover:scale-105 transition-all duration-200"
                                >
                                    🔄 Nouveau jeu
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Game Info */}
                {gameId && (
                    <div className="mt-8 bg-gray-800 rounded-lg p-4">
                        <h3 className="text-lg font-bold mb-2 text-center">Informations du jeu</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-400">ID du jeu:</span>
                                <span className="ml-2 font-mono">#{gameId}</span>
                            </div>
                            <div>
                                <span className="text-gray-400">Mise:</span>
                                <span className="ml-2 font-bold">1.0 ETH</span>
                            </div>
                            <div>
                                <span className="text-gray-400">Multiplicateur:</span>
                                <span className="ml-2 font-bold">{formatMultiplier(multiplier)}</span>
                            </div>
                            <div>
                                <span className="text-gray-400">Gain potentiel:</span>
                                <span className="ml-2 font-bold text-green-400">
                                    {(multiplier / 100).toFixed(2)} ETH
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="mt-8 bg-gray-800 rounded-lg p-6">
                    <h3 className="text-xl font-bold mb-4 text-center">🎯 Comment jouer</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="text-center">
                            <div className="text-3xl mb-2">1️⃣</div>
                            <h4 className="font-bold mb-2">Misez</h4>
                            <p className="text-gray-300">Cliquez sur "Jouer" pour miser 1 ETH</p>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl mb-2">2️⃣</div>
                            <h4 className="font-bold mb-2">Observez</h4>
                            <p className="text-gray-300">Le multiplicateur augmente progressivement</p>
                        </div>
                        <div className="text-center">
                            <div className="text-3xl mb-2">3️⃣</div>
                            <h4 className="font-bold mb-2">Retirez</h4>
                            <p className="text-gray-300">Cliquez "Retirer" avant le crash!</p>
                        </div>
                    </div>
                    <div className="mt-4 p-4 bg-yellow-900 rounded-lg border border-yellow-600">
                        <p className="text-yellow-200 text-center">
                            ⚠️ <strong>Attention:</strong> Le jeu peut crasher à tout moment! 
                            Plus vous attendez, plus vous risquez de tout perdre.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}