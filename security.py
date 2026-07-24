# Security Configuration Module

# Toggle this flag to easily turn abuse prevention on or off for local testing.
ABUSE_PREVENTION_ENABLED = True

# The absolute maximum concurrency allowed, preventing SSRF attacks.
MAX_CONCURRENCY = 50

# Hard engine limits to prevent CPU exhaustion and billing surprises
MAX_URLS = 400
MAX_TIMEOUT = 60

# Daily Quota to protect database write limits
DAILY_SCAN_LIMIT = 10

# Domains known to block bots aggressively, massive domains we shouldn't scan, and private IP blocks (SSRF)
BLOCKLIST = {
    'linkedin.com',
    'facebook.com',
    'twitter.com',
    'x.com',
    'instagram.com',
    'amazon.com',
    'apple.com',
    # SSRF Protection
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254'
}

def get_safe_concurrency(requested_concurrency: int) -> int:
    """Returns the requested concurrency capped at the maximum allowed if abuse prevention is enabled."""
    if not ABUSE_PREVENTION_ENABLED:
        return requested_concurrency
    return min(requested_concurrency, MAX_CONCURRENCY)

def is_domain_blocked(url: str) -> bool:
    """Checks if a URL belongs to a blocklisted domain."""
    if not ABUSE_PREVENTION_ENABLED:
        return False
        
    for blocked_domain in BLOCKLIST:
        # A simple check: if the blocked domain is in the URL (this catches subdomains too)
        # For a more robust check, we could use urllib.parse.urlparse and check the netloc
        if blocked_domain in url:
            return True
    return False
