// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ARCNameRegistry is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant REGISTRATION_PERIOD = 365 days;
    uint64 public constant GRACE_PERIOD = 30 days;
    uint64 public constant MIN_COMMITMENT_AGE = 0;
    uint64 public constant MAX_COMMITMENT_AGE = 1 days;
    bytes4 private constant DOT_ARC = 0x2e617263; // ".arc"

    bytes32 private constant RESERVED_ADMIN = keccak256("admin");
    bytes32 private constant RESERVED_ARC = keccak256("arc");
    bytes32 private constant RESERVED_TREASURY = keccak256("treasury");
    bytes32 private constant RESERVED_NULL = keccak256("null");
    bytes32 private constant RESERVED_VOID = keccak256("void");

    struct Record {
        address owner;
        address resolvedAddress;
        uint64 expiry;
        bool reserved;
        string label;
    }

    IERC20 public immutable usdcToken;
    address public treasury;
    uint256 public baseFeeUSDC;
    uint256 public shortNameFeeUSDC;

    mapping(bytes32 => Record) private records;
    mapping(address => bytes32[]) private ownedLabelHashes;
    mapping(address => mapping(bytes32 => uint256)) private ownerIndexPlusOne;
    mapping(address => bytes32) public primaryName;
    mapping(bytes32 => uint64) public commitTimestamp;
    bool public commitRevealRequired = true;

    event NameRegistered(string indexed label, bytes32 indexed labelHash, address indexed owner, address resolvedAddress, uint64 expiry);
    event NameCommitmentSubmitted(address indexed registrant, bytes32 indexed commitment, uint64 timestamp);
    event CommitRevealModeUpdated(bool required);
    event NameUpdated(string indexed label, bytes32 indexed labelHash, address indexed newAddress);
    event NameTransferred(string indexed label, bytes32 indexed labelHash, address indexed oldOwner, address newOwner);
    event NameRenewed(string indexed label, bytes32 indexed labelHash, uint64 newExpiry);
    event NameReleased(string indexed label, bytes32 indexed labelHash);
    event NameReserved(string indexed label, bytes32 indexed labelHash);
    event PrimaryNameSet(address indexed owner, string indexed label, bytes32 indexed labelHash);
    event FeesUpdated(uint256 baseFeeUSDC, uint256 shortNameFeeUSDC);
    event TreasuryUpdated(address indexed treasury);

    error InvalidLabel();
    error NameNotAvailable();
    error NotLabelOwner();
    error InvalidAddress();
    error NameExpired();
    error NameNotFound();
    error NameIsReserved();
    error CommitmentMissing();
    error CommitmentTooNew();
    error CommitmentExpired();
    error CommitmentAlreadyUsed();
    error CommitRevealRequired();

    constructor(
        address initialOwner,
        address usdcAddress,
        address initialTreasury,
        uint256 initialBaseFeeUSDC,
        uint256 initialShortNameFeeUSDC
    ) Ownable(initialOwner) {
        if (usdcAddress == address(0) || initialTreasury == address(0)) revert InvalidAddress();
        usdcToken = IERC20(usdcAddress);
        treasury = initialTreasury;
        baseFeeUSDC = initialBaseFeeUSDC;
        shortNameFeeUSDC = initialShortNameFeeUSDC;
    }

    function register(string calldata rawLabel, address resolvedAddress) external whenNotPaused nonReentrant {
        if (commitRevealRequired) revert CommitRevealRequired();
        string memory normalized = _normalizeLabel(rawLabel);
        _registerNormalized(normalized, resolvedAddress);
    }

    function submitCommitment(bytes32 commitment) external whenNotPaused {
        if (commitTimestamp[commitment] != 0) revert CommitmentAlreadyUsed();
        commitTimestamp[commitment] = uint64(block.timestamp);
        emit NameCommitmentSubmitted(msg.sender, commitment, uint64(block.timestamp));
    }

    function registerWithCommit(string calldata rawLabel, address resolvedAddress, bytes32 salt) external whenNotPaused nonReentrant {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        bytes32 commitment = keccak256(abi.encodePacked(msg.sender, labelHash, salt));
        uint64 committedAt = commitTimestamp[commitment];
        if (committedAt == 0) revert CommitmentMissing();
        if (block.timestamp < committedAt + MIN_COMMITMENT_AGE) revert CommitmentTooNew();
        if (block.timestamp > committedAt + MAX_COMMITMENT_AGE) revert CommitmentExpired();
        delete commitTimestamp[commitment];

        _registerNormalized(normalized, resolvedAddress);
    }

    function computeCommitment(address registrant, string calldata rawLabel, bytes32 salt) external pure returns (bytes32) {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        return keccak256(abi.encodePacked(registrant, labelHash, salt));
    }

    function setCommitRevealRequired(bool required) external onlyOwner {
        commitRevealRequired = required;
        emit CommitRevealModeUpdated(required);
    }

    function _registerNormalized(string memory normalized, address resolvedAddress) internal {
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage current = records[labelHash];

        if (_isReservedName(labelHash) || current.reserved) revert NameIsReserved();
        if (!_isAvailableRecord(current)) revert NameNotAvailable();

        uint256 fee = _quotePriceForNormalized(normalized, 1);
        usdcToken.safeTransferFrom(msg.sender, treasury, fee);

        if (current.owner != address(0)) {
            _removeOwnedLabel(current.owner, labelHash);
            if (primaryName[current.owner] == labelHash) {
                delete primaryName[current.owner];
            }
        }

        address finalResolvedAddress = resolvedAddress == address(0) ? msg.sender : resolvedAddress;
        if (finalResolvedAddress == address(0)) revert InvalidAddress();

        records[labelHash] = Record({
            owner: msg.sender,
            resolvedAddress: finalResolvedAddress,
            expiry: uint64(block.timestamp + REGISTRATION_PERIOD),
            reserved: false,
            label: normalized
        });

        _addOwnedLabel(msg.sender, labelHash);
        if (primaryName[msg.sender] == bytes32(0)) {
            primaryName[msg.sender] = labelHash;
            emit PrimaryNameSet(msg.sender, normalized, labelHash);
        }

        emit NameRegistered(normalized, labelHash, msg.sender, finalResolvedAddress, records[labelHash].expiry);
    }

    function resolve(string calldata rawLabel) external view returns (address) {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        if (!_isActive(record)) return address(0);
        return record.resolvedAddress;
    }

    function reverseResolve(address wallet) external view returns (string memory) {
        bytes32 labelHash = primaryName[wallet];
        if (labelHash == bytes32(0)) return "";
        Record storage record = records[labelHash];
        if (!_isActive(record) || record.owner != wallet) return "";
        return string.concat(record.label, ".arc");
    }

    function setPrimaryName(string calldata rawLabel) external {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        if (!_isActive(record)) revert NameExpired();
        if (record.owner != msg.sender) revert NotLabelOwner();
        primaryName[msg.sender] = labelHash;
        emit PrimaryNameSet(msg.sender, normalized, labelHash);
    }

    function updateResolvedAddress(string calldata rawLabel, address newAddress) external {
        if (newAddress == address(0)) revert InvalidAddress();
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        if (!_isActive(record)) revert NameExpired();
        if (record.owner != msg.sender) revert NotLabelOwner();
        record.resolvedAddress = newAddress;
        emit NameUpdated(normalized, labelHash, newAddress);
    }

    function transferName(string calldata rawLabel, address newOwner) external {
        if (newOwner == address(0)) revert InvalidAddress();
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        if (!_isActive(record)) revert NameExpired();
        if (record.owner != msg.sender) revert NotLabelOwner();

        address oldOwner = record.owner;
        _removeOwnedLabel(oldOwner, labelHash);
        if (primaryName[oldOwner] == labelHash) {
            delete primaryName[oldOwner];
        }

        record.owner = newOwner;
        _addOwnedLabel(newOwner, labelHash);

        if (primaryName[newOwner] == bytes32(0)) {
            primaryName[newOwner] = labelHash;
            emit PrimaryNameSet(newOwner, record.label, labelHash);
        }

        emit NameTransferred(normalized, labelHash, oldOwner, newOwner);
    }

    function renew(string calldata rawLabel) external whenNotPaused nonReentrant {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        if (record.owner == address(0)) revert NameNotFound();
        if (record.owner != msg.sender) revert NotLabelOwner();
        if (record.expiry + GRACE_PERIOD < block.timestamp) revert NameExpired();

        uint256 fee = _quotePriceForNormalized(normalized, 1);
        usdcToken.safeTransferFrom(msg.sender, treasury, fee);

        uint64 start = record.expiry > block.timestamp ? record.expiry : uint64(block.timestamp);
        record.expiry = start + REGISTRATION_PERIOD;
        emit NameRenewed(normalized, labelHash, record.expiry);
    }

    function release(string calldata rawLabel) external {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        if (record.owner == address(0)) revert NameNotFound();
        if (record.owner != msg.sender) revert NotLabelOwner();

        _removeOwnedLabel(msg.sender, labelHash);
        if (primaryName[msg.sender] == labelHash) {
            delete primaryName[msg.sender];
        }
        delete records[labelHash];

        emit NameReleased(normalized, labelHash);
    }

    function quotePrice(string calldata rawLabel, uint256 yearsCount) public view returns (uint256) {
        if (yearsCount == 0) revert InvalidLabel();
        string memory normalized = _normalizeLabel(rawLabel);
        return _quotePriceForNormalized(normalized, yearsCount);
    }

    function isAvailable(string calldata rawLabel) external view returns (bool) {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        if (_isReservedName(labelHash) || record.reserved) return false;
        return _isAvailableRecord(record);
    }

    function getRecord(
        string calldata rawLabel
    ) external view returns (address owner, address resolvedAddress, uint64 expiry, bool expired, bool reserved) {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        return (
            record.owner,
            record.resolvedAddress,
            record.expiry,
            record.expiry != 0 && record.expiry < block.timestamp,
            record.reserved || _isReservedName(labelHash)
        );
    }

    function getOwnedLabels(address wallet) external view returns (string[] memory labels) {
        bytes32[] storage hashes = ownedLabelHashes[wallet];
        labels = new string[](hashes.length);
        for (uint256 i = 0; i < hashes.length; i++) {
            labels[i] = string.concat(records[hashes[i]].label, ".arc");
        }
    }

    function reserveName(string calldata rawLabel) external onlyOwner {
        string memory normalized = _normalizeLabel(rawLabel);
        bytes32 labelHash = keccak256(bytes(normalized));
        Record storage record = records[labelHash];
        record.reserved = true;
        if (bytes(record.label).length == 0) {
            record.label = normalized;
        }
        emit NameReserved(normalized, labelHash);
    }

    function setFees(uint256 newBaseFeeUSDC, uint256 newShortNameFeeUSDC) external onlyOwner {
        baseFeeUSDC = newBaseFeeUSDC;
        shortNameFeeUSDC = newShortNameFeeUSDC;
        emit FeesUpdated(newBaseFeeUSDC, newShortNameFeeUSDC);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _isActive(Record storage record) internal view returns (bool) {
        return record.owner != address(0) && record.expiry >= block.timestamp;
    }

    function _isAvailableRecord(Record storage record) internal view returns (bool) {
        if (record.owner == address(0)) return true;
        return record.expiry + GRACE_PERIOD < block.timestamp;
    }

    function _addOwnedLabel(address owner, bytes32 labelHash) internal {
        if (ownerIndexPlusOne[owner][labelHash] != 0) return;
        ownedLabelHashes[owner].push(labelHash);
        ownerIndexPlusOne[owner][labelHash] = ownedLabelHashes[owner].length;
    }

    function _removeOwnedLabel(address owner, bytes32 labelHash) internal {
        uint256 indexPlusOne = ownerIndexPlusOne[owner][labelHash];
        if (indexPlusOne == 0) return;
        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = ownedLabelHashes[owner].length - 1;
        if (index != lastIndex) {
            bytes32 moved = ownedLabelHashes[owner][lastIndex];
            ownedLabelHashes[owner][index] = moved;
            ownerIndexPlusOne[owner][moved] = index + 1;
        }
        ownedLabelHashes[owner].pop();
        delete ownerIndexPlusOne[owner][labelHash];
    }

    function _isReservedName(bytes32 labelHash) internal pure returns (bool) {
        return
            labelHash == RESERVED_ADMIN ||
            labelHash == RESERVED_ARC ||
            labelHash == RESERVED_TREASURY ||
            labelHash == RESERVED_NULL ||
            labelHash == RESERVED_VOID;
    }

    function _normalizeLabel(string memory rawLabel) internal pure returns (string memory) {
        bytes memory src = bytes(rawLabel);
        if (src.length < 3) revert InvalidLabel();

        bytes memory lower = new bytes(src.length);
        for (uint256 i = 0; i < src.length; i++) {
            uint8 ch = uint8(src[i]);
            if (ch >= 65 && ch <= 90) {
                lower[i] = bytes1(ch + 32);
            } else {
                lower[i] = src[i];
            }
        }

        uint256 len = lower.length;
        if (len > 4 && _endsWithArc(lower)) {
            len -= 4;
        }
        if (len < 3 || len > 32) revert InvalidLabel();

        bytes memory out = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            uint8 ch = uint8(lower[i]);
            bool isLower = ch >= 97 && ch <= 122;
            bool isDigit = ch >= 48 && ch <= 57;
            if (!(isLower || isDigit)) revert InvalidLabel();
            out[i] = lower[i];
        }

        return string(out);
    }

    function _endsWithArc(bytes memory value) internal pure returns (bool) {
        if (value.length < 4) return false;
        uint256 start = value.length - 4;
        bytes4 suffix;
        assembly {
            suffix := mload(add(add(value, 0x20), start))
        }
        return suffix == DOT_ARC;
    }

    function _quotePriceForNormalized(string memory normalized, uint256 yearsCount) internal view returns (uint256) {
        uint256 annual = bytes(normalized).length <= 4 ? shortNameFeeUSDC : baseFeeUSDC;
        return annual * yearsCount;
    }
}
