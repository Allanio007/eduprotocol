// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// =============================================================================
//  EduProtocol - Mock Chainlink AggregatorV3
//  Autor   : Alanio Ferreira de Lima
//  Curso   : Residencia em TIC 29 - Web 3.0
//  Rede    : Sepolia Testnet
//  Versao  : 1.0.0
// =============================================================================

/**
 * @title MockAggregatorV3
 * @dev Mock do Chainlink AggregatorV3Interface para uso em testes locais.
 *      Permite definir um preco fixo sem depender de rede externa.
 */
contract MockAggregatorV3 {
    int256 private _answer;
    uint80 private _roundId;

    constructor(int256 initialAnswer) {
        _answer  = initialAnswer;
        _roundId = 1;
    }

    function setLatestAnswer(int256 answer) external {
        _answer = answer;
        _roundId++;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            _roundId,
            _answer,
            block.timestamp,
            block.timestamp,
            _roundId
        );
    }
}
