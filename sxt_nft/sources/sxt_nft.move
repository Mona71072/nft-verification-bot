/*
 Minimal NFT module for event NFTs with Walrus CID and MIME type.
 Provides gasless-friendly mint_to(recipient, image_cid, image_mime).
*/
module sxt_nft::event_nft {
    use std::string;
    use sui::object;
    use sui::object::UID;
    use sui::tx_context::TxContext;
    use sui::transfer;

    /// Simple NFT storing Walrus CID and MIME type
    public struct EventNFT has key, store {
        id: UID,
        image_cid: string::String,
        image_mime: string::String,
    }

    /// On-chain collection metadata
    public struct Collection has key, store {
        id: UID,
        name: string::String,
        symbol: string::String,
        image_cid: string::String,
        image_mime: string::String,
    }

    /// Mint an EventNFT directly to a recipient address
    public entry fun mint_to(
        recipient: address,
        image_cid: string::String,
        image_mime: string::String,
        ctx: &mut TxContext
    ) {
        let nft = EventNFT {
            id: object::new(ctx),
            image_cid,
            image_mime,
        };
        transfer::public_transfer(nft, recipient);
    }

    /// Create a new collection and transfer to recipient (admin)
    public entry fun create_collection(
        recipient: address,
        name: string::String,
        symbol: string::String,
        image_cid: string::String,
        image_mime: string::String,
        ctx: &mut TxContext
    ) {
        let col = Collection {
            id: object::new(ctx),
            name,
            symbol,
            image_cid,
            image_mime,
        };
        transfer::public_transfer(col, recipient);
    }
}


