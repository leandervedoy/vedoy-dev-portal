# Vedoy Standalone Tools

32 working endpoints; no database, vendor credentials, outbound requests or paid services.

## Run independently

Node.js 22+ (portal targets Node 26):

```sh
node lib/standalone-server.mjs
node --test tests/standalone-tools.test.mjs
curl http://127.0.0.1:8787/api/v1/tools
curl -X POST http://127.0.0.1:8787/api/v1/tools/text/slug -H 'Content-Type: application/json' -d '{"text":"Blåbær"}'
```

In Vercel, existing /api/v1 rewrites use lazy gateways: tools do not import the legacy database module. Existing non-tool routes retain their legacy implementations.

GET /api/v1/tools returns examples and limits. GET /api/v1/tools/openapi is a separate OpenAPI document; the existing platform specification remains unchanged. POST results are wrapped in {data:...}. Errors use {error:{code,message}}. OPTIONS supports browser calls without credentials.

## Limits and scope

64 KiB JSON request, 200 KB result, maximum 1000 input array items, 50000 characters per string. No persistent state, authentication, metering, billing or distributed rate limiting. Use hosting-level traffic controls for a public launch. No input logging. Outputs are never fetched or executed. HTML escaping is context-limited and is not an HTML sanitizer. SHA-256 is not password hashing. Test records are synthetic. Email/phone/postcode checks do not confirm existence; organization checks verify only checksum. Geo distance is spherical, not routing; bounding boxes do not optimize antimeridian crossings. Dates use UTC; weekdays do not remove public holidays. CSV uses commas and arrays, not automatic header coercion. Duplicate JSON comparison is key-order-sensitive.

## Endpoints

### text/normalize

Trim and collapse whitespace; Unicode NFC.

POST /api/v1/tools/text/normalize

```json
{
  "text": "  Hei   verden "
}
```

### text/slug

Create a Norwegian-friendly URL slug.

POST /api/v1/tools/text/slug

```json
{
  "text": "Blåbær og øyer"
}
```

### text/stats

Count Unicode code points, words and lines.

POST /api/v1/tools/text/stats

```json
{
  "text": "Hei verden"
}
```

### text/escape-html

Escape text for HTML text/quoted attribute contexts.

POST /api/v1/tools/text/escape-html

```json
{
  "text": "<hello>"
}
```

### text/truncate

Truncate by Unicode code points.

POST /api/v1/tools/text/truncate

```json
{
  "text": "Hello world",
  "length": 5
}
```

### validate/email

Basic email syntax check; no mailbox verification.

POST /api/v1/tools/validate/email

```json
{
  "email": "hello@example.com"
}
```

### validate/url

Check absolute HTTP(S) URL syntax; performs no fetch.

POST /api/v1/tools/validate/url

```json
{
  "url": "https://example.com"
}
```

### validate/organization-number

Norwegian organization number checksum; no registry lookup.

POST /api/v1/tools/validate/organization-number

```json
{
  "value": "974760673"
}
```

### validate/e164

International phone syntax only; no ownership check.

POST /api/v1/tools/validate/e164

```json
{
  "value": "+4791234567"
}
```

### validate/postcode-no

Norwegian postcode syntax; no postal register lookup.

POST /api/v1/tools/validate/postcode-no

```json
{
  "value": "5517"
}
```

### validate/required-fields

Check required top-level fields.

POST /api/v1/tools/validate/required-fields

```json
{
  "data": {
    "name": "Ada"
  },
  "fields": [
    "name",
    "email"
  ]
}
```

### data/deduplicate

Remove exact duplicate JSON values; object key order is significant.

POST /api/v1/tools/data/deduplicate

```json
{
  "items": [
    1,
    1,
    2
  ]
}
```

### data/paginate

Paginate a supplied array.

POST /api/v1/tools/data/paginate

```json
{
  "items": [
    1,
    2,
    3
  ],
  "page": 1,
  "pageSize": 2
}
```

### data/describe

Describe top-level types in a supplied JSON object.

POST /api/v1/tools/data/describe

```json
{
  "data": {
    "name": "Ada",
    "age": 30
  }
}
```

### json/format

Parse and pretty-print JSON.

POST /api/v1/tools/json/format

```json
{
  "text": "{\"ok\":true}"
}
```

### json/validate

Check JSON syntax.

POST /api/v1/tools/json/validate

```json
{
  "text": "{\"ok\":true}"
}
```

### csv/parse

Parse comma-separated CSV into arrays; quoted newlines supported.

POST /api/v1/tools/csv/parse

```json
{
  "text": "name,age\r\nAda,30"
}
```

### csv/stringify

Convert arrays into quoted CSV. Formula protection enabled by default.

POST /api/v1/tools/csv/stringify

```json
{
  "rows": [
    [
      "name",
      "age"
    ],
    [
      "Ada",
      30
    ]
  ]
}
```

### encoding/base64-encode

Encode UTF-8 text.

POST /api/v1/tools/encoding/base64-encode

```json
{
  "text": "Hei 👋"
}
```

### encoding/base64-decode

Decode canonical Base64 containing valid UTF-8.

POST /api/v1/tools/encoding/base64-decode

```json
{
  "base64": "SGVp"
}
```

### encoding/url-encode

Encode a URL component.

POST /api/v1/tools/encoding/url-encode

```json
{
  "text": "hei verden"
}
```

### encoding/url-decode

Decode a URL component.

POST /api/v1/tools/encoding/url-decode

```json
{
  "text": "hei%20verden"
}
```

### hash/sha256

SHA-256 digest of UTF-8 text. Not password storage or encryption.

POST /api/v1/tools/hash/sha256

```json
{
  "text": "hello"
}
```

### ids/uuid

Generate random UUID v4 identifiers.

POST /api/v1/tools/ids/uuid

```json
{
  "count": 2
}
```

### test/records

Generate explicitly synthetic records without real contact details.

POST /api/v1/tools/test/records

```json
{
  "count": 2
}
```

### geo/distance

Great-circle distance in metres; not road distance.

POST /api/v1/tools/geo/distance

```json
{
  "from": [
    5.27,
    59.41
  ],
  "to": [
    5.32,
    59.43
  ]
}
```

### geo/radius

Check whether a coordinate lies within a radius.

POST /api/v1/tools/geo/radius

```json
{
  "center": [
    5.27,
    59.41
  ],
  "point": [
    5.28,
    59.42
  ],
  "radiusMeters": 2000
}
```

### geo/bbox

Bounding box of supplied coordinates; no antimeridian optimization.

POST /api/v1/tools/geo/bbox

```json
{
  "points": [
    [
      5,
      59
    ],
    [
      6,
      60
    ]
  ]
}
```

### dates/add-days

Add UTC calendar days.

POST /api/v1/tools/dates/add-days

```json
{
  "date": "2026-11-09",
  "days": 7
}
```

### dates/difference

Signed difference in UTC calendar days: to minus from.

POST /api/v1/tools/dates/difference

```json
{
  "from": "2026-11-09",
  "to": "2026-11-16"
}
```

### dates/weekdays

List Monday-Friday dates inclusive. Does not exclude holidays.

POST /api/v1/tools/dates/weekdays

```json
{
  "from": "2026-11-09",
  "to": "2026-11-15"
}
```

### numbers/statistics

Count, sum, mean, minimum and maximum.

POST /api/v1/tools/numbers/statistics

```json
{
  "values": [
    1,
    2,
    3
  ]
}
```
