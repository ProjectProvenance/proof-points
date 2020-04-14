
class VerySimpleEthrDidResolver {
  constructor() {
    this.resolve = async function(did) {
      return {
        '@context': 'https://w3id.org/did/v1',
        id: did,
        publicKey: [
          {
            id: `${did}#owner`,
            type: 'Secp256k1VerificationKey2018',
            owner: did,
            ethereumAddress: did.substr(9).toLowerCase()
          }
        ],
        authentication: [
          {
            type: 'Secp256k1SignatureAuthentication2018',
            publicKey: `${did}#owner`
          }
        ]
      };
    }
  }
}

module.exports = VerySimpleEthrDidResolver;
