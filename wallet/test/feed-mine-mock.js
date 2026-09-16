const solc = require('solc');
const SRC = `
pragma solidity ^0.8.26;
contract Tok {
    struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }
    string public name; string public symbol; string public logo; string public description;
    address public deployer; Socials s;
    constructor(string memory n,string memory sy,string memory l,string memory d,address dep){
        name=n; symbol=sy; logo=l; description=d; deployer=dep;
    }
    function getTokenInfo() external view returns (address,string memory,string memory,Socials memory){
        return (deployer, logo, description, s);
    }
}
contract Fac {
    struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }
    struct TokenParams { string name; string symbol; string logo; string description; Socials socials;
        address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled;
        bytes32 expectedEconomics; bytes32 salt; }
    event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,
                        address pairToken,uint256 launchConfigId,uint256 graduationThreshold);
    function launchToken(TokenParams calldata p, uint256 id, address pair)
        external payable returns (address, address) {
        Tok t = new Tok(p.name, p.symbol, p.logo, p.description, msg.sender);
        emit TokenLaunched(address(t), address(this), msg.sender, pair, id, 30 ether);
        return (address(t), address(this));
    }
}`;
const out = JSON.parse(solc.compile(JSON.stringify({
  language:'Solidity', sources:{'m.sol':{content:SRC}},
  settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}
})));
for (const e of out.errors||[]) if (e.severity==='error') { console.error(e.formattedMessage); process.exit(1); }
require('fs').writeFileSync((process.env.PONS_MOCK || __dirname + '/feed-mine.json'), JSON.stringify({ fac: out.contracts['m.sol'].Fac }));
console.log('compilado');
