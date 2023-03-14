Configuration for official test environment of BankID. You need
to provide `personal.json`

```json
{
  "personalNumber": "1234"
}
```

replacing `"1234"` with the personal number that you chose when
you issued a BankID for test.

[Skatteverket issues personal numbers for test purposes.](https://www7.skatteverket.se/portal/apier-och-oppna-data/utvecklarportalen/oppetdata/Test%C2%AD%C2%ADpersonnummer) These are only valid for test environments
and won't collide with real people. 

Here we use one such personal number in tests against the official BankID test environment, `201701122382`. 