/**
 * EduProtocol - Script de Deploy (Hardhat)
 * Autor  : Alanio Ferreira de Lima
 * Curso  : Residencia em TIC 29 - Web 3.0
 * Rede   : Sepolia Testnet
 * GitHub : https://github.com/Allanio007/eduprotocol
 *
 * Ordem de deploy:
 *  1. EduToken
 *  2. EduNFT
 *  3. EduStaking (recebe EduToken + Chainlink feed)
 *  4. EduDAO     (recebe EduToken)
 *  5. Configuracao: EduToken.setStakingContract(EduStaking)
 *
 * Uso:
 *   npx hardhat run scripts/deploy.js --network sepolia
 */

const { ethers } = require("hardhat");

// Endereco do Chainlink ETH/USD na Sepolia
const CHAINLINK_ETH_USD_SEPOLIA = "0x694AA1769357215DE4FAC081bf1f309aDC325306";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("  EduProtocol - Deploy em Sepolia Testnet");
  console.log("=".repeat(60));
  console.log(`Deployer  : ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Saldo ETH : ${ethers.formatEther(balance)} ETH`);
  console.log("");

  // -------------------------------------------------------------------------
  // 1. Deploy EduToken
  // -------------------------------------------------------------------------
  console.log("1/5 Deployando EduToken...");
  const EduToken = await ethers.getContractFactory("EduToken");
  const eduToken = await EduToken.deploy();
  await eduToken.waitForDeployment();
  const eduTokenAddr = await eduToken.getAddress();
  console.log(`   EduToken deployado: ${eduTokenAddr}`);

  // -------------------------------------------------------------------------
  // 2. Deploy EduNFT
  // -------------------------------------------------------------------------
  console.log("2/5 Deployando EduNFT...");
  const EduNFT = await ethers.getContractFactory("EduNFT");
  const eduNFT = await EduNFT.deploy();
  await eduNFT.waitForDeployment();
  const eduNFTAddr = await eduNFT.getAddress();
  console.log(`   EduNFT deployado  : ${eduNFTAddr}`);

  // -------------------------------------------------------------------------
  // 3. Deploy EduStaking
  // -------------------------------------------------------------------------
  console.log("3/5 Deployando EduStaking...");
  const EduStaking = await ethers.getContractFactory("EduStaking");
  const eduStaking = await EduStaking.deploy(eduTokenAddr, CHAINLINK_ETH_USD_SEPOLIA);
  await eduStaking.waitForDeployment();
  const eduStakingAddr = await eduStaking.getAddress();
  console.log(`   EduStaking deployado: ${eduStakingAddr}`);

  // -------------------------------------------------------------------------
  // 4. Deploy EduDAO
  // -------------------------------------------------------------------------
  console.log("4/5 Deployando EduDAO...");
  const EduDAO = await ethers.getContractFactory("EduDAO");
  const eduDAO = await EduDAO.deploy(eduTokenAddr);
  await eduDAO.waitForDeployment();
  const eduDAOAddr = await eduDAO.getAddress();
  console.log(`   EduDAO deployado  : ${eduDAOAddr}`);

  // -------------------------------------------------------------------------
  // 5. Configuracao: autoriza EduStaking a mintar recompensas
  // -------------------------------------------------------------------------
  console.log("5/5 Configurando autorizacao de mint...");
  const tx = await eduToken.setStakingContract(eduStakingAddr);
  await tx.wait();
  console.log(`   stakingContract configurado: ${eduStakingAddr}`);

  // -------------------------------------------------------------------------
  // Resumo final
  // -------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log("  DEPLOY CONCLUIDO - Enderecos dos Contratos");
  console.log("=".repeat(60));
  console.log(`EduToken   (EDU)    : ${eduTokenAddr}`);
  console.log(`EduNFT     (EDUCERT): ${eduNFTAddr}`);
  console.log(`EduStaking          : ${eduStakingAddr}`);
  console.log(`EduDAO              : ${eduDAOAddr}`);
  console.log("=".repeat(60));
  console.log("\nVerifique os contratos em:");
  console.log(`  https://sepolia.etherscan.io/address/${eduTokenAddr}`);
  console.log(`  https://sepolia.etherscan.io/address/${eduNFTAddr}`);
  console.log(`  https://sepolia.etherscan.io/address/${eduStakingAddr}`);
  console.log(`  https://sepolia.etherscan.io/address/${eduDAOAddr}`);

  // Salva enderecos para uso posterior
  const fs = require("fs");
  const addresses = {
    network: "sepolia",
    deployer: deployer.address,
    EduToken:   eduTokenAddr,
    EduNFT:     eduNFTAddr,
    EduStaking: eduStakingAddr,
    EduDAO:     eduDAOAddr,
    ChainlinkFeed: CHAINLINK_ETH_USD_SEPOLIA,
    deployedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(addresses, null, 2)
  );
  console.log("\nEnderecos salvos em: deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
