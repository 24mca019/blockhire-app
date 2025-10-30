// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title BlockHireRecords - Issuer-driven employment-records contract
/// @author BlockHire
/// @notice Issuers register themselves and issue immutable employee records containing the document hash.
///         Cloudinary stores the actual PDF off-chain. Verification is done by comparing SHA-256 hashes.
/// @dev This contract uses bytes32 for documentHash (sha256). empId is stored as string but key'd by keccak(empId).

contract BlockHireRecords {

    /// -----------------------
    /// Structures & Storage
    /// -----------------------
    struct EmployeeRecord {
        string empId;           // human readable ID (immutable)
        bytes32 documentHash;   // sha256(documentBytes) — immutable (first uploaded)
        string department;
        string designation;
        address issuer;         // who issued it
        uint256 issueDate;
        bool active;
    }

    // Mapping key = keccak256(bytes(empId))
    mapping(bytes32 => EmployeeRecord) private records;

    // Registered issuers (issuer wallet => orgName)
    mapping(address => string) public issuers;

    /// -----------------------
    /// Events
    /// -----------------------
    event IssuerRegistered(address indexed issuer, string orgName);
    event IssuerUnregistered(address indexed issuer);
    event RecordIssued(string indexed empId, bytes32 indexed documentHash, address indexed issuer);
    event RecordRevoked(string indexed empId, address indexed issuer);
    event DocumentUpdateLogged(string indexed empId, bytes32 indexed newDocumentHash, string cloudinaryUrl);

    /// -----------------------
    /// Modifiers
    /// -----------------------
    modifier onlyRegisteredIssuer() {
        require(bytes(issuers[msg.sender]).length != 0, "Not a registered issuer");
        _;
    }

    modifier recordExists(bytes32 key) {
        require(records[key].issuer != address(0), "Record not found");
        _;
    }

    /// -----------------------
    /// Issuer Management
    /// -----------------------

    /// @notice Register the caller address as an issuer with an orgName
    /// @param orgName Human readable organization name
    function registerIssuer(string calldata orgName) external {
        require(bytes(orgName).length > 0, "Org name required");
        issuers[msg.sender] = orgName;
        emit IssuerRegistered(msg.sender, orgName);
    }

    /// @notice Unregister issuer (self-unregister)
    function unregisterIssuer() external {
        require(bytes(issuers[msg.sender]).length != 0, "Not registered");
        delete issuers[msg.sender];
        emit IssuerUnregistered(msg.sender);
    }

    /// -----------------------
    /// Record Lifecycle
    /// -----------------------

    /// @notice Issue a new employee record. This writes the *first* documentHash on-chain and it is immutable.
    /// @dev empId must be unique. documentHash must be SHA-256 of the PDF bytes (computed off-chain).
    /// @param empId Human readable employee id (e.g., "EMP-BH-000123")
    /// @param documentHash bytes32 sha256 hash of the document
    /// @param department department string
    /// @param designation designation string
    function issueRecord(
        string calldata empId,
        bytes32 documentHash,
        string calldata department,
        string calldata designation
    ) external onlyRegisteredIssuer {
        require(bytes(empId).length > 0, "empId required");
        require(documentHash != bytes32(0), "documentHash required");

        bytes32 key = keccak256(abi.encodePacked(empId));
        require(records[key].issuer == address(0), "Record already exists");

        records[key] = EmployeeRecord({
            empId: empId,
            documentHash: documentHash,
            department: department,
            designation: designation,
            issuer: msg.sender,
            issueDate: block.timestamp,
            active: true
        });

        emit RecordIssued(empId, documentHash, msg.sender);
    }

    /// @notice Revoke a record. Only the issuer who created it can revoke.
    /// @param empId Employee ID to revoke
    function revokeRecord(string calldata empId) external {
        bytes32 key = keccak256(abi.encodePacked(empId));
        require(records[key].issuer == msg.sender, "Only original issuer can revoke");
        require(records[key].active == true, "Already revoked");

        records[key].active = false;
        emit RecordRevoked(empId, msg.sender);
    }

    /// -----------------------
    /// Logging (optional updates)
    /// -----------------------

    /// @notice Log a new document upload to off-chain storage (Cloudinary) without changing the canonical on-chain documentHash.
    /// @dev This is for recording that later documents exist (e.g., newer PDFs). Canonical verification uses the original documentHash only.
    /// @param empId Employee ID
    /// @param newDocumentHash sha256 of new document (optional)
    /// @param cloudinaryUrl optional secure Cloudinary URL for the new document
    function logNewDocument(string calldata empId, bytes32 newDocumentHash, string calldata cloudinaryUrl) external {
        bytes32 key = keccak256(abi.encodePacked(empId));
        require(records[key].issuer == msg.sender, "Only original issuer can log updates");
        // we don't mutate the primary documentHash to preserve "first-upload-only" canonical policy
        emit DocumentUpdateLogged(empId, newDocumentHash, cloudinaryUrl);
    }

    /// -----------------------
    /// Verification & Queries
    /// -----------------------

    /// @notice Verify an uploaded document by providing empId and computed documentHash.
    /// @param empId Employee ID
    /// @param uploadedHash sha256 hash computed by the verifier (backend) of the uploaded PDF
    /// @return status 0=NotFound,1=Revoked,2=Verified,3=Tampered
    /// @return issuerAddr issuer address
    /// @return issueDate epoch time
    /// @return active current active flag
    /// @return storedDocumentHash canonical document hash (bytes32)
    /// @return department department string
    /// @return designation designation string
    function verifyRecord(string calldata empId, bytes32 uploadedHash)
        external
        view
        returns (
            uint8 status,
            address issuerAddr,
            uint256 issueDate,
            bool active,
            bytes32 storedDocumentHash,
            string memory department,
            string memory designation
        )
    {
        bytes32 key = keccak256(abi.encodePacked(empId));
        EmployeeRecord memory rec = records[key];

        if (rec.issuer == address(0)) {
            // Not found
            return (0, address(0), 0, false, bytes32(0), "", "");
        }

        if (!rec.active) {
            // Revoked/inactive
            return (1, rec.issuer, rec.issueDate, rec.active, rec.documentHash, rec.department, rec.designation);
        }

        if (rec.documentHash == uploadedHash) {
            // Verified
            return (2, rec.issuer, rec.issueDate, rec.active, rec.documentHash, rec.department, rec.designation);
        } else {
            // Tampered
            return (3, rec.issuer, rec.issueDate, rec.active, rec.documentHash, rec.department, rec.designation);
        }
    }

    /// @notice Get record summary by empId (if exists)
    function getRecord(string calldata empId) external view returns (
        string memory outEmpId,
        bytes32 documentHash,
        string memory department,
        string memory designation,
        address issuerAddr,
        uint256 issueDate,
        bool active
    ) {
        bytes32 key = keccak256(abi.encodePacked(empId));
        EmployeeRecord memory rec = records[key];
        return (rec.empId, rec.documentHash, rec.department, rec.designation, rec.issuer, rec.issueDate, rec.active);
    }
}
