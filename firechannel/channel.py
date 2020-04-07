import base64
import logging
import string
import time
import uuid

from .credentials import build_token, decode_token
from .firebase import Firebase

_client = None
_logger = logging.getLogger("firechannel.channel")

#: Valid client id characters.
VALID_CHARS = set(string.ascii_letters + string.digits + "-_")


def get_client():
    """Get the current global client instance.

    If one doesn't currently exist, a default client will be created
    and returned on GAE and a RuntimeError will be raised everywhere
    else.

    Returns:
      Firebase
    """
    global _client
    if _client is None:
        try:
            from google.appengine.api import app_identity
            _client = Firebase(app_identity.get_application_id())
        except ImportError:
            raise RuntimeError("Cannot use default client off of AppEngine.")

    return _client


def set_client(client):
    """Set the global client instance.

    Parameters:
      client(Firebase)
    """
    global _client
    _client = client


def decode_client_id(token, firebase_client=None):
    """Given a token, decode and return its client id.
    """
    client = firebase_client or get_client()
    return decode_token(client.credentials, token)["uid"]


def _validate_client_id(client_id, firebase_client=None):
    if not isinstance(client_id, basestring):
        raise TypeError("client_id must be a string")

    elif client_id.count(".") == 2:
        return decode_client_id(client_id, firebase_client=firebase_client)

    elif len(client_id) > 64:
        raise ValueError("client_id must be at most 64 characters long")

    elif set(client_id) - VALID_CHARS:
        raise ValueError("client_id contains invalid characters")

    return client_id


def _validate_duration(duration_minutes):
    if not isinstance(duration_minutes, int):
        raise TypeError("duration_minutes must be an integer")

    elif not (1 <= duration_minutes <= 1440):
        raise ValueError("duration_minutes must be a value between 1 and 1440")


def create_channel(client_id=None, duration_minutes=60, firebase_client=None):
    """Create a channel.

    Parameters:
      client_id(str): A string to identify this channel in Firebase.
      duration_minutes(int): An int specifying the number of minutes
        for which the returned should be valid.
      firebase_client(Firebase): The Firebase client instance to
        use. This can be omitted on AppEngine.

    Raises:
      FirebaseError: When Firebase is down.
      TypeError: When client_id or duration_minutes have invalid types.
      ValueError: When client_id or duration_minutes have invalid values.

    Returns:
      str: A token that the client can use to connect to the channel.
    """
    if client_id is None:
        client_id = str(uuid.uuid4())

    client = firebase_client or get_client()
    client_id = _validate_client_id(client_id, firebase_client=client)
    _validate_duration(duration_minutes)

    # Delete the channel so any old data isn't sent to the client.
    delete_channel(client_id, firebase_client=client)
    return build_token(client.credentials, {"uid": client_id}, duration_minutes)


def delete_channel(client_id, firebase_client=None):
    """Delete a channel.

    Parameters:
      client_id(str): A string to identify this channel in Firebase.
      firebase_client(Firebase): The Firebase client instance to
        use. This can be omitted on AppEngine.

    Raises:
      FirebaseError: When Firebase is down.
      TypeError: When client_id has an invalid type.
      ValueError: When client_id has an invalid value.
    """
    client = firebase_client or get_client()
    client_id = _validate_client_id(client_id, firebase_client=client)
    client.delete(u"firechannels/{}.json".format(client_id))
    _logger.debug("Deleted channel %r.", client_id)


def send_message(client_id, message, firebase_client=None):
    """Send a message to a channel.

    Parameters:
      client_id(str): A string to identify this channel in Firebase.
      message(str): A string representing the message to send.
      firebase_client(Firebase): The Firebase client instance to
        use. This can be omitted on AppEngine.

    Raises:
      FirebaseError: When Firebase is down.
      TypeError: When client_id has an invalid type.
      ValueError: When client_id has an invalid value.
    """
    assert isinstance(message, basestring), "messages must be strings"
    client = firebase_client or get_client()
    client_id = _validate_client_id(client_id, firebase_client=client)
    client.patch(u"firechannels/{}.json".format(client_id), {
        "message": base64.b64encode(message),
        "timestamp": int(time.time() * 1000),
    })


def find_all_expired_channels(max_age=3600, firebase_client=None):
    """Returns the ids of any channels to which the last message was
    sent over some number of seconds ago.

    Parameters:
      max_age(int): Channels that were last sent a message longer than
        this value ago are returned.  Defaults to an hour.
    """
    client = firebase_client or get_client()
    cutoff = (time.time() - max_age) * 1000
    channels = client.get("firechannels.json") or {}
    for client_id, channel in channels.items():
        if not isinstance(channel, dict):
            yield client_id
            continue

        timestamp = channel.get("timestamp", 0)
        if timestamp <= cutoff:
            yield client_id
