// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IBTS {

    struct InitParams {
        string _name;
        string _symbol;
        address _owner;
        address _factoryAddress;
        address[] _tokens;
        uint256[] _weights;
        address _btsPair;
        string _tokenURI;
        string _id;
        string _description;
    }
    
   function initialize(InitParams calldata params) external;

    function contribute(uint256 _buffer, uint256 _deadline) external payable;
    function withdraw(uint256 _liquidity, uint256 _buffer, uint256 _deadline) external;
    function withdrawETH(uint256 _liquidity, uint256 _buffer, uint256 _deadline) external;
    function rebalance(address[] calldata _newTokens, uint256[] calldata _newWeights, uint256 _buffer, uint256 _deadline) external;
    function emergencyStable(address[] calldata _newTokens, uint256[] calldata _newWeights, uint256 _buffer, uint256 _deadline) external;
    function claimFee(uint256 amount, uint256 _buffer, uint256 _deadline) external;
    function getTokenDetails(uint256 _index) external view returns (address token, uint256 weight);
    function getTokenDetails() external view returns (address[] memory tokens, uint256[] memory weights);
    function totalTokens() external view returns (uint256 tokenLength);
    function getTokenValueByWETH() external view returns (uint256 value);
    function contractURI() external view returns (string memory);
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
    function royaltyInfo(uint256, uint256) external view returns (address receiver, uint256 royaltyAmount);
    function getOwner() external view returns (address owner);
}