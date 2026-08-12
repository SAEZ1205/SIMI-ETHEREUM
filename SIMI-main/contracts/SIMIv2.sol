// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title SIMI V2
/// @notice Minimal on-chain integrity layer for SIM replacement authorization.
/// Private subscriber data MUST remain off-chain. Only pseudonymous hashes and critical evidence are recorded.
contract SIMIv2 is AccessControl, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    bytes32 private constant REQUEST_TYPEHASH = keccak256(
        "Request(bytes32 requestId,bytes32 subscriberHash,address holder,uint256 nonce,uint256 createdAt,uint256 expiresAt,uint256 policyVersion)"
    );
    bytes32 private constant VERIFICATION_TYPEHASH = keccak256(
        "Verification(bytes32 requestId,bytes32 subscriberHash,address holder,uint256 nonce,uint256 expiresAt,bytes32 proofHash)"
    );
    bytes32 private constant CONSENT_TYPEHASH = keccak256(
        "Consent(bytes32 requestId,bytes32 subscriberHash,address holder,uint256 nonce,uint256 expiresAt,string action)"
    );

    enum FinalState { NONE, AUTHORIZED, DISPUTED }

    struct Request {
        bytes32 requestId;
        bytes32 subscriberHash;
        address holder;
        uint256 nonce;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 policyVersion;
    }

    struct Verification {
        bytes32 requestId;
        bytes32 subscriberHash;
        address holder;
        uint256 nonce;
        uint256 expiresAt;
        bytes32 proofHash;
    }

    struct Consent {
        bytes32 requestId;
        bytes32 subscriberHash;
        address holder;
        uint256 nonce;
        uint256 expiresAt;
        string action;
    }

    mapping(bytes32 => bool) public usedEvidence;
    mapping(bytes32 => FinalState) public finalState;

    event RequestAuthorized(
        bytes32 indexed requestId,
        bytes32 indexed subscriberHash,
        address indexed holder,
        bytes32 proofHash,
        uint256 policyVersion,
        uint256 timestamp
    );

    event RequestDisputed(
        bytes32 indexed requestId,
        bytes32 indexed subscriberHash,
        address indexed holder,
        uint256 timestamp
    );

    event OperatorUpdated(address indexed account, bool enabled);
    event VerifierUpdated(address indexed account, bool enabled);

    error InvalidOperator();
    error InvalidVerifier();
    error InvalidHolder();
    error InvalidAction();
    error RequestExpired();
    error EvidenceAlreadyUsed();
    error RequestAlreadyFinalized();
    error PayloadMismatch();

    constructor(address admin) EIP712("SIMI", "2") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setOperator(address account, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(OPERATOR_ROLE, account);
        else _revokeRole(OPERATOR_ROLE, account);
        emit OperatorUpdated(account, enabled);
    }

    function setVerifier(address account, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(VERIFIER_ROLE, account);
        else _revokeRole(VERIFIER_ROLE, account);
        emit VerifierUpdated(account, enabled);
    }

    /// @notice Consolidates operator, identity verifier and holder evidence in one final transaction.
    function authorize(
        Request calldata request,
        Verification calldata verification,
        Consent calldata consent,
        bytes calldata operatorSignature,
        bytes calldata verifierSignature,
        bytes calldata holderSignature
    ) external {
        _assertOpenAndLive(request.requestId, request.expiresAt);
        _assertAligned(request, verification, consent);
        if (keccak256(bytes(consent.action)) != keccak256(bytes("AUTHORIZE"))) revert InvalidAction();

        bytes32 requestDigest = _hashRequest(request);
        bytes32 verificationDigest = _hashVerification(verification);
        bytes32 consentDigest = _hashConsent(consent);

        _assertUnused(requestDigest);
        _assertUnused(verificationDigest);
        _assertUnused(consentDigest);

        address operator = ECDSA.recover(requestDigest, operatorSignature);
        address verifier = ECDSA.recover(verificationDigest, verifierSignature);
        address holder = ECDSA.recover(consentDigest, holderSignature);

        if (!hasRole(OPERATOR_ROLE, operator)) revert InvalidOperator();
        if (!hasRole(VERIFIER_ROLE, verifier)) revert InvalidVerifier();
        if (holder != request.holder) revert InvalidHolder();

        usedEvidence[requestDigest] = true;
        usedEvidence[verificationDigest] = true;
        usedEvidence[consentDigest] = true;
        finalState[request.requestId] = FinalState.AUTHORIZED;

        emit RequestAuthorized(
            request.requestId,
            request.subscriberHash,
            request.holder,
            verification.proofHash,
            request.policyVersion,
            block.timestamp
        );
    }

    /// @notice Emergency path. A dispute is intentionally allowed as a separate transaction.
    /// The operator signs the request envelope and the holder signs the DISPUTE action.
    function dispute(
        Request calldata request,
        Consent calldata consent,
        bytes calldata operatorSignature,
        bytes calldata holderSignature
    ) external {
        _assertOpenAndLive(request.requestId, request.expiresAt);
        if (
            consent.requestId != request.requestId ||
            consent.subscriberHash != request.subscriberHash ||
            consent.holder != request.holder ||
            consent.nonce != request.nonce ||
            consent.expiresAt != request.expiresAt
        ) revert PayloadMismatch();
        if (keccak256(bytes(consent.action)) != keccak256(bytes("DISPUTE"))) revert InvalidAction();

        bytes32 requestDigest = _hashRequest(request);
        bytes32 consentDigest = _hashConsent(consent);
        _assertUnused(consentDigest);

        address operator = ECDSA.recover(requestDigest, operatorSignature);
        address holder = ECDSA.recover(consentDigest, holderSignature);
        if (!hasRole(OPERATOR_ROLE, operator)) revert InvalidOperator();
        if (holder != request.holder) revert InvalidHolder();

        usedEvidence[consentDigest] = true;
        finalState[request.requestId] = FinalState.DISPUTED;
        emit RequestDisputed(request.requestId, request.subscriberHash, request.holder, block.timestamp);
    }

    function hashRequest(Request calldata request) external view returns (bytes32) { return _hashRequest(request); }
    function hashVerification(Verification calldata verification) external view returns (bytes32) { return _hashVerification(verification); }
    function hashConsent(Consent calldata consent) external view returns (bytes32) { return _hashConsent(consent); }

    function _assertOpenAndLive(bytes32 requestId, uint256 expiresAt) internal view {
        if (finalState[requestId] != FinalState.NONE) revert RequestAlreadyFinalized();
        if (block.timestamp > expiresAt) revert RequestExpired();
    }

    function _assertUnused(bytes32 digest) internal view {
        if (usedEvidence[digest]) revert EvidenceAlreadyUsed();
    }

    function _assertAligned(Request calldata r, Verification calldata v, Consent calldata c) internal pure {
        if (
            v.requestId != r.requestId || c.requestId != r.requestId ||
            v.subscriberHash != r.subscriberHash || c.subscriberHash != r.subscriberHash ||
            v.holder != r.holder || c.holder != r.holder ||
            v.nonce != r.nonce || c.nonce != r.nonce ||
            v.expiresAt != r.expiresAt || c.expiresAt != r.expiresAt
        ) revert PayloadMismatch();
    }

    function _hashRequest(Request calldata r) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            REQUEST_TYPEHASH,
            r.requestId,
            r.subscriberHash,
            r.holder,
            r.nonce,
            r.createdAt,
            r.expiresAt,
            r.policyVersion
        )));
    }

    function _hashVerification(Verification calldata v) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            VERIFICATION_TYPEHASH,
            v.requestId,
            v.subscriberHash,
            v.holder,
            v.nonce,
            v.expiresAt,
            v.proofHash
        )));
    }

    function _hashConsent(Consent calldata c) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            CONSENT_TYPEHASH,
            c.requestId,
            c.subscriberHash,
            c.holder,
            c.nonce,
            c.expiresAt,
            keccak256(bytes(c.action))
        )));
    }
}
