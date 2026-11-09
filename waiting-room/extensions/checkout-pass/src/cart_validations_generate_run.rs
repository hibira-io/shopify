//! While a drop's waiting room is on, checkout needs a valid Hibira pass,
//! which the theme app embed writes into the cart attribute _hibira_wr_pass
//! and, for "Buy it now" (which skips the cart), the same line item property.

use super::schema;
use crate::messages::message;
use crate::pass::{verify, Config};
use schema::cart_validations_generate_run::input::cart::lines::Merchandise;
use schema::cart_validations_generate_run::Input;
use shopify_function::prelude::*;
use shopify_function::Result;

#[shopify_function]
fn cart_validations_generate_run(input: Input) -> Result<schema::CartValidationsGenerateRunResult> {
    let errors = errors(&input)
        .map(|message| {
            vec![schema::ValidationError {
                message,
                target: "$.cart".to_owned(),
            }]
        })
        .unwrap_or_default();
    Ok(schema::CartValidationsGenerateRunResult {
        operations: vec![schema::Operation::ValidationAdd(schema::ValidationAddOperation { errors })],
    })
}

/// The message to block checkout with, or None to let it through.
pub fn errors(input: &Input) -> Option<String> {
    // Adding to cart is never blocked: the pass may be written a moment later.
    match input.buyer_journey().step() {
        Some(schema::BuyerJourneyStep::CheckoutInteraction) | Some(schema::BuyerJourneyStep::CheckoutCompletion) | None => {}
        Some(_) => return None,
    }
    if !*input.shop().local_time().during() {
        return None;
    }
    let cfg: Config = input
        .validation()
        .config()
        .and_then(|m| serde_json::from_str(m.value()).ok())?;
    if cfg.app.is_empty() || cfg.room.is_empty() || cfg.secrets.iter().all(|s| s.is_empty()) {
        return None;
    }

    let lines = input.cart().lines();
    let guarded = if cfg.tags.is_empty() {
        !lines.is_empty()
    } else {
        lines.iter().any(|l| match l.merchandise() {
            Merchandise::ProductVariant(v) => *v.product().tagged(),
            _ => false,
        })
    };
    if !guarded {
        return None;
    }

    let mut tried: Vec<&str> = Vec::new();
    let cart_pass = input.cart().pass().and_then(|a| a.value());
    let line_passes = lines.iter().filter_map(|l| l.pass().and_then(|a| a.value()));
    for tok in cart_pass.into_iter().chain(line_passes) {
        let tok = tok.as_str();
        // At most a few distinct passes: each costs one HMAC per secret.
        if tok.is_empty() || tried.contains(&tok) || tried.len() >= 4 {
            continue;
        }
        tried.push(tok);
        if verify(tok, &cfg) {
            return None;
        }
    }
    if !cfg.message.is_empty() {
        return Some(cfg.message);
    }
    let iso = format!("{:?}", input.localization().language().iso_code());
    Some(message(iso.trim_matches('"')).to_owned())
}


#[cfg(test)]
mod tests;
