// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract CrashGame {
    struct Game {
        uint256 gameId;
        address player;
        uint256 betAmount;
        uint256 multiplier;
        uint256 startTime;
        uint256 crashPoint;
        bool isActive;
        bool hasWithdrawn;
        bool hasCrashed;
    }

    mapping(uint256 => Game) public games;
    mapping(address => uint256) public playerCurrentGame;
    uint256 public gameCounter;
    uint256 public constant BET_AMOUNT = 1 ether;
    uint256 public constant GAME_DURATION = 30 seconds; // Durée max d'un jeu
    
    event GameStarted(uint256 indexed gameId, address indexed player, uint256 betAmount);
    event GameWithdrawn(uint256 indexed gameId, address indexed player, uint256 multiplier, uint256 payout);
    event GameCrashed(uint256 indexed gameId, address indexed player, uint256 crashPoint);
    event FundsDeposited(address indexed player, uint256 amount);

    modifier onlyActiveGame(uint256 gameId) {
        require(games[gameId].isActive, "Game is not active");
        require(!games[gameId].hasCrashed, "Game has already crashed");
        require(!games[gameId].hasWithdrawn, "Already withdrawn");
        _;
    }

    modifier onlyPlayer(uint256 gameId) {
        require(games[gameId].player == msg.sender, "Not your game");
        _;
    }

    function startGame() public payable returns (uint256) {
        require(msg.value == BET_AMOUNT, "Must bet exactly 1 ETH");
        require(playerCurrentGame[msg.sender] == 0, "Player already has an active game");

        gameCounter++;
        uint256 gameId = gameCounter;

        // Génération d'un point de crash aléatoire (entre 1.0 et 10.0)
        uint256 crashPoint = generateCrashPoint();

        games[gameId] = Game({
            gameId: gameId,
            player: msg.sender,
            betAmount: msg.value,
            multiplier: 100, // Commence à 1.0 (représenté en centièmes)
            startTime: block.timestamp,
            crashPoint: crashPoint,
            isActive: true,
            hasWithdrawn: false,
            hasCrashed: false
        });

        playerCurrentGame[msg.sender] = gameId;

        emit GameStarted(gameId, msg.sender, msg.value);
        emit FundsDeposited(msg.sender, msg.value);
        
        return gameId;
    }

    function withdrawFromGame(uint256 gameId) 
        public 
        onlyActiveGame(gameId) 
        onlyPlayer(gameId) 
        returns (uint256) 
    {
        Game storage game = games[gameId];
        
        uint256 currentMultiplier = getCurrentMultiplier(gameId);
        
        // Vérifier si le jeu n'a pas encore crashé
        require(currentMultiplier < game.crashPoint, "Game has crashed, cannot withdraw");
        
        game.hasWithdrawn = true;
        game.isActive = false;
        game.multiplier = currentMultiplier;
        
        // Calculer le payout
        uint256 payout = (game.betAmount * currentMultiplier) / 100;
        
        // Nettoyer le jeu actif du joueur
        playerCurrentGame[msg.sender] = 0;
        
        // Transférer les gains
        payable(msg.sender).transfer(payout);
        
        emit GameWithdrawn(gameId, msg.sender, currentMultiplier, payout);
        
        return payout;
    }

    function checkGameStatus(uint256 gameId) public returns (bool) {
        Game storage game = games[gameId];
        
        if (!game.isActive || game.hasWithdrawn) {
            return false;
        }
        
        uint256 currentMultiplier = getCurrentMultiplier(gameId);
        
        // Vérifier si le jeu a crashé
        if (currentMultiplier >= game.crashPoint) {
            game.hasCrashed = true;
            game.isActive = false;
            playerCurrentGame[game.player] = 0;
            
            emit GameCrashed(gameId, game.player, game.crashPoint);
            return false;
        }
        
        // Vérifier si le temps maximum est écoulé
        if (block.timestamp >= game.startTime + GAME_DURATION) {
            game.hasCrashed = true;
            game.isActive = false;
            playerCurrentGame[game.player] = 0;
            
            emit GameCrashed(gameId, game.player, currentMultiplier);
            return false;
        }
        
        return true;
    }

    function getCurrentMultiplier(uint256 gameId) public view returns (uint256) {
        Game memory game = games[gameId];
        
        if (!game.isActive || game.hasWithdrawn || game.hasCrashed) {
            return game.multiplier;
        }
        
        uint256 timeElapsed = block.timestamp - game.startTime;
        
        // Augmente de 0.1 (10 en centièmes) toutes les 0.5 secondes
        // Mais pour la blockchain, on utilisera des intervalles plus larges
        uint256 intervals = timeElapsed / 1 seconds; // Chaque seconde
        uint256 multiplier = 100 + (intervals * 10); // Commence à 1.0, +0.1 par seconde
        
        return multiplier;
    }

    function generateCrashPoint() private view returns (uint256) {
        // Génération pseudo-aléatoire basée sur le hash du bloc et timestamp
        uint256 random = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.difficulty,
            msg.sender,
            gameCounter
        ))) % 1000;
        
        // Point de crash entre 1.0 (100) et 10.0 (1000)
        // Distribution favorisant les valeurs plus basses
        uint256 crashPoint;
        if (random < 500) {
            // 50% de chance d'avoir entre 1.0 et 2.0
            crashPoint = 100 + (random % 100);
        } else if (random < 800) {
            // 30% de chance d'avoir entre 2.0 et 5.0
            crashPoint = 200 + (random % 300);
        } else {
            // 20% de chance d'avoir entre 5.0 et 10.0
            crashPoint = 500 + (random % 500);
        }
        
        return crashPoint;
    }

    function getGameInfo(uint256 gameId) public view returns (
        address player,
        uint256 betAmount,
        uint256 multiplier,
        uint256 startTime,
        uint256 crashPoint,
        bool isActive,
        bool hasWithdrawn,
        bool hasCrashed
    ) {
        Game memory game = games[gameId];
        return (
            game.player,
            game.betAmount,
            game.multiplier,
            game.startTime,
            game.crashPoint,
            game.isActive,
            game.hasWithdrawn,
            game.hasCrashed
        );
    }

    function getPlayerCurrentGame(address player) public view returns (uint256) {
        return playerCurrentGame[player];
    }

    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Fonction pour retirer les fonds du contrat (uniquement pour le propriétaire)
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    function withdrawContractFunds() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}