/* The shapes that cross module boundaries.

   There is no build step and no TypeScript here, so these are JSDoc typedefs:
   editors read them, nothing compiles them, and every module that hands one
   of these around names it. The four states of the app never share a type
   by accident:

     game state      the round, the field, the race being replayed
     ui state        which screen is up, what is highlighted, what is loading
     wallet state    who is connected and how
     chain state     network, transactions, what the contract says

   A real multiplayer backend or a real contract slots in behind the same
   shapes. */

/**
 * @typedef {Object} Wallet
 * @property {string|null} address     checksummed 0x address, or null when disconnected
 * @property {'metamask'|'phantom'|'injected'|'demo'|null} kind
 * @property {string} label            what the modal called it
 * @property {number|null} chainId
 * @property {string} network          human name of the chain
 * @property {boolean} demo            a demo wallet: nothing it does touches a chain
 * @property {string|null} token       the session token the server issued
 */

/**
 * @typedef {Object} Marble
 * @property {string} material         glass | metal | holo | neon | chrome | clear | lava | galaxy
 * @property {string} color            hex
 * @property {string} face             a coin id from RENDER.FACES
 */

/**
 * @typedef {Object} Player
 * @property {string} address
 * @property {string} name             what floats above the marble: a chosen name or the short address
 * @property {Marble} marble
 * @property {boolean} you
 */

/**
 * @typedef {Object} RaceParticipant
 * @property {string} address
 * @property {string} color
 * @property {string} face
 * @property {string} [material]
 * @property {string} [name]
 * @property {number} joinedAt
 */

/**
 * @typedef {Object} PrizePool
 * @property {number|null} usd         the pot as shown, the whole prize
 * @property {number|null} grossEth    fees that came in, in ETH
 * @property {boolean} final
 * @property {boolean} mega
 */

/**
 * @typedef {Object} Race
 * @property {string} id               'R' + start time, the server's id
 * @property {number} number           the human number, RACE #0248
 * @property {'lobby'|'locked'|'racing'|'result'} phase
 * @property {boolean} mega
 * @property {number} startAt
 * @property {number} lockAt
 * @property {number} raceAt
 * @property {number} endAt
 * @property {string} commit           sha256 of the secret, published before anyone joins
 * @property {number|null} seed
 * @property {string|null} secret
 * @property {RaceParticipant[]} players
 * @property {number} max
 * @property {PrizePool} prize
 */

/**
 * @typedef {Object} RaceResult
 * @property {string} raceId
 * @property {number} number
 * @property {string} winner
 * @property {{id:string, place:number, time:number}[]} order
 * @property {PrizePool} prize
 * @property {number} seconds
 */

/**
 * @typedef {'idle'|'waiting_wallet'|'confirm'|'pending'|'confirmed'|'failed'} TxStatus
 */

/**
 * @typedef {Object} Transaction
 * @property {string} id
 * @property {'join'|'claim'} kind
 * @property {TxStatus} status
 * @property {string|null} hash        on chain only; a demo or mock transaction never has one
 * @property {string} [error]
 * @property {number} at
 */

window.MR_TYPES = true;
