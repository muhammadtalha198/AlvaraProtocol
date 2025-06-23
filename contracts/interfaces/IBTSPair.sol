// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IBTSPair {
    function initialize(address factoryAddress, string memory name, address[] calldata tokens) external;

    function mint(address to, uint256[] calldata amounts) external returns (uint256 liquidity);

    function burn(address to) external returns (uint256[] memory amounts);

    function transferTokensToOwner() external;

    function updateTokens(address[] calldata tokens) external;

    function setReentrancyGuardStatus(bool _state) external;

    function distMgmtFee() external;

    function getTokenAddress(uint256 tokenIndex) external view returns (address);

    function getTokenReserve(uint256 tokenIndex) external view returns (uint256);

    function getTokenList() external view returns (address[] memory);

    function getTokensReserve() external view returns (uint256[] memory);

    function getTotalMgmtFee() external view returns (uint);

    function calculateShareETH(uint256 amountLP) external view returns (uint256 amountETH);

    function calculateShareTokens(uint256 amountLP) external view returns (uint256[] memory amountTokens);

    function getTokenAndUserBal(address user) external view returns (uint256[] memory, uint256, uint256);
}
