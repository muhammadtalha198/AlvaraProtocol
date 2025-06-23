// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract BTSBeacon is UpgradeableBeacon {
    constructor(address implementation) UpgradeableBeacon(implementation, _msgSender()) {}
}