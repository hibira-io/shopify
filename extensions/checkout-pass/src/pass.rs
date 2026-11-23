//! A Hibira waiting-room pass (pusher-server docs/waiting-rooms.md):
//! base64url(JSON) "." base64url(HMAC-SHA256(secret, "hibira-waitroom-pass." + base64url(JSON))).

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use hmac::{Hmac, Mac};
use serde::Deserialize;
use sha2::Sha256;

const PURPOSE: &[u8] = b"hibira-waitroom-pass.";
const MAX_LEN: usize = 1024;

/// The validation's settings (metafield $app:hibira-waiting-room.config).
#[derive(Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub app: String,
    #[serde(default)]
    pub room: String,
    #[serde(default)]
    pub secrets: Vec<String>,
    /// Passes issued before this (Unix seconds) belong to an earlier drop.
    #[serde(default)]
    pub since: i64,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub message: String,
}

#[derive(Deserialize)]
pub struct Claims {
    pub v: i64,
    pub app: String,
    pub room: String,
    #[serde(default)]
    pub iat: i64,
}

/// Checks a pass's signature (against each secret, for rotations), app,
/// room and issue time. Expiry is not checked: a Function has no clock, so
/// the drop window (localTime) and `since` bound it instead.
pub fn verify(tok: &str, cfg: &Config) -> bool {
    if tok.len() > MAX_LEN {
        return false;
    }
    let Some((payload, sig)) = tok.split_once('.') else {
        return false;
    };
    let Ok(sig) = URL_SAFE_NO_PAD.decode(sig) else {
        return false;
    };
    let signed = cfg.secrets.iter().filter(|s| !s.is_empty()).any(|secret| {
        let Ok(mut mac) = Hmac::<Sha256>::new_from_slice(secret.as_bytes()) else {
            return false;
        };
        mac.update(PURPOSE);
        mac.update(payload.as_bytes());
        mac.verify_slice(&sig).is_ok()
    });
    if !signed {
        return false;
    }
    let Ok(json) = URL_SAFE_NO_PAD.decode(payload) else {
        return false;
    };
    let Ok(c) = serde_json::from_slice::<Claims>(&json) else {
        return false;
    };
    c.v == 1 && c.app == cfg.app && c.room == cfg.room && c.iat >= cfg.since
}
