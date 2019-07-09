class FirebaseError(Exception):
    """Base class for Firebase errors.
    """

    def __init__(self, message, cause=None):
        self.message = message
        self.cause = cause

    def __str__(self):
        return self.message


class BadRequest(FirebaseError):
    """Raised on 4xx.
    """


class NotFound(BadRequest):
    """Raised on 404.
    """


class ServerError(FirebaseError):
    """Raised on 5xx.
    """


class ConnectionError(FirebaseError):
    """Raised on connection failure.
    """


class Timeout(FirebaseError):
    """Raised on connect or read timeout.
    """
