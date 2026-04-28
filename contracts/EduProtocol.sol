// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =============================================================================
//  EduProtocol - Protocolo Descentralizado de Educacao Web3
//  Autor   : Alanio Ferreira de Lima
//  Curso   : Residencia em TIC 29 - Web 3.0
//  Prof.   : Bruno Portes
//  Rede    : Sepolia Testnet
//  GitHub  : https://github.com/Allanio007/eduprotocol
//  Versao  : 1.0.0
//
//  Arquitetura do protocolo:
//  +--------------+     +-----------+     +-------------+     +-----------+
//  |  EduToken    |<----|  EduNFT   |     | EduStaking  |---->| Chainlink |
//  |  (ERC-20)    |     | (ERC-721) |     | (Recompensa)|     | ETH/USD   |
//  +--------------+     +-----------+     +-------------+     +-----------+
//         ^                                     |
//         |                                     |
//  +--------------+                      token.mint()
//  |   EduDAO     |<--- voting power = saldo EDU
//  |  (Governanca)|
//  +--------------+
// =============================================================================

// ---------------------------------------------------------------------------
// INTERFACES EXTERNAS
// ---------------------------------------------------------------------------

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

// ---------------------------------------------------------------------------
// CONTRATOS BASE
// ---------------------------------------------------------------------------

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }
}

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        _owner = _msgSender();
        emit OwnershipTransferred(address(0), _owner);
    }

    modifier onlyOwner() {
        require(_msgSender() == _owner, "Ownable: caller is not the owner");
        _;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

abstract contract ReentrancyGuard {
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
}

// ---------------------------------------------------------------------------
// 1. TOKEN ERC-20 - EduToken (EDU)
// ---------------------------------------------------------------------------

contract EduToken is Ownable {
    string public constant name     = "EduToken";
    string public constant symbol   = "EDU";
    uint8  public constant decimals = 18;

    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    address public stakingContract;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner_, address indexed spender, uint256 value);
    event StakingContractSet(address indexed stakingContract);

    constructor() {
        uint256 initialSupply = 1_000_000 * 10 ** decimals;
        _mint(_msgSender(), initialSupply);
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        _transfer(_msgSender(), to, amount);
        return true;
    }

    function allowance(address owner_, address spender) public view returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        uint256 currentAllowance = _allowances[from][_msgSender()];
        require(currentAllowance >= amount, "ERC20: transfer amount exceeds allowance");
        _transfer(from, to, amount);
        unchecked {
            _approve(from, _msgSender(), currentAllowance - amount);
        }
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to   != address(0), "ERC20: transfer to zero address");
        require(_balances[from] >= amount, "ERC20: insufficient balance");
        unchecked {
            _balances[from] -= amount;
            _balances[to]   += amount;
        }
        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "ERC20: mint to zero address");
        _totalSupply       += amount;
        _balances[account] += amount;
        emit Transfer(address(0), account, amount);
    }

    function _approve(address owner_, address spender, uint256 amount) internal {
        require(owner_  != address(0), "ERC20: approve from zero address");
        require(spender != address(0), "ERC20: approve to zero address");
        _allowances[owner_][spender] = amount;
        emit Approval(owner_, spender, amount);
    }

    function setStakingContract(address _stakingContract) external onlyOwner {
        require(_stakingContract != address(0), "EduToken: zero address");
        stakingContract = _stakingContract;
        emit StakingContractSet(_stakingContract);
    }

    function mintReward(address to, uint256 amount) external {
        require(
            _msgSender() == stakingContract || _msgSender() == owner(),
            "EduToken: not authorized to mint"
        );
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        require(_balances[_msgSender()] >= amount, "ERC20: burn exceeds balance");
        _balances[_msgSender()] -= amount;
        _totalSupply -= amount;
        emit Transfer(_msgSender(), address(0), amount);
    }
}

// ---------------------------------------------------------------------------
// 2. NFT ERC-721 - EduNFT (Certificado)
// ---------------------------------------------------------------------------

contract EduNFT is Ownable {
    string public constant name   = "EduCertificate";
    string public constant symbol = "EDUCERT";

    uint256 private _tokenIdCounter;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balancesNFT;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(uint256 => string)  private _tokenURIs;
    mapping(address => uint256[]) private _ownedTokens;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner_, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner_, address indexed operator, bool approved);
    event CertificateMinted(address indexed recipient, uint256 indexed tokenId, string tokenURI);

    function balanceOf(address owner_) public view returns (uint256) {
        require(owner_ != address(0), "ERC721: zero address");
        return _balancesNFT[owner_];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner_ = _owners[tokenId];
        require(owner_ != address(0), "ERC721: token does not exist");
        return owner_;
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "ERC721: token does not exist");
        return _tokenURIs[tokenId];
    }

    function approve(address to, uint256 tokenId) public {
        address owner_ = ownerOf(tokenId);
        require(to != owner_, "ERC721: approval to current owner");
        require(
            _msgSender() == owner_ || isApprovedForAll(owner_, _msgSender()),
            "ERC721: not owner nor approved"
        );
        _tokenApprovals[tokenId] = to;
        emit Approval(owner_, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "ERC721: token does not exist");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        require(operator != _msgSender(), "ERC721: approve to caller");
        _operatorApprovals[_msgSender()][operator] = approved;
        emit ApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address owner_, address operator) public view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(_msgSender(), tokenId), "ERC721: not approved");
        _transfer(from, to, tokenId);
    }

    function mintCertificate(address recipient, string memory uri)
        external
        onlyOwner
        returns (uint256)
    {
        require(recipient != address(0), "EduNFT: zero address recipient");
        require(bytes(uri).length > 0,   "EduNFT: empty URI");

        uint256 tokenId = ++_tokenIdCounter;
        _mint(recipient, tokenId);
        _tokenURIs[tokenId] = uri;
        _ownedTokens[recipient].push(tokenId);

        emit CertificateMinted(recipient, tokenId, uri);
        return tokenId;
    }

    function tokensOfOwner(address owner_) external view returns (uint256[] memory) {
        return _ownedTokens[owner_];
    }

    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function _mint(address to, uint256 tokenId) internal {
        _owners[tokenId]  = to;
        _balancesNFT[to] += 1;
        emit Transfer(address(0), to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "ERC721: not owner");
        require(to != address(0),         "ERC721: transfer to zero address");
        delete _tokenApprovals[tokenId];
        _balancesNFT[from] -= 1;
        _balancesNFT[to]   += 1;
        _owners[tokenId]    = to;
        emit Transfer(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner_ = ownerOf(tokenId);
        return (
            spender == owner_ ||
            getApproved(tokenId) == spender ||
            isApprovedForAll(owner_, spender)
        );
    }
}

// ---------------------------------------------------------------------------
// 3. CONTRATO DE STAKING - EduStaking
// ---------------------------------------------------------------------------

contract EduStaking is Ownable, ReentrancyGuard {

    EduToken public immutable eduToken;
    AggregatorV3Interface public immutable priceFeed;

    uint256 public constant REWARD_RATE_PER_DAY   = 10;
    uint256 public constant RATE_BASE             = 1000;
    uint256 public constant SECONDS_PER_DAY       = 86400;
    int256  public constant BONUS_PRICE_THRESHOLD = 2000 * 10**8;
    uint256 public constant BONUS_MULTIPLIER      = 150;

    struct StakeInfo {
        uint256 amount;
        uint256 stakedAt;
        uint256 rewardDebt;
    }

    mapping(address => StakeInfo) public stakes;
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event PriceFeedQueried(int256 ethUsdPrice, uint256 multiplier);

    constructor(address _eduToken, address _priceFeed) {
        require(_eduToken  != address(0), "EduStaking: invalid token address");
        require(_priceFeed != address(0), "EduStaking: invalid price feed");
        eduToken  = EduToken(_eduToken);
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "EduStaking: amount must be > 0");
        require(
            eduToken.balanceOf(_msgSender()) >= amount,
            "EduStaking: insufficient EDU balance"
        );

        if (stakes[_msgSender()].amount > 0) {
            uint256 pendente = _calculateReward(_msgSender());
            stakes[_msgSender()].rewardDebt += pendente;
        }

        stakes[_msgSender()].amount  += amount;
        stakes[_msgSender()].stakedAt = block.timestamp;
        totalStaked += amount;

        bool success = eduToken.transferFrom(_msgSender(), address(this), amount);
        require(success, "EduStaking: transfer failed");

        emit Staked(_msgSender(), amount);
    }

    function unstake() external nonReentrant {
        StakeInfo storage info = stakes[_msgSender()];
        require(info.amount > 0, "EduStaking: nothing staked");

        uint256 amount = info.amount;
        uint256 reward = _calculateReward(_msgSender()) + info.rewardDebt;

        totalStaked -= amount;
        delete stakes[_msgSender()];

        require(
            eduToken.transfer(_msgSender(), amount),
            "EduStaking: unstake transfer failed"
        );

        if (reward > 0) {
            eduToken.mintReward(_msgSender(), reward);
            emit RewardClaimed(_msgSender(), reward);
        }

        emit Unstaked(_msgSender(), amount);
    }

    function claimReward() external nonReentrant {
        StakeInfo storage info = stakes[_msgSender()];
        require(info.amount > 0, "EduStaking: nothing staked");

        uint256 reward = _calculateReward(_msgSender()) + info.rewardDebt;
        require(reward > 0, "EduStaking: no reward available");

        info.rewardDebt = 0;
        info.stakedAt   = block.timestamp;

        eduToken.mintReward(_msgSender(), reward);
        emit RewardClaimed(_msgSender(), reward);
    }

    function pendingReward(address user) external view returns (uint256) {
        return _calculateReward(user) + stakes[user].rewardDebt;
    }

    function getCurrentMultiplier() external returns (uint256 multiplier) {
        (int256 price, uint256 mult) = _getEthPrice();
        emit PriceFeedQueried(price, mult);
        return mult;
    }

    function _calculateReward(address user) internal view returns (uint256) {
        StakeInfo storage info = stakes[user];
        if (info.amount == 0 || info.stakedAt == 0) return 0;

        uint256 elapsed    = block.timestamp - info.stakedAt;
        uint256 daysPassed = elapsed / SECONDS_PER_DAY;
        if (daysPassed == 0) return 0;

        (, uint256 multiplier) = _getEthPrice();

        return (info.amount * daysPassed * REWARD_RATE_PER_DAY * multiplier)
               / (RATE_BASE * 100);
    }

    function _getEthPrice() internal view returns (int256 price, uint256 multiplier) {
        (
            uint80 roundId,
            int256 answer,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        require(answeredInRound >= roundId,           "EduStaking: stale price data");
        require(updatedAt >= block.timestamp - 3600,  "EduStaking: price feed too old");
        require(answer > 0,                           "EduStaking: invalid price");

        price      = answer;
        multiplier = (answer >= BONUS_PRICE_THRESHOLD) ? BONUS_MULTIPLIER : 100;
    }
}

// ---------------------------------------------------------------------------
// 4. GOVERNANCA - EduDAO
// ---------------------------------------------------------------------------

contract EduDAO is Ownable {

    EduToken public immutable govToken;

    uint256 public constant PROPOSAL_THRESHOLD = 100  * 10**18;
    uint256 public constant QUORUM             = 1_000 * 10**18;

    struct Proposal {
        uint256 id;
        address proposer;
        string  descricao;
        uint256 votosFavor;
        uint256 votosContra;
        uint256 deadline;
        bool    executada;
        bool    aprovada;
    }

    uint256 private _proposalCounter;

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string descricao,
        uint256 deadline
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool favor,
        uint256 votingPower
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        bool aprovada,
        uint256 votosFavor,
        uint256 votosContra
    );

    constructor(address _govToken) {
        require(_govToken != address(0), "EduDAO: invalid token address");
        govToken = EduToken(_govToken);
    }

    function criarProposta(string memory descricao, uint256 duracaoEmDias)
        external
        returns (uint256)
    {
        require(bytes(descricao).length > 0,                "EduDAO: descricao vazia");
        require(duracaoEmDias >= 1 && duracaoEmDias <= 30,  "EduDAO: duracao invalida");
        require(
            govToken.balanceOf(_msgSender()) >= PROPOSAL_THRESHOLD,
            "EduDAO: EDU insuficiente para propor"
        );

        uint256 proposalId = ++_proposalCounter;
        uint256 deadline   = block.timestamp + (duracaoEmDias * 1 days);

        proposals[proposalId] = Proposal({
            id:          proposalId,
            proposer:    _msgSender(),
            descricao:   descricao,
            votosFavor:  0,
            votosContra: 0,
            deadline:    deadline,
            executada:   false,
            aprovada:    false
        });

        emit ProposalCreated(proposalId, _msgSender(), descricao, deadline);
        return proposalId;
    }

    function votar(uint256 proposalId, bool favor) external {
        Proposal storage prop = proposals[proposalId];

        require(prop.id != 0,                        "EduDAO: proposta nao existe");
        require(block.timestamp < prop.deadline,     "EduDAO: votacao encerrada");
        require(!prop.executada,                     "EduDAO: proposta ja executada");
        require(!hasVoted[proposalId][_msgSender()], "EduDAO: ja votou nesta proposta");

        uint256 votingPower = govToken.balanceOf(_msgSender());
        require(votingPower > 0, "EduDAO: sem poder de voto (saldo EDU = 0)");

        hasVoted[proposalId][_msgSender()] = true;

        if (favor) {
            prop.votosFavor  += votingPower;
        } else {
            prop.votosContra += votingPower;
        }

        emit VoteCast(proposalId, _msgSender(), favor, votingPower);
    }

    function executarProposta(uint256 proposalId) external {
        Proposal storage prop = proposals[proposalId];

        require(prop.id != 0,                     "EduDAO: proposta nao existe");
        require(block.timestamp >= prop.deadline, "EduDAO: votacao ainda em andamento");
        require(!prop.executada,                  "EduDAO: ja executada");

        prop.executada = true;

        uint256 totalVotos  = prop.votosFavor + prop.votosContra;
        bool quorumAtingido = totalVotos >= QUORUM;
        bool maioria        = prop.votosFavor > prop.votosContra;

        prop.aprovada = quorumAtingido && maioria;

        emit ProposalExecuted(proposalId, prop.aprovada, prop.votosFavor, prop.votosContra);
    }

    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address proposer,
            string memory descricao,
            uint256 votosFavor,
            uint256 votosContra,
            uint256 deadline,
            bool executada,
            bool aprovada
        )
    {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "EduDAO: proposta nao existe");
        return (
            p.proposer,
            p.descricao,
            p.votosFavor,
            p.votosContra,
            p.deadline,
            p.executada,
            p.aprovada
        );
    }

    function totalProposals() external view returns (uint256) {
        return _proposalCounter;
    }

    function isActive(uint256 proposalId) external view returns (bool) {
        Proposal storage p = proposals[proposalId];
        return (p.id != 0 && !p.executada && block.timestamp < p.deadline);
    }
}
