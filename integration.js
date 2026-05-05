/**
 * EduProtocol - Script de Integracao Web3 com ethers.js
 * Autor  : Alanio Ferreira de Lima
 * Curso  : Residencia em TIC 29 - Web 3.0
 * Rede   : Sepolia Testnet
 * GitHub : https://github.com/Allanio007/eduprotocol
 *
 * Este script demonstra:
 *   1. Mint de NFT (certificado de conclusao)
 *   2. Stake de tokens EDU
 *   3. Criacao e votacao em proposta da DAO
 *
 * Pre-requisitos:
 *   npm install
 *   Criar arquivo .env com PRIVATE_KEY e SEPOLIA_RPC_URL
 *   Ter os contratos deployados e endereco em deployed-addresses.json
 *
 * Execucao:
 *   node integration.js
 */

require("dotenv").config();
const { ethers } = require("ethers");
const fs         = require("fs");

// ---------------------------------------------------------------------------
// 1. CONFIGURACAO DA CONEXAO
// ---------------------------------------------------------------------------

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// ---------------------------------------------------------------------------
// 2. ENDERECOS DOS CONTRATOS (carregado do arquivo de deploy)
// ---------------------------------------------------------------------------

let ADDRESSES;
try {
  ADDRESSES = JSON.parse(fs.readFileSync("deployed-addresses.json", "utf8"));
} catch {
  // Enderecos deployados na Sepolia Testnet em 28/04/2025
  ADDRESSES = {
    EduToken:   "0x9AB05e712419258670D1082Fb38d441BD1738531",
    EduNFT:     "0xa65A79a95bA093e5eb46E5CfF84e7D9986AD3190",
    EduStaking: "0x49f7dC8cacC11065B74Be62BF039cdb5e225B6C9",
    EduDAO:     "0x5319fb3D02587d9b911fe83C70cCeC7DF88282eA",
  };
}

// ---------------------------------------------------------------------------
// 3. ABIs SIMPLIFICADOS
// ---------------------------------------------------------------------------

const EduTokenABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const EduNFTABI = [
  "function mintCertificate(address recipient, string uri) returns (uint256)",
  "function tokensOfOwner(address) view returns (uint256[])",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event CertificateMinted(address indexed recipient, uint256 indexed tokenId, string tokenURI)",
];

const EduStakingABI = [
  "function stake(uint256 amount) external",
  "function unstake() external",
  "function claimReward() external",
  "function pendingReward(address user) view returns (uint256)",
  "function stakes(address) view returns (uint256 amount, uint256 stakedAt, uint256 rewardDebt)",
  "event Staked(address indexed user, uint256 amount)",
  "event RewardClaimed(address indexed user, uint256 reward)",
];

const EduDAOABI = [
  "function criarProposta(string descricao, uint256 duracaoEmDias) returns (uint256)",
  "function votar(uint256 proposalId, bool favor) external",
  "function executarProposta(uint256 proposalId) external",
  "function getProposal(uint256) view returns (address, string, uint256, uint256, uint256, bool, bool)",
  "function totalProposals() view returns (uint256)",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string descricao, uint256 deadline)",
  "event VoteCast(uint256 indexed proposalId, address indexed voter, bool favor, uint256 votingPower)",
];

// ---------------------------------------------------------------------------
// 4. INSTANCIAS DOS CONTRATOS
// ---------------------------------------------------------------------------

const eduToken   = new ethers.Contract(ADDRESSES.EduToken,   EduTokenABI,   wallet);
const eduNFT     = new ethers.Contract(ADDRESSES.EduNFT,     EduNFTABI,     wallet);
const eduStaking = new ethers.Contract(ADDRESSES.EduStaking, EduStakingABI, wallet);
const eduDAO     = new ethers.Contract(ADDRESSES.EduDAO,     EduDAOABI,     wallet);

// ---------------------------------------------------------------------------
// 5. FUNCOES AUXILIARES
// ---------------------------------------------------------------------------

const fmt = (wei) => ethers.formatEther(wei) + " EDU";

async function waitAndLog(tx, label) {
  console.log(`  [...] ${label} - aguardando confirmacao...`);
  const receipt = await tx.wait();
  console.log(`  [OK]  ${label} | Gas: ${receipt.gasUsed} | Bloco: ${receipt.blockNumber}`);
  return receipt;
}

// ---------------------------------------------------------------------------
// 6. DEMONSTRACAO 1 - MINT DE NFT
// ---------------------------------------------------------------------------

async function demonstrarMintNFT() {
  console.log("\n" + "=".repeat(50));
  console.log("  DEMO 1 - Mint de NFT (Certificado de Conclusao)");
  console.log("=".repeat(50));

  const recipient = wallet.address;
  const tokenURI  = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

  console.log(`  Destinatario : ${recipient}`);
  console.log(`  Metadata URI : ${tokenURI}`);

  try {
    const tx      = await eduNFT.mintCertificate(recipient, tokenURI);
    const receipt = await waitAndLog(tx, "mintCertificate");

    const iface = new ethers.Interface(EduNFTABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "CertificateMinted") {
          console.log(`  Token ID mintado: #${parsed.args.tokenId}`);
        }
      } catch (_) {}
    }

    const tokens = await eduNFT.tokensOfOwner(recipient);
    console.log(`  NFTs do endereco: [${tokens.map((t) => t.toString()).join(", ")}]`);
  } catch (err) {
    console.error("  [ERRO] Mint:", err.reason || err.message);
  }
}

// ---------------------------------------------------------------------------
// 7. DEMONSTRACAO 2 - STAKE DE TOKENS
// ---------------------------------------------------------------------------

async function demonstrarStaking() {
  console.log("\n" + "=".repeat(50));
  console.log("  DEMO 2 - Stake de Tokens EDU");
  console.log("=".repeat(50));

  const stakeAmount = ethers.parseEther("500");

  try {
    const saldo = await eduToken.balanceOf(wallet.address);
    console.log(`  Saldo EDU atual: ${fmt(saldo)}`);

    if (saldo < stakeAmount) {
      console.log("  [AVISO] Saldo insuficiente para demo de stake.");
      return;
    }

    console.log("  1. Aprovando contrato de Staking...");
    const approveTx = await eduToken.approve(ADDRESSES.EduStaking, stakeAmount);
    await waitAndLog(approveTx, "approve");

    console.log(`  2. Stakando ${fmt(stakeAmount)}...`);
    const stakeTx = await eduStaking.stake(stakeAmount);
    await waitAndLog(stakeTx, "stake");

    const stakeInfo = await eduStaking.stakes(wallet.address);
    console.log(`  Stake ativo    : ${fmt(stakeInfo.amount)}`);
    console.log(`  Staked desde   : ${new Date(Number(stakeInfo.stakedAt) * 1000).toISOString()}`);

    const pending = await eduStaking.pendingReward(wallet.address);
    console.log(`  Recompensa pend: ${fmt(pending)}`);
  } catch (err) {
    console.error("  [ERRO] Staking:", err.reason || err.message);
  }
}

// ---------------------------------------------------------------------------
// 8. DEMONSTRACAO 3 - VOTACAO NA DAO
// ---------------------------------------------------------------------------

async function demonstrarDAO() {
  console.log("\n" + "=".repeat(50));
  console.log("  DEMO 3 - Criacao e Votacao na DAO");
  console.log("=".repeat(50));

  try {
    console.log("  1. Criando proposta de governanca...");
    const descricao    = "Adicionar novo curso: Desenvolvimento de Smart Contracts com Foundry";
    const duracaoDias  = 7;

    const criaTx      = await eduDAO.criarProposta(descricao, duracaoDias);
    const criaReceipt = await waitAndLog(criaTx, "criarProposta");

    const iface = new ethers.Interface(EduDAOABI);
    let proposalId;
    for (const log of criaReceipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "ProposalCreated") {
          proposalId = parsed.args.proposalId;
          console.log(`  Proposta #${proposalId} criada!`);
          console.log(`  Descricao: ${parsed.args.descricao}`);
          const deadline = new Date(Number(parsed.args.deadline) * 1000);
          console.log(`  Encerra em: ${deadline.toISOString()}`);
        }
      } catch (_) {}
    }

    if (!proposalId) proposalId = await eduDAO.totalProposals();

    console.log(`\n  2. Votando A FAVOR na proposta #${proposalId}...`);
    const votarTx      = await eduDAO.votar(proposalId, true);
    const votarReceipt = await waitAndLog(votarTx, "votar");

    for (const log of votarReceipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "VoteCast") {
          console.log(`  Voto registrado! Poder: ${fmt(parsed.args.votingPower)}`);
        }
      } catch (_) {}
    }

    const prop = await eduDAO.getProposal(proposalId);
    console.log(`\n  Estado da proposta #${proposalId}:`);
    console.log(`    Votos a favor : ${fmt(prop[2])}`);
    console.log(`    Votos contra  : ${fmt(prop[3])}`);
    console.log(`    Executada     : ${prop[5]}`);
  } catch (err) {
    console.error("  [ERRO] DAO:", err.reason || err.message);
  }
}

// ---------------------------------------------------------------------------
// 9. MAIN
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(50));
  console.log("  EduProtocol - Integracao Web3 (ethers.js v6)");
  console.log("  Rede: Sepolia Testnet");
  console.log("=".repeat(50));

  const network  = await provider.getNetwork();
  console.log(`\nRede    : ${network.name} (chainId: ${network.chainId})`);
  console.log(`Carteira: ${wallet.address}`);

  const saldoETH = await provider.getBalance(wallet.address);
  console.log(`Saldo ETH: ${ethers.formatEther(saldoETH)} ETH`);

  await demonstrarMintNFT();
  await demonstrarStaking();
  await demonstrarDAO();

  console.log("\n" + "=".repeat(50));
  console.log("  Demonstracao concluida com sucesso!");
  console.log("=".repeat(50) + "\n");
}

main().catch(console.error);
