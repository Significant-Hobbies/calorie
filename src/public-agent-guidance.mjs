const PRODUCT_ORIGIN = 'https://calorie.significanthobbies.com';

// Authored agent guidance shared by the legacy surface and generated index.
export const AGENT_GUIDANCE = `## When to use this

- Best fit: understanding Calorie as a private native journal for someone pursuing weight loss
- Best fit: checking how food timestamps and personal targets produce transparent fasting, exercise, and sleep estimates
- Best fit: confirming local-first privacy, optional Apple sync, internal-beta access, and current commercial state
- Not a fit: medical, nutrition, or weight-loss prescriptions
- Not a fit: barcode scanning, social feeds, wearable sync, or web-based diet tracking
- Not a fit: public App Store or TestFlight installation links

## Product

- [Home](${PRODUCT_ORIGIN}/): Native product landing
- [Privacy](${PRODUCT_ORIGIN}/privacy/): Local and cloud data handling
- [Support](${PRODUCT_ORIGIN}/support/): Product support
- [Beta status](${PRODUCT_ORIGIN}/testflight/): Honest distribution status
- [Journal articles](${PRODUCT_ORIGIN}/blog/): Calorie journal articles

## Machine surfaces

- [Agent catalog](${PRODUCT_ORIGIN}/api/ai)
- [AI catalog](${PRODUCT_ORIGIN}/.well-known/ai-catalog.json)
- [Agent Skill index](${PRODUCT_ORIGIN}/.well-known/agent-skills/index.json)
- [OpenAPI spec](${PRODUCT_ORIGIN}/openapi.json)
- [Homepage markdown](${PRODUCT_ORIGIN}/index.md)
- [Access and pricing](${PRODUCT_ORIGIN}/pricing.md)
- [Agent instructions](${PRODUCT_ORIGIN}/agents.md)
- [Calorie product-guide skill](${PRODUCT_ORIGIN}/skill.md)
- [This index](${PRODUCT_ORIGIN}/llms.txt)

## Developer docs

- [OpenAPI specification](${PRODUCT_ORIGIN}/openapi.json): Full API surface description (OpenAPI 3.1)
- [Agent catalog](${PRODUCT_ORIGIN}/api/ai): JSON inventory of public agent surfaces

## CLI

\`\`\`bash
# Fetch the agent catalog
curl -s ${PRODUCT_ORIGIN}/api/ai | jq .

# Get the OpenAPI spec
curl -s ${PRODUCT_ORIGIN}/openapi.json | jq .

# Fetch the homepage as markdown
curl -s -H 'Accept: text/markdown' ${PRODUCT_ORIGIN}/
\`\`\`
`;
