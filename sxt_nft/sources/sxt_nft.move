/*
 SXT NFT module with Display standard for proper NFT recognition.
 Supports name, Walrus CID, MIME type, and Display metadata.
*/
module sxt_nft::sxt_nft {
    use std::string::{Self, String};
    use sui::display;
    use sui::object::UID;
    use sui::package;
    use sui::tx_context::TxContext;
    use sui::transfer;

    /// One Time Witness for Publisher
    public struct SXT_NFT has drop {}

    /// Event NFT with Display support
    public struct EventNFT has key, store {
        id: UID,
        name: String,
        image_cid: String,
        image_mime: String,
        event_date: String,
    }

    /// On-chain collection metadata
    public struct Collection has key, store {
        id: UID,
        name: String,
        symbol: String,
        image_cid: String,
        image_mime: String,
    }

    /// Initialize Display for EventNFT
    #[allow(lint(share_owned))]
    fun init(otw: SXT_NFT, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        
        let mut display = display::new<EventNFT>(&publisher, ctx);
        display.add(string::utf8(b"name"), string::utf8(b"{name}"));
        display.add(string::utf8(b"image_url"), string::utf8(b"https://wal-aggregator-mainnet.staketab.org/v1/blobs/{image_cid}"));
        display.add(string::utf8(b"description"), string::utf8(b"SXT Event NFT"));
        display.add(string::utf8(b"event_date"), string::utf8(b"{event_date}"));
        display.update_version();
        
        transfer::public_transfer(publisher, ctx.sender());
        transfer::public_share_object(display);
    }

    /// Mint an EventNFT directly to a recipient address
    public entry fun mint_to(
        recipient: address,
        name: String,
        image_cid: String,
        image_mime: String,
        event_date: String,
        ctx: &mut TxContext
    ) {
        let nft = EventNFT {
            id: object::new(ctx),
            name,
            image_cid,
            image_mime,
            event_date,
        };
        transfer::public_transfer(nft, recipient);
    }

    /// Create a new collection and transfer to recipient (admin)
    public entry fun create_collection(
        recipient: address,
        name: String,
        symbol: String,
        image_cid: String,
        image_mime: String,
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


