/* A stand-in Pons factory, placed at the real address on a local chain so the
   wallet's own code path can be exercised without spending anything. It is
   deliberately not a reimplementation: it answers the view calls discover()
   makes, and records what launchToken was actually given so the test can read
   the arguments back out. */
const solc = require('solc');
const SRC = `
pragma solidity ^0.8.26;
contract MockPons {
    struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }
    struct TokenParams {
        string name; string symbol; string logo; string description; Socials socials;
        address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled;
        bytes32 expectedEconomics; bytes32 salt;
    }
    struct LaunchConfig {
        uint256 supply; uint256 curveFeeBps; uint256 phantomQuote;
        uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; bool enabled;
    }
    // what the last launch carried, for the test to read back
    string public lastName; string public lastSymbol; string public lastDesc;
    string public lastLogo; string public lastTwitter; address public lastCreator;
    uint256 public lastValue; uint256 public lastConfigId; address public lastPair;
    bytes32 public lastEconomics;

    function canLaunch(address) external pure returns (bool) { return true; }
    function launchEnabled() external pure returns (bool) { return true; }
    function launchFee() external pure returns (uint256) { return 1234567; }
    function launchConfigCount() external pure returns (uint256) { return 2; }
    function getLaunchConfig(uint256 id) external pure returns (LaunchConfig memory c) {
        // id 0 is retired; a launcher that assumed 0 would use a dead curve
        c = LaunchConfig(1000000 ether, 100, 5 ether, 30 ether, 3000, 60, id == 1);
    }
    function previewLaunchEconomics(uint256 id, address pair) external pure returns (bytes32) {
        return keccak256(abi.encode(id, pair));
    }
    function launchToken(TokenParams calldata p, uint256 id, address pair)
        external payable returns (address, address)
    {
        require(msg.value == 1234567, "LaunchFeeNotPaid");
        lastName = p.name; lastSymbol = p.symbol; lastDesc = p.description; lastLogo = p.logo;
        lastTwitter = p.socials.twitter; lastCreator = p.creatorFeeRecipient;
        lastValue = msg.value; lastConfigId = id; lastPair = pair;
        lastEconomics = p.expectedEconomics;
        return (address(uint160(uint256(p.salt))), address(this));
    }
}`;
const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity',
  sources: { 'm.sol': { content: SRC } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.deployedBytecode.object'] } } }
})));
if (out.errors) for (const e of out.errors) if (e.severity === 'error') { console.error(e.formattedMessage); process.exit(1); }
const c = out.contracts['m.sol'].MockPons;
require('fs').writeFileSync((process.env.PONS_MOCK || __dirname + '/pons-mock.json'),
  JSON.stringify({ abi: c.abi, deployed: '0x' + c.evm.deployedBytecode.object }));
console.log('compilado, runtime bytes:', c.evm.deployedBytecode.object.length / 2);
