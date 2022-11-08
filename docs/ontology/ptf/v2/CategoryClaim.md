## CategoryClaim

A generic Proof Point type that can be used to describe many types of claim, as specified by the `category` field. The Proof Point contains a human readable statement describing the nature of the claim, a list of human readable `initiatives` describing steps that were taken to reach eligibility for the claim, a reference to a `verifier` organization that was supposedly used to verify the claim and optionally a geographic `location` associated with the claim.

`type`: `https://open.provenance.org/ontology/ptf/v2/CategoryClaim`

`credentialSubject`:

```
[{
  id: "https://provenance.org/users/example",
  category: "example category",
  location: "???",
  verifier: {
    name: "example name",
    type: "example type",
    href: "https://www.provenance.org/users/example"
  },
  evidence: {
    description: "example description",
    type_label: "example type label",
    url: "http://example.com",
    attachment: "http://example.com"
  }
}]
```
