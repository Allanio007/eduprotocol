# EduProtocol

**Protocolo Descentralizado de Educacao Web3**

> Residencia em TIC 29 — Web 3.0 | Unidade 1, Capitulo 5  
> Aluno: Alanio Ferreira de Lima | Prof.: Bruno Portes  
> Rede: Sepolia Testnet (Ethereum)

---

## Problema Resolvido

Plataformas educacionais centralizadas (Coursera, Udemy) detêm controle unilateral sobre certificados — podendo revogá-los ou encerrarem operações sem aviso. O **EduProtocol** resolve isso com quatro pilares:

| Pilar | Solucao |
|-------|---------|
| Imutabilidade | Certificados como NFTs na blockchain |
| Incentivo | Tokens EDU por engajamento e staking |
| Governanca | Detentores de EDU votam em propostas |
| Transparencia | Todas as transacoes verificaveis on-chain |

---

## Arquitetura

```
+---------------+     +------------+     +--------------+     +-----------+
|  EduToken     |<----|  EduNFT    |     | EduStaking   |---->| Chainlink |
|  ERC-20 (EDU) |     | ERC-721    |     | Recompensas  |     | ETH/USD   |
+---------------+     +------------+     +--------------+     +-----------+
        ^                                       |
        |                               mintReward()
+---------------+
|   EduDAO      |<--- poder de voto = saldo EDU
|  Governanca   |
+---------------+
```

**Fluxo principal:**
1. Aluno conclui curso → plataforma emite NFT (`EduNFT.mintCertificate`)
2. Aluno recebe tokens EDU como recompensa
3. Aluno faz stake dos EDU → acumula recompensas dinâmicas
4. Recompensa ajustada pelo preco ETH/USD via Chainlink
5. Aluno vota em propostas da comunidade (`EduDAO.votar`)

---

## Contratos Deployados — Sepolia Testnet

| Contrato | Endereco | Explorer |
|----------|----------|---------|
| EduToken (EDU) | `0x9AB05e712419258670D1082Fb38d441BD1738531` | [Ver no Etherscan](https://sepolia.etherscan.io/address/0x9AB05e712419258670D1082Fb38d441BD1738531) |
| EduNFT (EDUCERT) | `0xa65A79a95bA093e5eb46E5CfF84e7D9986AD3190` | [Ver no Etherscan](https://sepolia.etherscan.io/address/0xa65A79a95bA093e5eb46E5CfF84e7D9986AD3190) |
| EduStaking | `0x49f7dC8cacC11065B74Be62BF039cdb5e225B6C9` | [Ver no Etherscan](https://sepolia.etherscan.io/address/0x49f7dC8cacC11065B74Be62BF039cdb5e225B6C9) |
| EduDAO | `0x5319fb3D02587d9b911fe83C70cCeC7DF88282eA` | [Ver no Etherscan](https://sepolia.etherscan.io/address/0x5319fb3D02587d9b911fe83C70cCeC7DF88282eA) |
| Chainlink ETH/USD (Sepolia) | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | [Ver no Etherscan](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306) |

> Deploy realizado em 28/04/2025 na Sepolia Testnet.

---

## Padroes ERC Utilizados

| Contrato | Padrao | Justificativa |
|----------|--------|---------------|
| EduToken | ERC-20 | Tokens fungíveis — cada unidade identica. Suporte nativo em DEXs e wallets. |
| EduNFT | ERC-721 | Certificados unicos e individuais. ERC-721 garante unicidade on-chain. |
| EduStaking | Personalizado | Sem padrao ERC formal. Implementa CEI + ReentrancyGuard. |
| EduDAO | Personalizado (EIP-1202) | Governanca simplificada para MVP. |

---

## Seguranca

- **Protecao Reentrancy** — `nonReentrant` em todas as funcoes de transferencia
- **Controle de Acesso** — `onlyOwner` em funcoes administrativas
- **Padrao CEI** — estado zerado antes de transferencias externas
- **Solidity ^0.8.20** — overflow/underflow nativamente protegido
- **Chainlink Anti-Staleness** — validacao tripla do preco (roundId, updatedAt, answer > 0)

---

## Integracao com Oraculo Chainlink

O `EduStaking` consulta o feed **ETH/USD** na Sepolia:

- Endereco: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- Decimais: 8
- Se ETH > $2.000 → multiplicador **150%** (mercado altista)
- Se ETH ≤ $2.000 → multiplicador **100%** (taxa base)

**Exemplo:**
```
Alice: 10.000 EDU em stake por 30 dias
  ETH = $1.500 → reward = 300 EDU
  ETH = $2.500 → reward = 450 EDU  (+50% via Chainlink)
```

---

## Estrutura do Repositorio

```
eduprotocol/
├── contracts/
│   ├── EduProtocol.sol        # Todos os 4 contratos em um arquivo
│   └── MockAggregatorV3.sol   # Mock Chainlink para testes
├── scripts/
│   └── deploy.js              # Script de deploy (Hardhat)
├── test/
│   └── EduProtocol.test.js    # Testes unitarios (Hardhat + Chai)
├── integration.js             # Script Web3 com ethers.js v6
├── hardhat.config.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Como Executar

### Requisitos
- Node.js >= 18
- npm >= 9

### Instalacao
```bash
git clone https://github.com/SEU_USUARIO/eduprotocol.git
cd eduprotocol
npm install
```

### Configuracao
```bash
cp .env.example .env
# Edite .env com sua PRIVATE_KEY e SEPOLIA_RPC_URL
```

### Compilar
```bash
npm run compile
```

### Testes
```bash
npm test
```

### Deploy na Sepolia
```bash
npm run deploy
```

### Integracao Web3
```bash
# Apos o deploy, execute:
npm run integrate
```

### Verificar contrato no Etherscan
```bash
npx hardhat verify --network sepolia ENDERECO_DO_CONTRATO
```

---

## Configuracoes de Compilacao

```
Compiler  : v0.8.20+commit.a1b79de6
Optimizer : Enabled (200 runs)
License   : MIT
EVM       : paris
```

---

## Auditoria de Seguranca

| Ferramenta | Resultado |
|------------|-----------|
| Slither | Nenhuma vulnerabilidade critica. Achados informativos tratados. |
| Mythril | Nenhum critico. Overflow protegido nativamente pelo Solidity 0.8.x. |
| Hardhat | Todos os testes unitarios passaram. |

**Resultado**: Nenhuma vulnerabilidade critica ou alta encontrada. Apto para testnet.  
Para mainnet: auditoria profissional recomendada (Certik, Trail of Bits).

---

## Proximos Passos (Producao)

- [ ] Migrar `EduDAO` para `Governor` do OpenZeppelin com timelock
- [ ] Implementar Proxy UUPS para upgradeabilidade
- [ ] Frontend React com `wagmi` + `rainbowkit`
- [ ] Armazenamento IPFS com Pinata/NFT.Storage
- [ ] Auditoria profissional antes do deploy em mainnet

---

## Licenca

MIT — veja o cabecalho de cada arquivo `.sol`.

---

> Trabalho desenvolvido para a **Residencia em TIC 29 — Web 3.0**  
> Professor: Bruno Portes | Abril de 2025
