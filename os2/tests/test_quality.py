import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from secret_guard import scan_patch
from health_probe import validate


class SecretGuardTests(unittest.TestCase):
    def test_detects_added_secret_without_exposing_value(self):
        token = "a" * 38
        patch = '+++ b/api/handler.js\n+const NOTIFY_SECRET = "' + token + '";\n'
        issues = scan_patch(patch)
        self.assertEqual([("api/handler.js", "credential literal")], issues)
        self.assertNotIn(token, repr(issues))

    def test_ignores_removed_lines_and_public_paths(self):
        patch = '+++ b/README.md\n-const API_KEY = "' + ("b" * 36) + '";\n+const note = "not a secret";\n'
        self.assertEqual([], scan_patch(patch))

    def test_detects_bare_key_assignment(self):
        patch = '+++ b/handler.js\n+const KEY = "' + ('c' * 40) + '";\n'
        self.assertEqual([('handler.js', 'credential literal')], scan_patch(patch))

    def test_detects_private_key_header(self):
        self.assertEqual([("server/key.txt.md", "private key block")],
                         scan_patch("+++ b/server/key.txt.md\n+-----BEGIN PRIVATE KEY-----\n"))

    def test_detects_known_token(self):
        patch = '+++ b/config.js\n+const accidental = "ghp_' + ("A" * 28) + '";\n'
        self.assertEqual([("config.js", "known token format")], scan_patch(patch))


class HealthTests(unittest.TestCase):
    def test_valid_html(self):
        self.assertTrue(validate(200, "<!doctype html><html><title>маркетинговое агентство</title></html>", "маркетинговое агентство"))

    def test_blocked_content_not_counted_as_uptime(self):
        self.assertFalse(validate(200, "<html>access blocked</html>", "маркетинговое агентство"))

    def test_non_success_http(self):
        self.assertFalse(validate(503, "<html>маркетинговое агентство</html>", "маркетинговое агентство"))


if __name__ == "__main__":
    unittest.main()
