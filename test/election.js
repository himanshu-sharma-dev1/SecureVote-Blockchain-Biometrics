const Election = artifacts.require("Election");
const assert = require("assert");

contract("Election", (accounts) => {
  const admin = accounts[0];
  const voter1 = accounts[1];
  const voter2 = accounts[2];
  const nonAdmin = accounts[3];

  let electionInstance;

  beforeEach(async () => {
    electionInstance = await Election.new();
  });

  it("deploys a contract and sets the admin", async () => {
    const contractAdmin = await electionInstance.getAdmin();
    assert.equal(contractAdmin, admin, "The admin should be the one who deployed the contract.");
  });

  it("allows the admin to add a candidate", async () => {
    await electionInstance.addCandidate("Candidate 1", "Slogan 1", { from: admin });
    const candidate = await electionInstance.candidateDetails(0);
    assert.equal(candidate.header, "Candidate 1", "The candidate's header should be correct.");
    assert.equal(candidate.slogan, "Slogan 1", "The candidate's slogan should be correct.");
    const candidateCount = await electionInstance.getTotalCandidate();
    assert.equal(candidateCount, 1, "The total number of candidates should be 1.");
  });

  it("prevents a non-admin from adding a candidate", async () => {
    try {
      await electionInstance.addCandidate("Candidate 2", "Slogan 2", { from: nonAdmin });
      assert.fail("The transaction should have failed.");
    } catch (error) {
      assert(error.message.includes("revert"), "The error message should contain 'revert'.");
    }
  });

  it("allows a user to register as a voter", async () => {
    await electionInstance.registerAsVoter("Voter 1", "1234567890", { from: voter1 });
    const voter = await electionInstance.voterDetails(voter1);
    assert.equal(voter.name, "Voter 1", "The voter's name should be correct.");
    assert.equal(voter.isRegistered, true, "The voter should be registered.");
    const voterCount = await electionInstance.getTotalVoter();
    assert.equal(voterCount, 1, "The total number of voters should be 1.");
  });

  it("allows the admin to verify a voter", async () => {
    await electionInstance.registerAsVoter("Voter 1", "1234567890", { from: voter1 });
    await electionInstance.verifyVoter(true, voter1, { from: admin });
    const voter = await electionInstance.voterDetails(voter1);
    assert.equal(voter.isVerified, true, "The voter should be verified.");
  });

  it("prevents a non-admin from verifying a voter", async () => {
    await electionInstance.registerAsVoter("Voter 1", "1234567890", { from: voter1 });
    try {
      await electionInstance.verifyVoter(true, voter1, { from: nonAdmin });
      assert.fail("The transaction should have failed.");
    } catch (error) {
      assert(error.message.includes("revert"), "The error message should contain 'revert'.");
    }
  });

  it("allows a verified voter to vote", async () => {
    await electionInstance.setElectionDetails("Admin Name", "admin@example.com", "Admin Title", "Test Election", "Test Org", { from: admin });
    await electionInstance.addCandidate("Candidate 1", "Slogan 1", { from: admin });
    await electionInstance.registerAsVoter("Voter 1", "1234567890", { from: voter1 });
    await electionInstance.verifyVoter(true, voter1, { from: admin });
    await electionInstance.vote(0, { from: voter1 });
    const voter = await electionInstance.voterDetails(voter1);
    assert.equal(voter.hasVoted, true, "The voter should have voted.");
    const candidate = await electionInstance.candidateDetails(0);
    assert.equal(candidate.voteCount, 1, "The candidate's vote count should be 1.");
  });

  it("prevents an unverified voter from voting", async () => {
    await electionInstance.setElectionDetails("Admin Name", "admin@example.com", "Admin Title", "Test Election", "Test Org", { from: admin });
    await electionInstance.addCandidate("Candidate 1", "Slogan 1", { from: admin });
    await electionInstance.registerAsVoter("Voter 1", "1234567890", { from: voter1 });
    try {
      await electionInstance.vote(0, { from: voter1 });
      assert.fail("The transaction should have failed.");
    } catch (error) {
      assert(error.message.includes("revert"), "The error message should contain 'revert'.");
    }
  });

  it("prevents a voter from voting twice", async () => {
    await electionInstance.setElectionDetails("Admin Name", "admin@example.com", "Admin Title", "Test Election", "Test Org", { from: admin });
    await electionInstance.addCandidate("Candidate 1", "Slogan 1", { from: admin });
    await electionInstance.registerAsVoter("Voter 1", "1234567890", { from: voter1 });
    await electionInstance.verifyVoter(true, voter1, { from: admin });
    await electionInstance.vote(0, { from: voter1 });
    try {
      await electionInstance.vote(0, { from: voter1 });
      assert.fail("The transaction should have failed.");
    } catch (error) {
      assert(error.message.includes("revert"), "The error message should contain 'revert'.");
    }
  });

  it("prevents voting if the election has not started", async () => {
    await electionInstance.addCandidate("Candidate 1", "Slogan 1", { from: admin });
    await electionInstance.registerAsVoter("Voter 1", "1234567890", { from: voter1 });
    await electionInstance.verifyVoter(true, voter1, { from: admin });
    try {
      await electionInstance.vote(0, { from: voter1 });
      assert.fail("The transaction should have failed.");
    } catch (error) {
      assert(error.message.includes("revert"), "The error message should contain 'revert'.");
    }
  });

  it("prevents voting if the election has ended", async () => {
    await electionInstance.setElectionDetails("Admin Name", "admin@example.com", "Admin Title", "Test Election", "Test Org", { from: admin });
    await electionInstance.addCandidate("Candidate 1", "Slogan 1", { from: admin });
    await electionInstance.registerAsVoter("Voter 1", "1234567890", { from: voter1 });
    await electionInstance.verifyVoter(true, voter1, { from: admin });
    await electionInstance.endElection({ from: admin });
    try {
      await electionInstance.vote(0, { from: voter1 });
      assert.fail("The transaction should have failed.");
    } catch (error) {
      assert(error.message.includes("revert"), "The error message should contain 'revert'.");
    }
  });

  it("allows the admin to end the election", async () => {
    await electionInstance.setElectionDetails("Admin Name", "admin@example.com", "Admin Title", "Test Election", "Test Org", { from: admin });
    await electionInstance.endElection({ from: admin });
    const hasEnded = await electionInstance.getEnd();
    assert.equal(hasEnded, true, "The election should have ended.");
  });
});
