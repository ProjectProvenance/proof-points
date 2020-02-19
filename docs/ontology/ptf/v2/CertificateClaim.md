## CertificateClaim

Asserts that the subject holds an instance of the specified certificate type.

`type`: `https://open.provenance.org/ontology/ptf/v2/CertificateClaim`

`credentialSubject`:
```
{
    id: "https://provenance.org/users/example",
    certificate-type: "https://example.com/example-certification"
}
```

`certificate-type` should be an identifier for a type of certificate. Ideally it should also be a URI that resolves to a document giving further information about the type of certificate.