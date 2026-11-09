use super::*;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, Mac};
use sha2::Sha256;

const NOW: i64 = 1_764_820_800;

/// Signs like pusher-server internal/waitroom.
fn sign(secret: &str, claims: &str, purpose: &str) -> String {
    let p = URL_SAFE_NO_PAD.encode(claims);
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).unwrap();
    mac.update(format!("{purpose}.{p}").as_bytes());
    format!("{p}.{}", URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes()))
}

fn claims(app: &str, room: &str, iat: i64) -> String {
    format!(r#"{{"v":1,"app":"{app}","room":"{room}","n":42,"tid":"abc","iat":{iat},"exp":{}}}"#, iat + 1800)
}

fn good() -> String {
    sign("s3cret", &claims("shopify-acme", "drop", NOW), "hibira-waitroom-pass")
}

struct Case<'a> {
    step: &'a str,
    during: bool,
    cart_pass: Option<String>,
    line_pass: Option<String>,
    tagged: Vec<bool>,
    config: Option<String>,
    lang: &'a str,
}

impl Default for Case<'_> {
    fn default() -> Self {
        Case {
            step: "CHECKOUT_COMPLETION",
            during: true,
            cart_pass: None,
            line_pass: None,
            tagged: vec![true],
            config: Some(config("")),
            lang: "EN",
        }
    }
}

fn config(extra: &str) -> String {
    format!(r#"{{"app":"shopify-acme","room":"drop","secrets":["s3cret"],"since":{}{extra}}}"#, NOW - 60)
}

fn attr(v: &Option<String>) -> String {
    match v {
        Some(v) => format!(r#"{{"value":{v:?}}}"#),
        None => "null".into(),
    }
}

fn run(c: Case) -> Option<String> {
    let lines: Vec<String> = c
        .tagged
        .iter()
        .map(|t| {
            format!(
                r#"{{"pass":{},"merchandise":{{"__typename":"ProductVariant","product":{{"tagged":{t}}}}}}}"#,
                attr(&c.line_pass)
            )
        })
        .collect();
    let cfg = match &c.config {
        Some(v) => format!(r#"{{"value":{v:?}}}"#),
        None => "null".into(),
    };
    let json = format!(
        r#"{{"buyerJourney":{{"step":"{}"}},"localization":{{"language":{{"isoCode":"{}"}}}},"shop":{{"localTime":{{"during":{}}}}},"cart":{{"pass":{},"lines":[{}]}},"validation":{{"config":{cfg}}}}}"#,
        c.step,
        c.lang,
        c.during,
        attr(&c.cart_pass),
        lines.join(",")
    );
    shopify_function::run_function_with_input(|i: Input| -> Result<Option<String>> { Ok(errors(&i)) }, &json).unwrap()
}

const EN: &str = "This drop has a queue. Please go back to the store and wait for your turn before checking out.";

#[test]
fn blocks_without_a_pass_during_the_drop() {
    assert_eq!(run(Case::default()).as_deref(), Some(EN));
    assert!(run(Case { step: "CHECKOUT_INTERACTION", ..Default::default() }).is_some());
}

#[test]
fn a_valid_pass_from_the_cart_or_a_line_goes_through() {
    assert_eq!(run(Case { cart_pass: Some(good()), ..Default::default() }), None);
    assert_eq!(run(Case { line_pass: Some(good()), ..Default::default() }), None);
    assert_eq!(run(Case { cart_pass: Some("junk".into()), line_pass: Some(good()), ..Default::default() }), None);
}

#[test]
fn old_secret_works_during_a_rotation() {
    let cfg = format!(r#"{{"app":"shopify-acme","room":"drop","secrets":["new","s3cret"],"since":{NOW}}}"#);
    assert_eq!(run(Case { cart_pass: Some(good()), config: Some(cfg), ..Default::default() }), None);
}

#[test]
fn refuses_forged_foreign_or_old_passes_and_tickets() {
    for tok in [
        sign("other", &claims("shopify-acme", "drop", NOW), "hibira-waitroom-pass"),
        sign("s3cret", &claims("shopify-acme", "other", NOW), "hibira-waitroom-pass"),
        sign("s3cret", &claims("shopify-evil", "drop", NOW), "hibira-waitroom-pass"),
        sign("s3cret", &claims("shopify-acme", "drop", NOW - 3600), "hibira-waitroom-pass"),
        sign("s3cret", &claims("shopify-acme", "drop", NOW), "hibira-waitroom-ticket"),
        format!("{}.{}", URL_SAFE_NO_PAD.encode(claims("shopify-acme", "drop", NOW + 1)), good().split_once('.').unwrap().1),
        "x".repeat(2000),
        ".".into(),
    ] {
        assert!(run(Case { cart_pass: Some(tok.clone()), ..Default::default() }).is_some(), "{tok}");
    }
}

#[test]
fn quiet_outside_the_window_while_adding_to_cart_or_unconfigured() {
    assert_eq!(run(Case { during: false, ..Default::default() }), None);
    assert_eq!(run(Case { step: "CART_INTERACTION", ..Default::default() }), None);
    assert_eq!(run(Case { config: None, ..Default::default() }), None);
    assert_eq!(run(Case { config: Some("not json".into()), ..Default::default() }), None);
    let no_secret = r#"{"app":"shopify-acme","room":"drop","secrets":[]}"#.to_string();
    assert_eq!(run(Case { config: Some(no_secret), ..Default::default() }), None);
}

#[test]
fn with_tags_only_carts_holding_a_tagged_product_need_a_pass() {
    let cfg = config(r#","tags":["drop"]"#);
    assert_eq!(run(Case { tagged: vec![false, false], config: Some(cfg.clone()), ..Default::default() }), None);
    assert!(run(Case { tagged: vec![false, true], config: Some(cfg), ..Default::default() }).is_some());
    // Without tags every product counts (hasAnyTag([]) is false).
    assert!(run(Case { tagged: vec![false], ..Default::default() }).is_some());
}

#[test]
fn speaks_the_checkout_language_and_the_merchants_wording_wins() {
    assert!(run(Case { lang: "ZH_TW", ..Default::default() }).unwrap().contains("排隊"));
    assert!(run(Case { lang: "ZH_CN", ..Default::default() }).unwrap().contains("排队"));
    assert!(run(Case { lang: "JA", ..Default::default() }).unwrap().contains("順番"));
    assert_eq!(run(Case { lang: "PT_BR", ..Default::default() }).as_deref(), Some(EN));
    let cfg = config(r#","message":"Queue first!""#);
    assert_eq!(run(Case { config: Some(cfg), ..Default::default() }).as_deref(), Some("Queue first!"));
}
