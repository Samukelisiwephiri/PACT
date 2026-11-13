// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PACT - Peer-to-Peer Agreement & Community Trust
 * @dev Manages decentralized Stokvel savings pools, offline-attested payments, and automated cycle payouts.
 */
contract PACT {
    struct Member {
        address wallet;
        uint256 totalContributed;
        bool hasPaidCurrentCycle;
    }

    struct StokvelGroup {
        string groupName;
        uint256 contributionAmount; // In Wei or Stablecoin units
        uint256 cycleInterval;       // Seconds between payouts
        uint256 currentCycle;
        uint256 lastPayoutTimestamp;
        address payable currentRecipient;
        address[] memberList;
        bool active;
    }

    uint256 public groupCount;
    mapping(uint256 => StokvelGroup) public groups;
    mapping(uint256 => mapping(address => Member)) public groupMembers;
    mapping(address => bool) public authorizedHardwareNodes;

    address public owner;

    event GroupCreated(uint256 indexed groupId, string name, uint256 contributionAmount);
    event ContributionRecorded(uint256 indexed groupId, address indexed member, uint256 amount, bool viaHardwareNode);
    event PayoutExecuted(uint256 indexed groupId, address indexed recipient, uint256 totalAmount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyHardwareNode() {
        require(authorizedHardwareNodes[msg.sender], "Unauthorized hardware node");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function authorizeHardwareNode(address _nodeAddress) external onlyOwner {
        authorizedHardwareNodes[_nodeAddress] = true;
    }

    function createGroup(string memory _name, uint256 _contributionAmount, uint256 _cycleInterval) external {
        groupCount++;
        StokvelGroup storage newGroup = groups[groupCount];
        newGroup.groupName = _name;
        newGroup.contributionAmount = _contributionAmount;
        newGroup.cycleInterval = _cycleInterval;
        newGroup.currentCycle = 1;
        newGroup.lastPayoutTimestamp = block.timestamp;
        newGroup.active = true;
        newGroup.memberList.push(msg.sender);

        groupMembers[groupCount][msg.sender] = Member(msg.sender, 0, false);
        emit GroupCreated(groupCount, _name, _contributionAmount);
    }

    function joinGroup(uint256 _groupId) external {
        StokvelGroup storage group = groups[_groupId];
        require(group.active, "Group is not active");
        require(groupMembers[_groupId][msg.sender].wallet == address(0), "Already a member");

        group.memberList.push(msg.sender);
        groupMembers[_groupId][msg.sender] = Member(msg.sender, 0, false);
    }

    function depositContribution(uint256 _groupId, address _member) public payable {
        StokvelGroup storage group = groups[_groupId];
        require(group.active, "Group inactive");
        require(msg.value == group.contributionAmount, "Incorrect contribution amount");

        Member storage m = groupMembers[_groupId][_member];
        require(m.wallet != address(0), "Address not in group");

        m.totalContributed += msg.value;
        m.hasPaidCurrentCycle = true;

        emit ContributionRecorded(_groupId, _member, msg.value, msg.sender != _member);
    }

    function executeCyclePayout(uint256 _groupId, address payable _recipient) external {
        StokvelGroup storage group = groups[_groupId];
        require(block.timestamp >= group.lastPayoutTimestamp + group.cycleInterval, "Cycle not mature");

        uint256 poolBalance = address(this).balance;
        require(poolBalance > 0, "No funds to disburse");

        group.lastPayoutTimestamp = block.timestamp;
        group.currentCycle++;
        
        (bool success, ) = _recipient.call{value: poolBalance}("");
        require(success, "Transfer failed");

        emit PayoutExecuted(_groupId, _recipient, poolBalance);
    }
}
