// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CertificateRegistry
 * @dev Blockchain-Based Certificate Verification Platform (Phase IV – Remix)
 * Owner (admin) can approve issuers. Issuers can issue and revoke certificates.
 * Each certificate is identified by a bytes32 hash (SHA-256 of the document or metadata).
 */
contract CertificateRegistry {
    address public owner;
    mapping(address => bool) public isIssuer;

    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }
    modifier onlyIssuer() { require(isIssuer[msg.sender], "Only issuer"); _; }

    enum Status { None, Valid, Revoked }
    struct Record {
        address issuer;
        string studentId;
        string program;
        uint256 issuedAt;
        Status status;
        string uri;
    }

    mapping(bytes32 => Record) private records;

    event IssuerUpdated(address indexed who, bool allowed);
    event Issued(bytes32 indexed hash, address indexed issuer, string studentId, string program, string uri);
    event Revoked(bytes32 indexed hash, address indexed issuer);

    constructor() {
        owner = msg.sender;
        isIssuer[msg.sender] = true;
        emit IssuerUpdated(msg.sender, true);
    }

    function setIssuer(address who, bool allowed) external onlyOwner {
        isIssuer[who] = allowed;
        emit IssuerUpdated(who, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero addr");
        owner = newOwner;
    }

    function issue(bytes32 hash, string calldata studentId, string calldata program, string calldata uri) external onlyIssuer {
        require(hash != bytes32(0), "hash required");
        Record storage r = records[hash];
        require(r.status == Status.None, "already exists");
        r.issuer = msg.sender;
        r.studentId = studentId;
        r.program = program;
        r.issuedAt = block.timestamp;
        r.status = Status.Valid;
        r.uri = uri;
        emit Issued(hash, msg.sender, studentId, program, uri);
    }

    function revoke(bytes32 hash) external {
        Record storage r = records[hash];
        require(r.status == Status.Valid, "not valid");
        require(msg.sender == r.issuer || msg.sender == owner, "not issuer/owner");
        r.status = Status.Revoked;
        emit Revoked(hash, msg.sender);
    }

    function verify(bytes32 hash) external view returns (
        bool found,
        bool valid,
        address issuer,
        string memory studentId,
        string memory program,
        uint256 issuedAt,
        string memory uri
    ) {
        Record storage r = records[hash];
        if (r.status == Status.None) {
            return (false, false, address(0), "", "", 0, "");
        }
        return (true, r.status == Status.Valid, r.issuer, r.studentId, r.program, r.issuedAt, r.uri);
    }

    function getStatus(bytes32 hash) external view returns (Status) {
        return records[hash].status;
    }
}
