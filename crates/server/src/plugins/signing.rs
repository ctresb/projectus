//! Integrity and signature trust for plugin packages.
//!
//! Two independent checks live here. SHA-256 over the package bytes is the
//! mandatory integrity gate — it answers "are these the exact bytes the
//! manifest claims?" (`verify_package`). On top of that, an optional Ed25519
//! signature over the manifest answers "who vouches for this, and do we trust
//! them?" (`verify_signature`). MD5 is never accepted anywhere.
//!
//! Both checks collapse into a single [`TrustStatus`] the registry persists and
//! the install pipeline keys its enable/reject decision on. The publisher trust
//! chain is scaffolded ([`TrustedPublishers`]) but deliberately trusts nobody
//! yet — see the TODO on [`TrustedPublishers::is_trusted`].

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use ed25519_dalek::{Signature, VerifyingKey};
use ed25519_dalek::{PUBLIC_KEY_LENGTH, SIGNATURE_LENGTH};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::manifest::SignatureMeta;

/// The outcome of integrity + signature evaluation for a package.
///
/// Ordered loosely by trust: [`Builtin`](TrustStatus::Builtin) and
/// [`Verified`](TrustStatus::Verified) are the trusted-provenance states;
/// [`Mismatch`](TrustStatus::Mismatch) is fatal and the install pipeline must
/// refuse to enable on it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TrustStatus {
    /// A first-party plugin that ships inside the host build. Its provenance is
    /// the host itself, so it is trusted without an external package digest or
    /// publisher signature. Produced only by the builtin seeder
    /// (`registry::seed_builtins`), never by [`verify_package`] /
    /// [`verify_signature`], which only ever speak to externally sourced bytes.
    Builtin,
    /// Integrity matched and a valid signature from a trusted publisher.
    Verified,
    /// Integrity matched and the signature is cryptographically valid, but the
    /// signing publisher is not (yet) in the trust chain.
    SignedUntrusted,
    /// Integrity matched but the package carries no signature at all.
    Unsigned,
    /// SHA-256 did not match the expected digest, or a present signature failed
    /// to verify. Fatal: never enable a plugin in this state.
    Mismatch,
}

/// Lowercase hex SHA-256 of `bytes`. The single hashing helper the plugin
/// subsystem shares; mirrors the `hex::encode(Sha256::digest(..))` idiom already
/// used by `backup_r2` / `storage`.
pub fn sha256_hex(bytes: &[u8]) -> String {
    hex::encode(Sha256::digest(bytes))
}

/// Recompute SHA-256 over the package bytes and compare it to the digest the
/// manifest/lockfile declares.
///
/// A mismatch is [`TrustStatus::Mismatch`] (fatal). A match alone only proves
/// integrity, not provenance, so it resolves to [`TrustStatus::Unsigned`] — the
/// caller layers [`verify_signature`] on top to upgrade that verdict. The
/// comparison is case-insensitive on the hex but otherwise exact.
pub fn verify_package(bytes: &[u8], expected_sha256: &str) -> TrustStatus {
    let actual = sha256_hex(bytes);
    if actual.eq_ignore_ascii_case(expected_sha256.trim()) {
        TrustStatus::Unsigned
    } else {
        TrustStatus::Mismatch
    }
}

/// Verify the Ed25519 signature over `manifest_bytes` using the base64 public
/// key and signature carried in `sig`, then fold in publisher trust.
///
/// - Unsupported algorithm, malformed/wrong-length base64, or a failed
///   cryptographic check all collapse to [`TrustStatus::Mismatch`].
/// - A valid signature from a publisher the trust chain recognises is
///   [`TrustStatus::Verified`]; otherwise it is [`TrustStatus::SignedUntrusted`].
///
/// The signed message is the raw manifest bytes — the same bytes whose digest
/// the integrity block pins — so a valid signature also vouches for `package`
/// integrity transitively.
pub fn verify_signature(manifest_bytes: &[u8], sig: &SignatureMeta) -> TrustStatus {
    // Only Ed25519 is wired; anything else (including MD5-era schemes) is a hard
    // mismatch rather than a silent pass.
    if !sig.algorithm.eq_ignore_ascii_case("ed25519") {
        return TrustStatus::Mismatch;
    }

    let Some(verifying_key) = decode_verifying_key(&sig.public_key) else {
        return TrustStatus::Mismatch;
    };
    let Some(signature) = decode_signature(&sig.signature) else {
        return TrustStatus::Mismatch;
    };

    // `verify_strict` rejects weak/malleable keys in addition to bad signatures.
    if verifying_key.verify_strict(manifest_bytes, &signature).is_err() {
        return TrustStatus::Mismatch;
    }

    // Cryptographically sound. Whether we *trust* it depends on the publisher
    // chain, which is scaffolded and currently trusts nobody.
    if TrustedPublishers::default().is_trusted(&sig.publisher_identity) {
        TrustStatus::Verified
    } else {
        TrustStatus::SignedUntrusted
    }
}

/// Decode a base64 public key into a 32-byte Ed25519 verifying key, returning
/// `None` on any malformed/wrong-length/invalid-key input.
fn decode_verifying_key(public_key_b64: &str) -> Option<VerifyingKey> {
    let raw = BASE64_STANDARD.decode(public_key_b64.trim()).ok()?;
    let bytes: [u8; PUBLIC_KEY_LENGTH] = raw.try_into().ok()?;
    VerifyingKey::from_bytes(&bytes).ok()
}

/// Decode a base64 signature into a 64-byte Ed25519 signature, returning `None`
/// on any malformed/wrong-length input.
fn decode_signature(signature_b64: &str) -> Option<Signature> {
    let raw = BASE64_STANDARD.decode(signature_b64.trim()).ok()?;
    let bytes: [u8; SIGNATURE_LENGTH] = raw.try_into().ok()?;
    Some(Signature::from_bytes(&bytes))
}

/// Publisher trust chain. Resolves a manifest's `publisher_identity` to a
/// yes/no trust decision so a valid signature can be upgraded from
/// [`TrustStatus::SignedUntrusted`] to [`TrustStatus::Verified`].
///
/// This is a scaffold: there is no real registry/CA lookup wired yet, so the
/// default instance trusts nobody. Construct one explicitly when a populated
/// trust set becomes available.
#[derive(Debug, Default)]
pub struct TrustedPublishers {
    identities: Vec<String>,
}

impl TrustedPublishers {
    /// Build a trust set from a list of known-good publisher identities.
    pub fn new(identities: Vec<String>) -> Self {
        Self { identities }
    }

    /// Whether `identity` is a recognised, trusted publisher.
    ///
    // TODO: wire a real publisher registry / trust-chain lookup (signed
    // publisher manifest, pinned CA, or marketplace allow-list). Until then this
    // is false-by-default for every identity except those explicitly injected
    // via `new`, so an unknown signer never silently becomes `Verified`.
    pub fn is_trusted(&self, identity: &str) -> bool {
        !identity.is_empty() && self.identities.iter().any(|known| known == identity)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    #[test]
    fn sha256_hex_matches_known_vector() {
        // The canonical SHA-256 of the empty input.
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        // And the classic "abc" vector.
        assert_eq!(
            sha256_hex(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn verify_package_accepts_matching_digest() {
        let bytes = b"the exact package bytes";
        let digest = sha256_hex(bytes);
        assert_eq!(verify_package(bytes, &digest), TrustStatus::Unsigned);
    }

    #[test]
    fn verify_package_is_case_insensitive_on_hex() {
        let bytes = b"plugin.zip";
        let digest = sha256_hex(bytes).to_ascii_uppercase();
        assert_eq!(verify_package(bytes, &digest), TrustStatus::Unsigned);
    }

    #[test]
    fn verify_package_rejects_tampered_bytes() {
        let original = b"the exact package bytes";
        let digest = sha256_hex(original);
        let tampered = b"the exact package bytez";
        assert_eq!(verify_package(tampered, &digest), TrustStatus::Mismatch);
    }

    #[test]
    fn verify_package_rejects_unrelated_digest() {
        assert_eq!(
            verify_package(b"anything", "not-a-real-digest"),
            TrustStatus::Mismatch
        );
    }

    /// Build a `SignatureMeta` by really signing `message` with a fresh key,
    /// optionally tagging a publisher identity.
    fn sign_meta(signing_key: &SigningKey, message: &[u8], publisher: &str) -> SignatureMeta {
        let signature = signing_key.sign(message);
        SignatureMeta {
            algorithm: "ed25519".to_owned(),
            public_key: BASE64_STANDARD.encode(signing_key.verifying_key().to_bytes()),
            signature: BASE64_STANDARD.encode(signature.to_bytes()),
            publisher_identity: publisher.to_owned(),
            verified_publisher: false,
        }
    }

    fn deterministic_key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    #[test]
    fn verify_signature_valid_but_untrusted_publisher() {
        let key = deterministic_key();
        let manifest = b"{\"id\":\"notes\",\"version\":\"1.0.0\"}";
        let meta = sign_meta(&key, manifest, "projectus");
        assert_eq!(
            verify_signature(manifest, &meta),
            TrustStatus::SignedUntrusted
        );
    }

    #[test]
    fn verify_signature_rejects_tampered_manifest() {
        let key = deterministic_key();
        let signed = b"{\"id\":\"notes\",\"version\":\"1.0.0\"}";
        let meta = sign_meta(&key, signed, "projectus");
        let tampered = b"{\"id\":\"notes\",\"version\":\"6.6.6\"}";
        assert_eq!(verify_signature(tampered, &meta), TrustStatus::Mismatch);
    }

    #[test]
    fn verify_signature_rejects_wrong_key() {
        let key = deterministic_key();
        let manifest = b"manifest bytes";
        let mut meta = sign_meta(&key, manifest, "projectus");
        // Swap in a different key's public bytes; the signature no longer checks.
        let other = SigningKey::from_bytes(&[9u8; 32]);
        meta.public_key = BASE64_STANDARD.encode(other.verifying_key().to_bytes());
        assert_eq!(verify_signature(manifest, &meta), TrustStatus::Mismatch);
    }

    #[test]
    fn verify_signature_rejects_non_ed25519_algorithm() {
        let key = deterministic_key();
        let manifest = b"manifest bytes";
        let mut meta = sign_meta(&key, manifest, "projectus");
        meta.algorithm = "md5".to_owned();
        assert_eq!(verify_signature(manifest, &meta), TrustStatus::Mismatch);
    }

    #[test]
    fn verify_signature_rejects_malformed_base64() {
        let meta = SignatureMeta {
            algorithm: "ed25519".to_owned(),
            public_key: "!!!not base64!!!".to_owned(),
            signature: "@@@".to_owned(),
            publisher_identity: "projectus".to_owned(),
            verified_publisher: false,
        };
        assert_eq!(verify_signature(b"anything", &meta), TrustStatus::Mismatch);
    }

    #[test]
    fn builtin_trust_status_serializes_kebab_case() {
        // The frontend mirror keys on the exact kebab wire strings.
        assert_eq!(
            serde_json::to_value(TrustStatus::Builtin).unwrap(),
            serde_json::json!("builtin")
        );
        assert_eq!(
            serde_json::from_value::<TrustStatus>(serde_json::json!("builtin")).unwrap(),
            TrustStatus::Builtin
        );
    }

    #[test]
    fn verify_helpers_never_produce_builtin() {
        // `Builtin` is a host-only provenance state; the package/signature
        // verifiers only ever speak to externally sourced bytes and must never
        // fabricate it.
        let bytes = b"external package bytes";
        let digest = sha256_hex(bytes);
        assert_ne!(verify_package(bytes, &digest), TrustStatus::Builtin);
        assert_ne!(verify_package(bytes, "wrong"), TrustStatus::Builtin);

        let key = deterministic_key();
        let manifest = b"manifest bytes";
        let meta = sign_meta(&key, manifest, "projectus");
        assert_ne!(verify_signature(manifest, &meta), TrustStatus::Builtin);
    }

    #[test]
    fn trusted_publishers_default_trusts_nobody() {
        let trust = TrustedPublishers::default();
        assert!(!trust.is_trusted("projectus"));
        assert!(!trust.is_trusted(""));
    }

    #[test]
    fn trusted_publishers_can_be_seeded() {
        let trust = TrustedPublishers::new(vec!["projectus".to_owned()]);
        assert!(trust.is_trusted("projectus"));
        assert!(!trust.is_trusted("someone-else"));
        assert!(!trust.is_trusted(""));
    }
}
