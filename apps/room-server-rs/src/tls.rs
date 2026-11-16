//! rustls 材料加载：只接受证书链 + 私钥，错误在启动时直接返回。

use std::io::{BufReader, Cursor};
use std::sync::Arc;

use rustls::pki_types::{
    CertificateDer, PrivateKeyDer, PrivatePkcs1KeyDer, PrivatePkcs8KeyDer, PrivateSec1KeyDer,
};
use rustls::ServerConfig;
use tokio_rustls::TlsAcceptor;

#[derive(Debug, Clone)]
pub struct TlsMaterials {
    pub cert_pem: Vec<u8>,
    pub key_pem: Vec<u8>,
}

pub fn build_acceptor(materials: &TlsMaterials) -> Result<TlsAcceptor, String> {
    if materials.cert_pem.is_empty() || materials.key_pem.is_empty() {
        return Err("room TLS materials are empty".to_string());
    }
    // rustls 关闭了默认 provider，启动时显式安装 ring。
    let _ = rustls::crypto::ring::default_provider().install_default();

    let mut certificates: Vec<CertificateDer<'static>> = Vec::new();
    let mut private_key: Option<PrivateKeyDer<'static>> = None;
    let mut cert_reader = BufReader::new(Cursor::new(materials.cert_pem.as_slice()));
    while let Some(item) = rustls_pemfile::read_one(&mut cert_reader)
        .map_err(|error| format!("room TLS certificate is not valid PEM: {error}"))?
    {
        if let rustls_pemfile::Item::X509Certificate(der) = item {
            certificates.push(CertificateDer::from(der));
        }
    }
    let mut key_reader = BufReader::new(Cursor::new(materials.key_pem.as_slice()));
    while let Some(item) = rustls_pemfile::read_one(&mut key_reader)
        .map_err(|error| format!("room TLS private key is not valid PEM: {error}"))?
    {
        match item {
            rustls_pemfile::Item::PKCS8Key(der) => {
                private_key = Some(PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(der)));
            }
            rustls_pemfile::Item::RSAKey(der) => {
                private_key = Some(PrivateKeyDer::Pkcs1(PrivatePkcs1KeyDer::from(der)));
            }
            rustls_pemfile::Item::ECKey(der) => {
                private_key = Some(PrivateKeyDer::Sec1(PrivateSec1KeyDer::from(der)));
            }
            _ => {}
        }
    }
    let Some(private_key) = private_key else {
        return Err("room TLS requires a private key".to_string());
    };
    if certificates.is_empty() {
        return Err("room TLS requires a certificate".to_string());
    }
    let mut config = ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(certificates, private_key)
        .map_err(|_| "room TLS certificate and key do not form a valid pair".to_string())?;
    config.alpn_protocols = vec![b"http/1.1".to_vec()];
    Ok(TlsAcceptor::from(Arc::new(config)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_materials() {
        // TlsAcceptor 本身不实现 Debug，不能用 unwrap_err。
        let error = match build_acceptor(&TlsMaterials {
            cert_pem: Vec::new(),
            key_pem: Vec::new(),
        }) {
            Ok(_) => panic!("empty materials must fail"),
            Err(error) => error,
        };
        assert_eq!(error, "room TLS materials are empty");
    }

    #[test]
    fn rejects_garbage_pem() {
        let error = match build_acceptor(&TlsMaterials {
            cert_pem: b"not a certificate".to_vec(),
            key_pem: b"not a key".to_vec(),
        }) {
            Ok(_) => panic!("garbage must fail"),
            Err(error) => error,
        };
        assert!(error.contains("private key"));
    }
}
