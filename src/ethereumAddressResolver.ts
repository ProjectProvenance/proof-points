import { EthereumAddress } from "./ethereumAddress";
import { HttpClient } from "./httpClient";

export class EthereumAddressResolver {
  private _httpClient: HttpClient;

  public constructor(httpClient: HttpClient) {
    this._httpClient = httpClient;
  }

  /* Resolve a string ID to an Ethereum address.
   * The string must be either an Ethereum address or a did:web identifier
   * that can be resolved to an Ethereum address
   */
  public async resolve(addr: string): Promise<EthereumAddress> {
    if (/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      return EthereumAddress.parse(addr);
    }

    if (/^did\:web\:.+$/.test(addr)) {
      const didDocumentUri = this._didToUrl(addr);
      try {
        const body = await this._httpClient.fetch(didDocumentUri);
        const didDocument = JSON.parse(body);
        if (
          didDocument["@context"] !== "https://w3id.org/did/v1" ||
          didDocument.id !== addr ||
          typeof didDocument.publicKey === "undefined" ||
          didDocument.publicKey[0].type !== "Secp256k1VerificationKey2018" ||
          didDocument.publicKey[0].owner !== addr ||
          !/^0x[a-fA-F0-9]{40}$/.test(didDocument.publicKey[0].ethereumAddress)
        ) {
          // DID document is invalid or unsupported
          return null;
        }

        return EthereumAddress.parse(didDocument.publicKey[0].ethereumAddress);
      } catch (e) {
        // DID document could not be fetched
        return null;
      }
    }
  }

  /**
   * Did to url. Translate a did:web identifier to the URL at which the corresponding DID document can be found
   * according to spec at https://w3c-ccg.github.io/did-method-web/#crud-operation-definitions.
   * @param did a valid did:web ID string
   * @returns an https URL string representing the location of the corresponding DID document
   */
  private _didToUrl(did: string): string {
    const parts = did.split(":");
    if (parts.length === 3) {
      // did:web:<x>
      const hostname = decodeURIComponent(parts[2]);
      return `https://${hostname}/.well-known/did.json`;
    } else {
      // did:web:<a>:<b>:...:<z>
      const hostname = decodeURIComponent(parts[2]);
      const path = parts.slice(3).join("/");
      return `https://${hostname}/${path}/did.json`;
    }
  }
}
