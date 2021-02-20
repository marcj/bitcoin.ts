# MyCoin Miner

The miner is a single-process server with RPC and HTTP API. It's responsible for creating (aka finding) new blocks for
transactions from the transaction pool, appending the blockchain, and communicating its results with his peers. 

### New transaction 

A user or new miner can connect to any existing miner and schedule a transaction. It validates the transaction, and if valid puts it into
the transaction pool + sends it to its connected peers. Those peers do the same, their peers do it, and so on, until all
peers are aware of it.

### Discovery

The discovery process starts with connecting either to a defined IP address or seed addresses.
On the first connection the new miner asks for further peer addresses, which are then shared, and connected to,
until the miner has enough peers.
If a peer disconnects this process might restart until it has enough peers again.

### Mining blocks

The mining process happens like this:

- If transaction pool is empty or too small, wait until pool is big enough.
- Move all transaction, at most 500, from the transaction pool to a list T.
- Remove picked transactions from transaction pool, and keep queueing new incoming transaction in the pool.
- Validate those transactions in list T once again.
- Add coinbase transaction including block reward and transaction fees.
- Create a merkle tree of this transaction in T.
- Receive the current head of the blockchain (that is the newest block, with the greatest height)
- Determine the new difficulty for the new block based on the current head.
- Find a hash for a new block header containing the merkle tree + regular block header. The hash needs to satisfy
  the determined difficulty. To change the hash the `nonce` of the block header is changed.
- If a block header is found, distribute the whole block to all connected peers.
- Add the new block to the chain, and repeat with first point.

While doing this

- The miner listens for incoming blocks.
- If a new block is received and is valid, then
    - Abort the current mining process of the current block.
    - Put the new block onto the blockchain.
    - Put all transaction from list T back to the pool.
    - Remove transaction from the incoming block from the connection pool.
- Restart the mining of a next block.
