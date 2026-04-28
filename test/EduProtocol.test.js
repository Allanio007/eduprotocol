/**
 * EduProtocol - Testes Unitarios (Hardhat + Chai)
 * Autor  : Alanio Ferreira de Lima
 * Curso  : Residencia em TIC 29 - Web 3.0
 * GitHub : https://github.com/Allanio007/eduprotocol
 *
 * Cobertura:
 *  - EduToken  : deploy, transfer, approve, mintReward, burn
 *  - EduNFT    : deploy, mintCertificate, tokensOfOwner
 *  - EduStaking: stake, unstake, claimReward, reentrance protection
 *  - EduDAO    : criarProposta, votar, executarProposta
 *
 * Uso:
 *   npx hardhat test
 */

const { expect } = require("chai");
const { ethers }  = require("hardhat");

// Mock do Chainlink para testes locais (sem rede real)
const MockAggregatorABI = [
  "function setLatestAnswer(int256 answer) external",
  "function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80)",
];

describe("EduProtocol - Suite de Testes", function () {
  let owner, alice, bob;
  let eduToken, eduNFT, eduStaking, eduDAO;
  let mockFeed;

  // Preco ETH simulado: $2.500 (acima do threshold de bonus)
  const ETH_PRICE_ABOVE = 2500n * 10n ** 8n;
  const ETH_PRICE_BELOW = 1500n * 10n ** 8n;

  const parseEDU = (n) => ethers.parseEther(n.toString());

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    // Deploy Mock Chainlink
    const MockFeed = await ethers.getContractFactory("MockAggregatorV3");
    mockFeed = await MockFeed.deploy(ETH_PRICE_ABOVE);
    await mockFeed.waitForDeployment();

    // Deploy contratos
    const EduToken   = await ethers.getContractFactory("EduToken");
    const EduNFT     = await ethers.getContractFactory("EduNFT");
    const EduStaking = await ethers.getContractFactory("EduStaking");
    const EduDAO     = await ethers.getContractFactory("EduDAO");

    eduToken   = await EduToken.deploy();
    eduNFT     = await EduNFT.deploy();
    eduStaking = await EduStaking.deploy(
      await eduToken.getAddress(),
      await mockFeed.getAddress()
    );
    eduDAO = await EduDAO.deploy(await eduToken.getAddress());

    await eduToken.waitForDeployment();
    await eduNFT.waitForDeployment();
    await eduStaking.waitForDeployment();
    await eduDAO.waitForDeployment();

    // Autoriza staking a mintar recompensas
    await eduToken.setStakingContract(await eduStaking.getAddress());

    // Distribui tokens para testes
    await eduToken.transfer(alice.address, parseEDU(10_000));
    await eduToken.transfer(bob.address,   parseEDU(5_000));
  });

  // ===========================================================================
  // EduToken
  // ===========================================================================
  describe("EduToken", function () {
    it("deve ter supply inicial de 1.000.000 EDU", async function () {
      const supply = await eduToken.totalSupply();
      expect(supply).to.equal(parseEDU(1_000_000));
    });

    it("deve transferir tokens corretamente", async function () {
      const antes = await eduToken.balanceOf(bob.address);
      await eduToken.connect(alice).transfer(bob.address, parseEDU(100));
      const depois = await eduToken.balanceOf(bob.address);
      expect(depois - antes).to.equal(parseEDU(100));
    });

    it("deve aprovar e usar transferFrom", async function () {
      await eduToken.connect(alice).approve(bob.address, parseEDU(500));
      await eduToken.connect(bob).transferFrom(alice.address, bob.address, parseEDU(500));
      expect(await eduToken.balanceOf(bob.address)).to.equal(parseEDU(5_500));
    });

    it("deve rejeitar mint por endereco nao autorizado", async function () {
      await expect(
        eduToken.connect(alice).mintReward(alice.address, parseEDU(100))
      ).to.be.revertedWith("EduToken: not authorized to mint");
    });

    it("deve queimar tokens corretamente", async function () {
      const antes = await eduToken.balanceOf(alice.address);
      await eduToken.connect(alice).burn(parseEDU(100));
      const depois = await eduToken.balanceOf(alice.address);
      expect(antes - depois).to.equal(parseEDU(100));
    });
  });

  // ===========================================================================
  // EduNFT
  // ===========================================================================
  describe("EduNFT", function () {
    const URI = "ipfs://QmTestHash123/certificate.json";

    it("deve mintar certificado NFT", async function () {
      await expect(eduNFT.mintCertificate(alice.address, URI))
        .to.emit(eduNFT, "CertificateMinted")
        .withArgs(alice.address, 1n, URI);

      expect(await eduNFT.ownerOf(1)).to.equal(alice.address);
    });

    it("deve retornar tokenURI correto", async function () {
      await eduNFT.mintCertificate(alice.address, URI);
      expect(await eduNFT.tokenURI(1)).to.equal(URI);
    });

    it("deve listar todos os NFTs de um endereco", async function () {
      await eduNFT.mintCertificate(alice.address, URI);
      await eduNFT.mintCertificate(alice.address, URI + "2");
      const tokens = await eduNFT.tokensOfOwner(alice.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(1n);
      expect(tokens[1]).to.equal(2n);
    });

    it("deve rejeitar mint por nao-owner", async function () {
      await expect(
        eduNFT.connect(alice).mintCertificate(alice.address, URI)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("deve rejeitar URI vazia", async function () {
      await expect(
        eduNFT.mintCertificate(alice.address, "")
      ).to.be.revertedWith("EduNFT: empty URI");
    });
  });

  // ===========================================================================
  // EduStaking
  // ===========================================================================
  describe("EduStaking", function () {
    beforeEach(async function () {
      // Alice aprova o contrato de staking
      await eduToken.connect(alice).approve(
        await eduStaking.getAddress(),
        parseEDU(10_000)
      );
    });

    it("deve registrar stake corretamente", async function () {
      await expect(eduStaking.connect(alice).stake(parseEDU(1_000)))
        .to.emit(eduStaking, "Staked")
        .withArgs(alice.address, parseEDU(1_000));

      const info = await eduStaking.stakes(alice.address);
      expect(info.amount).to.equal(parseEDU(1_000));
    });

    it("deve rejeitar stake de zero", async function () {
      await expect(
        eduStaking.connect(alice).stake(0)
      ).to.be.revertedWith("EduStaking: amount must be > 0");
    });

    it("deve fazer unstake e emitir evento", async function () {
      await eduStaking.connect(alice).stake(parseEDU(1_000));
      await expect(eduStaking.connect(alice).unstake())
        .to.emit(eduStaking, "Unstaked")
        .withArgs(alice.address, parseEDU(1_000));

      const info = await eduStaking.stakes(alice.address);
      expect(info.amount).to.equal(0n);
    });

    it("deve rejeitar unstake sem stake", async function () {
      await expect(
        eduStaking.connect(bob).unstake()
      ).to.be.revertedWith("EduStaking: nothing staked");
    });

    it("deve rejeitar claim sem stake", async function () {
      await expect(
        eduStaking.connect(bob).claimReward()
      ).to.be.revertedWith("EduStaking: nothing staked");
    });
  });

  // ===========================================================================
  // EduDAO
  // ===========================================================================
  describe("EduDAO", function () {
    const DESC     = "Adicionar curso de Foundry";
    const DURACAO  = 7; // dias

    it("deve criar proposta com saldo suficiente", async function () {
      await expect(
        eduDAO.connect(alice).criarProposta(DESC, DURACAO)
      ).to.emit(eduDAO, "ProposalCreated");

      expect(await eduDAO.totalProposals()).to.equal(1n);
    });

    it("deve rejeitar proposta sem saldo minimo", async function () {
      const semSaldo = (await ethers.getSigners())[5];
      await expect(
        eduDAO.connect(semSaldo).criarProposta(DESC, DURACAO)
      ).to.be.revertedWith("EduDAO: EDU insuficiente para propor");
    });

    it("deve registrar voto a favor", async function () {
      await eduDAO.connect(alice).criarProposta(DESC, DURACAO);
      await expect(
        eduDAO.connect(alice).votar(1, true)
      ).to.emit(eduDAO, "VoteCast");

      const prop = await eduDAO.getProposal(1);
      expect(prop.votosFavor).to.be.gt(0n);
    });

    it("deve rejeitar duplo voto", async function () {
      await eduDAO.connect(alice).criarProposta(DESC, DURACAO);
      await eduDAO.connect(alice).votar(1, true);
      await expect(
        eduDAO.connect(alice).votar(1, true)
      ).to.be.revertedWith("EduDAO: ja votou nesta proposta");
    });

    it("deve rejeitar executar proposta dentro do prazo", async function () {
      await eduDAO.connect(alice).criarProposta(DESC, DURACAO);
      await expect(
        eduDAO.connect(alice).executarProposta(1)
      ).to.be.revertedWith("EduDAO: votacao ainda em andamento");
    });

    it("deve executar proposta apos prazo", async function () {
      await eduDAO.connect(alice).criarProposta(DESC, 1);
      await eduDAO.connect(alice).votar(1, true);
      await eduDAO.connect(bob).votar(1, true);

      // Avanca o tempo em 2 dias
      await ethers.provider.send("evm_increaseTime", [2 * 24 * 3600]);
      await ethers.provider.send("evm_mine");

      await expect(
        eduDAO.connect(alice).executarProposta(1)
      ).to.emit(eduDAO, "ProposalExecuted");
    });
  });
});
