import time
import unittest
from bff.auth import create_session_ticket, verify_session_ticket, ALGORITHM
from jose import jwt
from bff.config import settings

class TestSessionAuth(unittest.TestCase):
    def test_valid_ticket_creation_and_verification(self):
        session_id = "sess-test-uuid-1234"
        ticket = create_session_ticket(session_id=session_id)
        self.assertIsInstance(ticket, str)

        claims = verify_session_ticket(ticket)
        self.assertIsNotNone(claims)
        self.assertEqual(claims["sub"], session_id)
        self.assertEqual(claims["iss"], "gecx-streaming-bff")
        self.assertEqual(claims["aud"], "gecx-web-client")
        self.assertEqual(claims["app_id"], settings.APP_ID)

    def test_expired_ticket_rejection(self):
        # Create an expired token (expired 10 seconds ago)
        now = int(time.time())
        expired_payload = {
            "sub": "sess-expired",
            "iss": "gecx-streaming-bff",
            "aud": "gecx-web-client",
            "iat": now - 100,
            "exp": now - 10,
        }
        expired_token = jwt.encode(expired_payload, settings.TICKET_SECRET_KEY, algorithm=ALGORITHM)

        claims = verify_session_ticket(expired_token)
        self.assertIsNone(claims)

    def test_invalid_signature_rejection(self):
        session_id = "sess-tampered"
        # Token signed with a different key
        fake_token = jwt.encode(
            {"sub": session_id, "iss": "gecx-streaming-bff", "aud": "gecx-web-client"},
            "wrong-secret-key-12345678901234567890",
            algorithm=ALGORITHM
        )

        claims = verify_session_ticket(fake_token)
        self.assertIsNone(claims)

if __name__ == "__main__":
    unittest.main()
