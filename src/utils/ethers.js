import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x5b329bBe9b59b53eF2c06E1403178303b72280D8";

// ABI
const CONTRACT_ABI = [
    "function startGame() public payable returns (uint256)",
    "function withdrawFromGame(uint256 gameId) public returns (uint256)",
    "function checkGameStatus(uint256 gameId) public returns (bool)",
    "function getCurrentMultiplier(uint256 gameId) public view returns (uint256)",
    "function getGameInfo(uint256 gameId) public view returns (address, uint256, uint256, uint256, uint256, bool, bool, bool)",
    "function getPlayerCurrentGame(address player) public view returns (uint256)",
    "function getContractBalance() public view returns (uint256)",
    "event GameStarted(uint256 indexed gameId, address indexed player, uint256 betAmount)",
    "event GameWithdrawn(uint256 indexed gameId, address indexed player, uint256 multiplier, uint256 payout)",
    "event GameCrashed(uint256 indexed gameId, address indexed player, uint256 crashPoint)",
    "event FundsDeposited(address indexed player, uint256 amount)"
];

/**
 * Connecte MetaMask et récupère l'adresse de l'utilisateur
 */
export async function connectWallet() {
    console.log("[connectWallet] Vérification de MetaMask...");
    
    if (!window.ethereum) {
        throw new Error("MetaMask n'est pas installé !");
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        console.log("[connectWallet] Compte connecté :", accounts[0]);
        return accounts[0];
    } catch (error) {
        console.error("[connectWallet] Erreur de connexion :", error);
        throw error;
    }
}

/**
 * Récupère une instance du contrat
 */
export async function getContract() {
    console.log("[getContract] Récupération du contrat...");
    
    if (!window.ethereum) {
        throw new Error("MetaMask n'est pas installé !");
    }

    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        
        console.log("[getContract] Contrat récupéré :", contract);
        return contract;
    } catch (error) {
        console.error("[getContract] Erreur récupération contrat :", error);
        throw error;
    }
}

/**
 * Démarre un nouveau jeu en misant 1 ETH
 */
export async function startGame() {
    try {
        console.log("[startGame] Démarrage d'un nouveau jeu...");
        const contract = await getContract();
        
        // Mise de 1 ETH
        const betAmount = ethers.parseEther("1.0");
        
        const tx = await contract.startGame({
            value: betAmount
        });
        
        console.log("[startGame] Transaction envoyée :", tx.hash);
        const receipt = await tx.wait();
        console.log("[startGame] Transaction confirmée :", receipt);
        
        // Récupérer l'ID du jeu depuis les events
        const gameStartedEvent = receipt.logs.find(log => {
            try {
                const parsed = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                return parsed.name === "GameStarted";
            } catch {
                return false;
            }
        });
        
        if (gameStartedEvent) {
            const parsed = contract.interface.parseLog({
                topics: gameStartedEvent.topics,
                data: gameStartedEvent.data
            });
            const gameId = parsed.args.gameId;
            console.log("[startGame] Jeu créé avec l'ID :", gameId.toString());
            return Number(gameId);
        }
        
        throw new Error("Impossible de récupérer l'ID du jeu");
    } catch (error) {
        console.error("[startGame] Erreur :", error);
        throw error;
    }
}

/**
 * Retire les gains du jeu en cours
 */
export async function withdrawFromGame(gameId) {
    try {
        console.log(`[withdrawFromGame] Retrait du jeu ${gameId}...`);
        const contract = await getContract();
        
        const tx = await contract.withdrawFromGame(gameId);
        console.log("[withdrawFromGame] Transaction envoyée :", tx.hash);
        
        const receipt = await tx.wait();
        console.log("[withdrawFromGame] Transaction confirmée :", receipt);
        
        // Récupérer les détails du retrait depuis les events
        const withdrawEvent = receipt.logs.find(log => {
            try {
                const parsed = contract.interface.parseLog({
                    topics: log.topics,
                    data: log.data
                });
                return parsed.name === "GameWithdrawn";
            } catch {
                return false;
            }
        });
        
        if (withdrawEvent) {
            const parsed = contract.interface.parseLog({
                topics: withdrawEvent.topics,
                data: withdrawEvent.data
            });
            return {
                multiplier: Number(parsed.args.multiplier),
                payout: ethers.formatEther(parsed.args.payout)
            };
        }
        
        return null;
    } catch (error) {
        console.error("[withdrawFromGame] Erreur :", error);
        throw error;
    }
}

/**
 * Vérifie le statut du jeu (si il a crashé)
 */
export async function checkGameStatus(gameId) {
    try {
        const contract = await getContract();
        const isActive = await contract.checkGameStatus(gameId);
        return isActive;
    } catch (error) {
        console.error("[checkGameStatus] Erreur :", error);
        throw error;
    }
}

/**
 * Récupère le multiplicateur actuel du jeu
 */
export async function getCurrentMultiplier(gameId) {
    try {
        const contract = await getContract();
        const multiplier = await contract.getCurrentMultiplier(gameId);
        return Number(multiplier);
    } catch (error) {
        console.error("[getCurrentMultiplier] Erreur :", error);
        throw error;
    }
}

/**
 * Récupère les informations complètes d'un jeu
 */
export async function getGameInfo(gameId) {
    try {
        const contract = await getContract();
        const info = await contract.getGameInfo(gameId);
        
        return {
            player: info[0],
            betAmount: ethers.formatEther(info[1]),
            multiplier: Number(info[2]),
            startTime: Number(info[3]),
            crashPoint: Number(info[4]),
            isActive: info[5],
            hasWithdrawn: info[6],
            hasCrashed: info[7]
        };
    } catch (error) {
        console.error("[getGameInfo] Erreur :", error);
        throw error;
    }
}

/**
 * Récupère l'ID du jeu actuel du joueur
 */
export async function getPlayerCurrentGame(playerAddress) {
    try {
        const contract = await getContract();
        const gameId = await contract.getPlayerCurrentGame(playerAddress);
        return Number(gameId);
    } catch (error) {
        console.error("[getPlayerCurrentGame] Erreur :", error);
        throw error;
    }
}

/**
 * Récupère le solde du wallet connecté
 */
export async function getWalletBalance() {
    try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        const balance = await provider.getBalance(address);
        
        return {
            address,
            balance: ethers.formatEther(balance)
        };
    } catch (error) {
        console.error("[getWalletBalance] Erreur :", error);
        throw error;
    }
}

/**
 * Récupère le solde du contrat
 */
export async function getContractBalance() {
    try {
        const contract = await getContract();
        const balance = await contract.getContractBalance();
        return ethers.formatEther(balance);
    } catch (error) {
        console.error("[getContractBalance] Erreur :", error);
        throw error;
    }
}

/**
 * Écoute les événements du contrat
 */
export function setupEventListeners(callbacks) {
    return new Promise(async (resolve, reject) => {
        try {
            const contract = await getContract();
            
            // Écouter les événements GameStarted
            if (callbacks.onGameStarted) {
                contract.on("GameStarted", (gameId, player, betAmount, event) => {
                    callbacks.onGameStarted({
                        gameId: Number(gameId),
                        player,
                        betAmount: ethers.formatEther(betAmount),
                        event
                    });
                });
            }
            
            // Écouter les événements GameWithdrawn
            if (callbacks.onGameWithdrawn) {
                contract.on("GameWithdrawn", (gameId, player, multiplier, payout, event) => {
                    callbacks.onGameWithdrawn({
                        gameId: Number(gameId),
                        player,
                        multiplier: Number(multiplier),
                        payout: ethers.formatEther(payout),
                        event
                    });
                });
            }
            
            // Écouter les événements GameCrashed
            if (callbacks.onGameCrashed) {
                contract.on("GameCrashed", (gameId, player, crashPoint, event) => {
                    callbacks.onGameCrashed({
                        gameId: Number(gameId),
                        player,
                        crashPoint: Number(crashPoint),
                        event
                    });
                });
            }
            
            resolve(contract);
        } catch (error) {
            reject(error);
        }
    });
}
