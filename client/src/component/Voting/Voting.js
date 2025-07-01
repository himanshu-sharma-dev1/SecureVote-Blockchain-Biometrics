// Node modules
import React, { Component } from "react";
import { Link } from "react-router-dom";
// Import useHistory and useLocation (useLocation is still needed by the wrapper to know where we came from)
import { useHistory, useLocation } from "react-router-dom";


// Components
import Navbar from "../Navbar/Navigation";
import NavbarAdmin from "../Navbar/NavigationAdmin";
import NotInit from "../NotInit";

// Contract
import getWeb3 from "../../getWeb3";
import Election from "../../contracts/Election.json";

// CSS
import "./Voting.css"; // Make sure this CSS file exists and is correctly styled

// Create a functional wrapper component to provide history and location props
function VotingWrapper(props) {
  const history = useHistory();
  const location = useLocation(); // Use useLocation hook
  return <Voting {...props} history={history} location={location} />; // Pass history and location as props
}


class Voting extends Component {
  constructor(props) {
    super(props);
    this.state = {
      ElectionInstance: undefined,
      account: null,
      web3: null,
      isAdmin: false,
      candidateCount: 0, // Initialize as 0
      candidates: [],    // Initialize as an empty array
      isElStarted: false,
      isElEnded: false,
      currentVoter: {
        address: undefined,
        name: null,
        phone: null,
        hasVoted: false,
        isVerified: false, // Admin verification
        isRegistered: false,
      },
      // --- Added for better UX ---
      isLoading: true,
      statusMessage: "",
      isFaceVerifiedByLocalStorage: false, // For facial verification check
    };
  }

  componentDidMount = async () => {
    console.log("Voting CDM: Component did mount.");
    // Check face verification status from localStorage when component mounts
    this.updateFaceVerificationStatusFromLocalStorage();

    if (!window.location.hash) {
      console.log("Voting CDM: No hash found, forcing reload.");
      window.location = window.location + "#loaded";
      window.location.reload();
      return; // Prevent further execution before reload
    }
    console.log("Voting CDM: Hash found or page reloaded, proceeding to load blockchain data.");
    await this.loadBlockchainData();
  };

  // Helper to check face verification from localStorage and update state
  updateFaceVerificationStatusFromLocalStorage = () => {
    const faceVerifiedStatus = localStorage.getItem("isFaceVerified") === "true";
    console.log("Voting: Updated isFaceVerifiedByLocalStorage from localStorage:", faceVerifiedStatus);
    this.setState({ isFaceVerifiedByLocalStorage: faceVerifiedStatus });
  };

  loadBlockchainData = async () => {
    console.log("Voting LBD: Attempting to load blockchain data...");
    this.setState({ isLoading: true, statusMessage: "Connecting to blockchain and loading election data..." });
    try {
      const web3 = await getWeb3();
      const accounts = await web3.eth.getAccounts();

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts found. Please ensure MetaMask is unlocked and connected.");
      }
      const account = accounts[0];

      const networkId = await web3.eth.net.getId();
      const deployedNetwork = Election.networks[networkId];
      if (!deployedNetwork) {
        throw new Error("Election contract not deployed on this network. Please check your MetaMask network settings.");
      }

      const instance = new web3.eth.Contract(
        Election.abi,
        deployedNetwork.address
      );
      this.setState({ web3, ElectionInstance: instance, account });
      console.log("Voting LBD: Web3, Contract Instance, and Account are set. Account:", account);

      // Admin check
      const admin = await instance.methods.getAdmin().call();
      if (account === admin) {
        this.setState({ isAdmin: true });
      }

      // Election start/end status
      const start = await instance.methods.getStart().call();
      const end = await instance.methods.getEnd().call();
      this.setState({ isElStarted: start, isElEnded: end });
      console.log("Voting LBD: Election status - Started:", start, "Ended:", end);

      // ---- CORRECTED CANDIDATE LOADING LOGIC ----
      console.log("Voting LBD: Fetching total candidate count from contract...");
      const rawCandidateCount = await instance.methods.getTotalCandidate().call();
      const numCandidateCount = Number(rawCandidateCount); // Convert to JavaScript Number immediately
      
      // Set state for candidateCount (useful for display if needed elsewhere)
      this.setState({ candidateCount: numCandidateCount });
      console.log("Voting LBD: Total candidate count from contract:", numCandidateCount, "(Raw value:", rawCandidateCount,")");

      const fetchedCandidates = []; // Use a local temporary array
      if (numCandidateCount > 0) {
        console.log(`Voting LBD: Found ${numCandidateCount} candidates. Fetching details...`);
        for (let i = 0; i < numCandidateCount; i++) { // Loop from 0 to numCandidateCount - 1
          try {
            // Assuming your contract's `candidateDetails` function takes a 0-based index
            const candidate = await instance.methods.candidateDetails(i).call();
            // Add a check to ensure candidate data is what you expect
            if (candidate && typeof candidate.candidateId !== 'undefined' && candidate.header) {
                fetchedCandidates.push({
                  id: candidate.candidateId,       // Ensure these keys match your Solidity struct
                  header: candidate.header,
                  slogan: candidate.slogan,
                  // voteCount: candidate.voteCount // If you have voteCount per candidate
                });
            } else {
                console.warn(`Voting LBD: Data for candidate at index ${i} is invalid or incomplete:`, candidate);
            }
          } catch (e) {
            console.error(`Voting LBD: Error fetching details for candidate at index ${i}:`, e);
            // Decide if you want to push a placeholder, or just skip this candidate
          }
        }
      } else {
        console.log("Voting LBD: No candidates to load (count is 0 or contract returned invalid count).");
      }
      // Set the candidates state ONCE after the loop finishes
      this.setState({ candidates: fetchedCandidates });
      console.log("Voting LBD: Candidates list processed and state updated:", fetchedCandidates);
      // ---- END OF CORRECTED CANDIDATE LOADING ----

      // Load current voter details
      const currentVoterDetails = await instance.methods.voterDetails(account).call();
      this.setState({
        currentVoter: {
          address: currentVoterDetails.voterAddress,
          name: currentVoterDetails.name,
          phone: currentVoterDetails.phone,
          hasVoted: currentVoterDetails.hasVoted,
          isVerified: currentVoterDetails.isVerified,
          isRegistered: currentVoterDetails.isRegistered,
        },
        isLoading: false, // Done loading all initial data
        statusMessage: "Election data loaded successfully.",
      });
      console.log("Voting LBD: Current voter details loaded:", currentVoterDetails);

    } catch (error) {
      console.error("Voting LBD: Critical error during blockchain data loading:", error);
      this.setState({
        isLoading: false,
        statusMessage: `Error loading election data: ${error.message}. Please check the console and refresh the page.`,
        web3: null, // Indicate that web3/contract setup failed
      });
    }
  };

  // --- Cast Vote Logic ---
  castVote = async (candidateId) => {
    this.setState({ isLoading: true, statusMessage: `Submitting your vote for candidate #${candidateId}...` });
    const { ElectionInstance, account, isFaceVerifiedByLocalStorage } = this.state;

    if (!ElectionInstance) {
      this.setState({ isLoading: false, statusMessage: "Error: Voting system not ready. Please refresh." });
      return;
    }

    // Crucial Check: Face must be verified for the current session to vote
    if (!isFaceVerifiedByLocalStorage) {
       this.setState({ isLoading: false, statusMessage: "Error: Facial verification is required before you can cast your vote. Please verify your identity."});
       // Consider guiding the user: this.props.history.push("/facial", { redirectTo: "voting" });
       return;
    }

    try {
        console.log(`Voting CV: Attempting to cast vote for candidate ID ${candidateId} from account ${account}`);
        const receipt = await ElectionInstance.methods
          .vote(candidateId) // Ensure your 'vote' method in the contract accepts the candidate's ID
          .send({ from: account, gas: 200000 }); // Gas can be estimated: .estimateGas({ from: account }) then add a bit

        console.log("Voting CV: Vote transaction successful. Receipt:", receipt);
        if (receipt.status) { // Check transaction status from receipt
            this.setState({ statusMessage: "Your vote has been successfully cast! The page will now reload."});
            alert("Vote Cast Successfully!");
            // Note: 'isFaceVerified' in localStorage is typically NOT cleared after voting,
            // unless your system requires re-verification for every single blockchain action.
            window.location.reload(); // Reload to update voter status (e.g., hasVoted)
        } else {
            console.error("Voting CV: Vote transaction was submitted but failed on the blockchain (receipt.status is false). Receipt:", receipt);
            this.setState({ isLoading: false, statusMessage: "Error: Your vote was submitted but the transaction failed on the blockchain. Please check your account or try again later." });
        }
    } catch (error) {
         console.error("Voting CV: Error occurred while casting vote:", error);
         let userFriendlyMessage = "Failed to cast vote. An unexpected error occurred. Please see console for technical details.";
         if (error.message) { // Try to provide more specific feedback
             if (error.message.includes("User denied transaction signature")) {
                 userFriendlyMessage = "Vote Canceled: The transaction was rejected in MetaMask.";
             } else if (error.message.toLowerCase().includes("revert")) {
                 const reasonMatch = error.message.match(/revert(?:ed)?(?: with reason string)? '([^']*)'/);
                 const reason = reasonMatch && reasonMatch[1] ? reasonMatch[1] : "A condition in the smart contract was not met (e.g., you may have already voted, the election might not be active, or your account is not permitted to vote).";
                 userFriendlyMessage = `Vote Failed: The transaction was reverted by the smart contract. Reason: ${reason}`;
             } else if (error.message.toLowerCase().includes("out of gas")) {
                 userFriendlyMessage = "Vote Failed: The transaction ran out of gas. This may be a network issue or require a higher gas limit.";
             }
         }
         this.setState({ isLoading: false, statusMessage: userFriendlyMessage });
    }
  };

  // Confirmation before casting vote
  confirmAndCastVote = (candidateId, candidateHeader) => {
    const { currentVoter, isFaceVerifiedByLocalStorage } = this.state;

    // Pre-checks for better UX before showing confirm dialog
    if (!currentVoter.isRegistered) {
        this.setState({statusMessage: "Action Required: You must be registered to vote."}); return;
    }
    if (!currentVoter.isVerified) {
        this.setState({statusMessage: "Action Required: Your registration must be verified by an administrator before you can vote."}); return;
    }
    if (currentVoter.hasVoted) {
        this.setState({statusMessage: "Information: You have already cast your vote in this election."}); return;
    }
    if (!isFaceVerifiedByLocalStorage) {
        this.setState({statusMessage: "Action Required: Facial verification is needed for this session to cast your vote."});
        // Optionally, redirect or show a button to verify face:
        // this.props.history.push("/facial", { redirectTo: "voting" });
        return;
    }

    const confirmation = window.confirm(
      `You are about to vote for:\nCandidate: ${candidateHeader}\nID: ${candidateId}\n\nThis action is final and cannot be undone.\nAre you sure you wish to proceed?`
    );
    if (confirmation) {
      this.castVote(candidateId);
    } else {
        this.setState({statusMessage: "Vote casting was canceled by the user."});
        console.log("Voting: User canceled the vote confirmation.");
    }
  };

  // Render individual candidate item
  renderCandidates = (candidate) => {
    const { currentVoter, isFaceVerifiedByLocalStorage, isLoading } = this.state;

    // Determine if the vote button for this candidate should be enabled
    const canVoteNow = currentVoter.isRegistered &&
                       currentVoter.isVerified &&
                       !currentVoter.hasVoted &&
                       isFaceVerifiedByLocalStorage; // Crucially, face must be verified

    return (
      <div className="container-item" key={candidate.id} style={{border:"1px solid #ddd", margin:"10px", padding:"15px", borderRadius:"5px"}}>
        <div className="candidate-info">
          <h2 style={{marginTop:"0"}}>
            {candidate.header} <small style={{fontSize:"0.8em", color:"#555"}}>(ID: {candidate.id})</small>
          </h2>
          <p className="slogan" style={{fontStyle:"italic"}}>"{candidate.slogan}"</p>
        </div>
        <div className="vote-btn-container" style={{marginTop:"10px"}}>
          <button
            onClick={() => this.confirmAndCastVote(candidate.id, candidate.header)}
            className="vote-bth" // Ensure your CSS targets this class, or use a more generic one like 'btn-primary'
            disabled={!canVoteNow || isLoading} // Disable if user cannot vote or an operation is in progress
            style={{padding:"10px 15px", fontSize:"1em"}}
          >
            {isLoading ? "Processing..." : "Vote for this Candidate"}
          </button>
        </div>
      </div>
    );
  };


  render() {
    const { history } = this.props; // From VotingWrapper
    const {
      web3,
      isAdmin,
      isElStarted,
      isElEnded,
      candidates, // Use this.state.candidates
      candidateCount, // For displaying total count from contract
      currentVoter,
      isLoading,
      statusMessage,
      isFaceVerifiedByLocalStorage,
    } = this.state;

    // ---- Initial Loading States ----
    if (isLoading && !this.state.ElectionInstance) {
      return (
        <>
          {isAdmin ? <NavbarAdmin /> : <Navbar />}
          <center style={{ padding: "30px", color:"#333" }}>
            <h2>Loading Voting Application...</h2>
            <p>{statusMessage || "Initializing connection to the blockchain. Please wait."}</p>
            {/* Consider adding a visual spinner here */}
          </center>
        </>
      );
    }
    if (!web3 && !isLoading) { // Web3/Contract loading failed
        return (
          <>
            {isAdmin ? <NavbarAdmin /> : <Navbar />}
            <center style={{ padding: "30px", color:"#c00" }}>
              <h2>Application Connection Error</h2>
              <p>{statusMessage || "Could not connect to the blockchain. Please ensure MetaMask is installed, unlocked, and connected to the correct network, then refresh this page."}</p>
              <button onClick={() => window.location.reload()} style={{padding: "10px 15px", marginTop:"15px", cursor:"pointer"}}>Refresh Page</button>
            </center>
          </>
        );
    }

    // ---- Main Voting UI Logic ----
    let votingPageContent;

    if (!isElStarted && !isElEnded && this.state.ElectionInstance) { // ElectionInstance check ensures web3 setup is done
        votingPageContent = <NotInit electionStatus="notStarted" />; // Pass a prop to NotInit if it customizes messages
    } else if (isElStarted && !isElEnded) {
        // Election is Active. Now check voter's status.
        if (!currentVoter.isRegistered) {
            votingPageContent = (
                <div className="container-item attention" style={{textAlign: "center", padding:"20px"}}>
                    <p><strong>You are not registered to vote.</strong></p>
                    <p>Please complete the registration process to participate in this election.</p>
                    <Link to="/Registration" className="btn-link-styled" style={{display:"inline-block", marginTop:"10px", padding:"10px 20px", backgroundColor:"#007bff", color:"white", textDecoration:"none", borderRadius:"5px"}}>Go to Registration</Link>
                </div>
            );
        } else if (!currentVoter.isVerified) { // Registered but not admin-verified
            votingPageContent = <div className="container-item attention" style={{textAlign: "center", padding:"20px"}}><p><strong>Your registration is awaiting administrator verification.</strong> Please check back later. You cannot vote until verified.</p></div>;
        } else if (currentVoter.hasVoted) { // Registered, Admin-verified, AND already voted
            votingPageContent = (
                <div className="container-item success" style={{textAlign: "center", padding:"20px"}}>
                    <p><strong>Thank you! Your vote has been successfully recorded.</strong></p>
                    <Link to="/Results" className="btn-link-styled" style={{display:"inline-block", marginTop:"10px", padding:"10px 20px", backgroundColor:"#28a745", color:"white", textDecoration:"none", borderRadius:"5px"}}>View Election Results</Link>
                </div>
            );
        } else if (!isFaceVerifiedByLocalStorage) { // Eligible to vote BUT face not verified in this session
            votingPageContent = (
                <div style={{ textAlign: "center", marginTop: "40px", padding:"20px" }}>
                    <h3>Facial Verification Required to Proceed</h3>
                    <p>For security purposes, please verify your identity via facial recognition before casting your vote.</p>
                    <button
                      onClick={() => {
                        this.setState({statusMessage: "Redirecting for facial verification..."});
                        history.push("/facial", { redirectTo: "voting" }); // redirectTo 'voting' ensures user returns here
                      }}
                      style={{
                        padding: "12px 25px", backgroundColor: "#17a2b8", color: "white",
                        border: "none", borderRadius: "6px", cursor: "pointer", fontSize:"1em", marginTop:"15px"
                      }}
                      disabled={isLoading} // Disable if another operation is processing
                    >
                      Verify My Face to Vote
                    </button>
                </div>
            );
        } else {
            // Voter is Registered, Admin-Verified, Has NOT Voted, AND Face IS Verified for this session
            // This is where they see the candidates and can vote.
            votingPageContent = (
                <>
                  <div className="container-item info" style={{textAlign: "center", padding:"10px", backgroundColor:"#e7f3fe", border:"1px solid #b3d7ff", borderRadius:"5px"}}>
                    <p style={{margin:0}}><strong>You are eligible to vote.</strong> Please review the candidates below and make your selection.</p>
                  </div>
                  <div className="container-main" style={{marginTop:"20px"}}>
                    <h2 style={{textAlign:"center"}}>Candidates for Election</h2>
                    <p style={{textAlign:"center"}}>Total candidates available: <strong>{candidates.length}</strong> (Contract reports: {candidateCount})</p>
                    {/* Warning if frontend list and contract count mismatch */}
                    {candidates.length !== candidateCount && !isLoading && candidateCount > 0 &&
                        <p style={{color: "orange", fontWeight:"bold", textAlign:"center"}}>Notice: There's a mismatch. Contract reports {candidateCount} candidates, but {candidates.length} are displayed. Some details might be missing or there was an error fetching. Check console.</p>
                    }

                    {isLoading && candidates.length === 0 ? (
                        <p style={{textAlign:"center"}}><em>Loading candidate details...</em></p>
                    ) : candidates.length === 0 && !isLoading ? (
                      <div className="container-item attention" style={{textAlign: "center", padding:"20px"}}>
                        <p><strong>No candidates are currently listed for this election.</strong></p>
                        <p>This might be because no candidates have been added by the administrator yet, or there was an issue loading them. Please check back later or contact support if you believe this is an error.</p>
                      </div>
                    ) : (
                      // Map and render the list of candidates
                      candidates.map(this.renderCandidates)
                    )}
                    {candidates.length > 0 && (
                         <div className="container-item" style={{ textAlign:"center", marginTop:"30px", borderTop:"1px solid #eee", paddingTop:"15px" }}>
                            <small>Please review your choice carefully before submitting. Once cast, your vote cannot be changed.</small>
                         </div>
                    )}
                  </div>
                </>
            );
        }
    } else if (isElEnded && this.state.ElectionInstance) { // Election has ended
        votingPageContent = (
            <div className="container-item attention" style={{textAlign: "center", padding:"20px"}}>
                <h3>The Election Has Concluded.</h3>
                <p>Voting is now closed. Thank you for your participation.</p>
                <Link to="/Results" className="btn-link-styled" style={{display:"inline-block", marginTop:"10px", padding:"10px 20px", backgroundColor:"#6c757d", color:"white", textDecoration:"none", borderRadius:"5px"}}>View Election Results</Link>
            </div>
        );
    } else {
        // Fallback for any other state, or if still loading initial election status variables
        votingPageContent = <div style={{textAlign:"center", padding:"20px"}}><p>Loading election status and voter details...</p></div>;
    }


    return (
      <>
        {isAdmin ? <NavbarAdmin /> : <Navbar />}
        <div className="container-main-heading" style={{ textAlign: "center", marginTop: "20px", marginBottom: "10px" }}>
            <h2>Cast Your Vote</h2>
        </div>

        {/* Display Status Messages (Errors, Success, Info) */}
        {statusMessage && (
            <div style={{
                textAlign: "center", padding: "10px", margin: "10px auto", maxWidth: "700px",
                borderRadius: "5px", border: "1px solid",
                borderColor: statusMessage.toLowerCase().includes("error") || statusMessage.toLowerCase().includes("failed") ? "#d32f2f" : (statusMessage.toLowerCase().includes("success") ? "#388e3c" : (statusMessage.toLowerCase().includes("action required") ? "#ffa000" : "#1976d2")),
                backgroundColor: statusMessage.toLowerCase().includes("error") || statusMessage.toLowerCase().includes("failed") ? "#ffebee" : (statusMessage.toLowerCase().includes("success") ? "#e8f5e9" : (statusMessage.toLowerCase().includes("action required") ? "#fff3e0" :"#e3f2fd")),
                color: statusMessage.toLowerCase().includes("error") || statusMessage.toLowerCase().includes("failed") ? "#d32f2f" : (statusMessage.toLowerCase().includes("success") ? "#388e3c" : (statusMessage.toLowerCase().includes("action required") ? "#ef6c00" : "#1976d2")),
            }}>
                <p style={{margin:0}}>{statusMessage}</p>
            </div>
        )}
        {/* General loading indicator for transactions */}
        {isLoading && statusMessage && (statusMessage.toLowerCase().includes("processing") || statusMessage.toLowerCase().includes("submitting") || statusMessage.toLowerCase().includes("casting")) &&
            <div style={{textAlign: "center"}}><p><i>Please wait while your action is being processed... Do not navigate away or refresh the page.</i></p></div>
        }

        <div style={{paddingBottom:"30px"}}> {/* Main content wrapper */}
            {votingPageContent}
        </div>
      </>
    );
  }
}

export default VotingWrapper;