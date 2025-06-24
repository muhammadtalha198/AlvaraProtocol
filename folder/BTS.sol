// Compatible with OpenZeppelin Contracts ^5.0.0
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol"; 
import {ERC721URIStorageUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";


contract BasketTokenStandard is Initializable, ERC721Upgradeable, ERC721URIStorageUpgradeable,IERC2981Upgradeable,ReentrancyGuardUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721_init("MyToken", "MTK");
        __ERC721URIStorage_init();

    }


    function royaltyInfo(
        uint256, /* _tokenId */
        uint256 _salePrice
    )
        external
        view
        override(IERC2981Upgradeable)
        returns (address receiver, uint256 royaltyAmount)
    {
        // receiver = _factory().royaltyReceiver();
        // uint256 rate = _factory().royaltyPercentage();
        // if (rate > 0 && receiver != address(0)) {
        //     royaltyAmount = (_salePrice * rate) / PERCENT_PRECISION;
        // }
    }
     modifier onlySetter() {
        require(msg.sender == address(0), "Not authorized: only setter");
        _;
    }

      function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721Upgradeable,IERC721)  onlySetter() {
        super.transferFrom(from, to, tokenId);
    }

    // The following functions are overrides required by Solidity.

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable,IERC165Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
