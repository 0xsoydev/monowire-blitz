// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library PythStructs {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }
}

interface IPyth {
    function getPrice(bytes32 id) external view returns (PythStructs.Price memory price);
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (PythStructs.Price memory price);
    function updatePriceFeeds(bytes[] calldata updateData) external payable;
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 fee);
}
