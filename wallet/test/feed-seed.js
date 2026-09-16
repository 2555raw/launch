/* A stand-in that also emits TokenLaunched and serves token metadata, so the
   feed has something real to read. */
const solc = require('solc');
const SRC = `
pragma solidity ^0.8.26;
contract Tok {
    struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }
    string public name; string public symbol; string public logo; string public description;
    address public deployer; Socials s;
    constructor(string memory n,string memory sy,string memory l,string memory d,address dep){
        name=n; symbol=sy; logo=l; description=d; deployer=dep;
        s = Socials("x.com/a","","","","");
    }
    function getTokenInfo() external view returns (address,string memory,string memory,Socials memory){
        return (deployer, logo, description, s);
    }
}
contract Fac {
    event TokenLaunched(address indexed token,address indexed curve,address indexed deployer,
                        address pairToken,uint256 launchConfigId,uint256 graduationThreshold);
    function go(string memory n,string memory sy,string memory l,string memory d) external {
        Tok t = new Tok(n,sy,l,d,msg.sender);
        emit TokenLaunched(address(t), address(this), msg.sender, address(0), 1, 30 ether);
    }
}`;
const out = JSON.parse(solc.compile(JSON.stringify({
  language:'Solidity', sources:{'s.sol':{content:SRC}},
  settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}
})));
for (const e of out.errors||[]) if (e.severity==='error') { console.error(e.formattedMessage); process.exit(1); }
require('fs').writeFileSync((process.env.FEED_SEED || __dirname + '/feed-seed.json'), JSON.stringify({
  fac: out.contracts['s.sol'].Fac
}));
console.log('compilado');
