"""Tests for the Microsoft browser hijack collector's proxy bypass list.

Validates that all critical Microsoft auth domains are present in
MS_AUTH_BYPASS_DOMAINS, and that the bypass list handling works correctly.
"""

from __future__ import annotations

import unittest


class TestMSAuthBypassDomains(unittest.TestCase):
    """Verify MS_AUTH_BYPASS_DOMAINS contains all required auth domains."""

    def setUp(self):
        from ninloader.collectors.microsoft.browser_hijack import (
            MS_AUTH_BYPASS_DOMAINS,
        )
        self.bypass_domains = MS_AUTH_BYPASS_DOMAINS

    def test_primary_auth_domains_present(self):
        """login.microsoftonline.com and login.live.com must be in bypass list."""
        self.assertIn("login.microsoftonline.com", self.bypass_domains)
        self.assertIn("login.live.com", self.bypass_domains)

    def test_auth_cdn_domains_present(self):
        """Auth CDN domains required for consent page assets."""
        required_cdns = [
            "aadcdn.msftauth.net",
            "logincdn.msftauth.net",
            "aadcdn.msauth.net",
        ]
        for domain in required_cdns:
            with self.subTest(domain=domain):
                self.assertIn(domain, self.bypass_domains)

    def test_wildcard_patterns_present(self):
        """Wildcard patterns for Microsoft auth domains."""
        wildcards = [
            "*.microsoft.com",
            "*.live.com",
            "*.microsoftonline.com",
            "*.msftauth.net",
            "*.msauth.net",
        ]
        for pattern in wildcards:
            with self.subTest(pattern=pattern):
                self.assertIn(pattern, self.bypass_domains)

    def test_localhost_in_bypass(self):
        """localhost and 127.0.0.1 must bypass the dead proxy for redirect capture."""
        self.assertIn("localhost", self.bypass_domains)
        self.assertIn("127.0.0.1", self.bypass_domains)

    def test_bypass_list_is_tuple(self):
        """Bypass list should be an immutable tuple (not a mutable list)."""
        self.assertIsInstance(self.bypass_domains, tuple)

    def test_no_empty_entries(self):
        """No empty strings in the bypass list."""
        for domain in self.bypass_domains:
            self.assertTrue(domain.strip(), f"Empty or whitespace-only entry found: {domain!r}")

    def test_no_duplicates(self):
        """No duplicate entries in the bypass list."""
        seen = set()
        duplicates = []
        for domain in self.bypass_domains:
            if domain in seen:
                duplicates.append(domain)
            seen.add(domain)
        self.assertEqual(
            duplicates, [],
            f"Duplicate entries found: {duplicates}",
        )

    def test_bypass_list_not_empty(self):
        """Bypass list must contain entries."""
        self.assertGreater(len(self.bypass_domains), 0)

    def test_bypass_list_comma_join(self):
        """The bypass list can be joined with commas for Chrome's --proxy-bypass-list flag."""
        result = ",".join(self.bypass_domains)
        self.assertIsInstance(result, str)
        self.assertGreater(len(result), 0)
        # No commas within individual entries (would break Chrome's parsing)
        for domain in self.bypass_domains:
            self.assertNotIn(",", domain, f"Domain contains comma: {domain!r}")

    def test_all_five_required_domains(self):
        """All five critical Microsoft auth domains required by the task spec."""
        required = [
            "login.microsoftonline.com",
            "login.live.com",
            "aadcdn.msftauth.net",
            "logincdn.msftauth.net",
            "aadcdn.msauth.net",
        ]
        for domain in required:
            with self.subTest(domain=domain):
                self.assertIn(
                    domain,
                    self.bypass_domains,
                    f"Critical auth domain missing from bypass list: {domain}",
                )


class TestBypassListParsing(unittest.TestCase):
    """Test that bypass list values are well-formed for Chrome's proxy-bypass-list."""

    def setUp(self):
        from ninloader.collectors.microsoft.browser_hijack import (
            MS_AUTH_BYPASS_DOMAINS,
        )
        self.bypass_domains = MS_AUTH_BYPASS_DOMAINS

    def test_domains_are_strings(self):
        """Every entry must be a string."""
        for domain in self.bypass_domains:
            self.assertIsInstance(domain, str)

    def test_no_protocol_prefix(self):
        """Entries should be bare domains, not URLs with http:// or https://."""
        for domain in self.bypass_domains:
            self.assertFalse(
                domain.startswith("http://") or domain.startswith("https://"),
                f"Domain has protocol prefix: {domain!r}",
            )

    def test_no_trailing_slash(self):
        """Entries should not have trailing slashes."""
        for domain in self.bypass_domains:
            self.assertFalse(
                domain.endswith("/"),
                f"Domain has trailing slash: {domain!r}",
            )

    def test_no_port_numbers(self):
        """Entries should be bare domains without port numbers (except localhost)."""
        for domain in self.bypass_domains:
            if domain in ("localhost", "127.0.0.1"):
                continue
            self.assertNotIn(
                ":",
                domain,
                f"Domain has port number: {domain!r}",
            )

    def test_wildcard_format(self):
        """Wildcard entries should start with '*.' (standard Chrome format)."""
        for domain in self.bypass_domains:
            if "*" in domain:
                self.assertTrue(
                    domain.startswith("*."),
                    f"Wildcard domain has incorrect format: {domain!r}",
                )


if __name__ == "__main__":
    unittest.main()
