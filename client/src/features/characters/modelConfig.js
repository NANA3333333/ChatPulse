export function hasPrimaryModelConfig(contact = {}) {
  return Boolean(
    String(contact.api_endpoint || '').trim()
    && contact.api_key_configured === true
    && String(contact.model_name || '').trim()
  );
}
