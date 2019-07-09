import hmac
import json
import time

from base64 import b64encode, b64decode
from oauth2client.client import GoogleCredentials



from google.appengine.api import app_identity
from oauth2client.contrib.appengine import AppAssertionCredentials

ON_APPENGINE = True


def encode(data):
    return b64encode(json.dumps(data, separators=(",", ":")))


def decode(data):
    return json.loads(b64decode(data))


#: The OAuth2 scopes to request when authenticating with Google.
SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/firebase.database"
]

#: The endpoint used to verify identities.
IDENTITY_ENDPOINT = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit"


#: The standard token header.
TOKEN_HEADER = encode({"typ": "JWT", "alg": "RS256"})


def get_appengine_credentials():
    """Generates a credentials object for the current environment.

    Returns:
      GoogleCredentials
    """
    return AppAssertionCredentials(SCOPES)


def get_service_key_credentials(key_file_path):
    """Generate a credentials object from a service key.

    Parameters:
      key_file_path(str): The absolute path to a service key file.

    Returns:
      GoogleCredentials
    """
    credentials = GoogleCredentials.from_stream(key_file_path)
    credentials._scopes = " ".join(SCOPES)
    return credentials


def _build_token(credentials, issuer, params, duration_minutes):
    issued_at = int(time.time())

    data = {
        "iss": issuer,
        "sub": issuer,
        "aud": IDENTITY_ENDPOINT,
        "iat": issued_at,
        "exp": issued_at + duration_minutes * 60,
    }
    data.update(params)

    payload = TOKEN_HEADER + "." + encode(data)
    _, signature = credentials.sign_blob(payload)
    return payload + "." + b64encode(signature)


def build_token_appengine(credentials, params, duration_minutes):
    """Build a token on AppEngine.
    """
    if isinstance(credentials, AppAssertionCredentials):
        issuer = app_identity.get_service_account_name()
        return _build_token(app_identity, issuer, params, duration_minutes)
    return build_token_service_key(credentials, params, duration_minutes)


def build_token_service_key(credentials, params, duration_minutes):
    """Build a token using a service key.
    """
    issuer = credentials._service_account_email
    return _build_token(credentials, issuer, params, duration_minutes)


def _decode_token(credentials, token, verify):
    try:
        header, data, signature = map(str, token.split("."))
    except ValueError:
        raise ValueError("Invalid token data.")

    if header != TOKEN_HEADER:
        raise ValueError("Invalid token header.")

    if verify:
        payload = header + "." + data
        given_signature = b64decode(signature)
        _, expected_signature = credentials.sign_blob(payload)
        if not hmac.compare_digest(given_signature, expected_signature):
            raise ValueError("Invalid token signature.")

    return decode(data)


def decode_token_appengine(credentials, token, verify=False):
    """Decode a token on AppEngine.

    Warning:
      Token verification is disabled on GAE.
    """
    if isinstance(credentials, AppAssertionCredentials):
        return _decode_token(app_identity, token, False)
    return _decode_token(credentials, token, False)


def decode_token_service_key(credentials, token, verify=True):
    """Decode a token on AppEngine.
    """
    return _decode_token(credentials, token, verify)


if ON_APPENGINE:
    get_credentials = get_appengine_credentials
    build_token = build_token_appengine
    decode_token = decode_token_appengine
else:
    get_credentials = get_service_key_credentials
    build_token = build_token_service_key
    decode_token = decode_token_service_key
