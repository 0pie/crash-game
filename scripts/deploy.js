const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Déploiement du contrat CrashGame...");

    // Récupérer le signataire (compte qui déploie)
    const [deployer] = await ethers.getSigners();
    console.log("📝 Déploiement avec le compte :", deployer.address);

    // Vérifier le solde du déployeur
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Solde du compte :", ethers.formatEther(balance), "ETH");

    // Déployer le contrat
    const CrashGame = await ethers.getContractFactory("CrashGame");
    const crashGame = await CrashGame.deploy();

    await crashGame.waitForDeployment();

    const contractAddress = await crashGame.getAddress();
    console.log("✅ Contrat CrashGame déployé à l'adresse :", contractAddress);

    // Vérifier le déploiement
    console.log("🔍 Vérification du déploiement...");
    const contractBalance = await crashGame.getContractBalance();
    const owner = await crashGame.owner();
    
    console.log("💳 Solde du contrat :", ethers.formatEther(contractBalance), "ETH");
    console.log("👑 Propriétaire du contrat :", owner);

    console.log("\n📋 Informations importantes :");
    console.log("- Adresse du contrat :", contractAddress);
    console.log("- Propriétaire :", owner);
    console.log("- Réseau :", (await deployer.provider.getNetwork()).name);

    console.log("\n🔧 Configuration requise :");
    console.log("1. Copiez l'adresse du contrat dans src/utils/ethers.js");
    console.log("2. Remplacez CONTRACT_ADDRESS par :", contractAddress);
    console.log("3. Assurez-vous que MetaMask est connecté au bon réseau");

    return contractAddress;
}

// Gestion des erreurs
main()
    .then((address) => {
        console.log("\n🎉 Déploiement terminé avec succès !");
        console.log("Adresse du contrat :", address);
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Erreur lors du déploiement :", error);
        process.exit(1);
    });