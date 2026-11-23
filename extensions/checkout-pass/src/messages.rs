//! Shown at checkout when the cart has no valid pass, in the checkout's
//! language; the merchant's own wording (config.message) wins.

pub fn message(iso: &str) -> &'static str {
    let code = iso.to_ascii_uppercase();
    match code.as_str() {
        "ZH_TW" | "ZH_HK" | "ZH_MO" => "本次開賣需要排隊。請回到商店，輪到你之後再結帳。",
        c if c.starts_with("ZH") => "本次开售需要排队。请回到商店，轮到你之后再结账。",
        c if c.starts_with("JA") => "この販売は順番待ちです。ストアに戻り、順番が来てからお手続きください。",
        c if c.starts_with("KO") => "이 판매는 대기열이 있습니다. 스토어로 돌아가 차례가 되면 결제해 주세요.",
        c if c.starts_with("TH") => "การขายนี้ต้องต่อคิว โปรดกลับไปที่ร้านค้าและรอถึงคิวของคุณก่อนชำระเงิน",
        c if c.starts_with("VI") => "Đợt mở bán này cần xếp hàng. Vui lòng quay lại cửa hàng và chờ đến lượt trước khi thanh toán.",
        c if c.starts_with("ES") => "Esta venta tiene fila de espera. Vuelve a la tienda y espera tu turno antes de pagar.",
        c if c.starts_with("FR") => "Cette vente a une file d'attente. Retournez sur la boutique et attendez votre tour avant de payer.",
        c if c.starts_with("DE") => "Für diesen Verkauf gibt es eine Warteschlange. Bitte kehre zum Shop zurück und warte, bis du an der Reihe bist.",
        _ => "This drop has a queue. Please go back to the store and wait for your turn before checking out.",
    }
}
