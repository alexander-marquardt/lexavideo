from abc import ABCMeta, abstractmethod
from contextlib import contextmanager
from threading import local


class Pool(object):
    """ABC for client pools.
    """

    __metaclass__ = ABCMeta

    def __init__(self, client_factory, *client_args, **client_kwargs):
        self.client_factory = client_factory
        self.client_args = client_args
        self.client_kwargs = client_kwargs

    @abstractmethod
    @contextmanager
    def reserve(self):  # pragma: no cover
        raise NotImplementedError


class ThreadLocalPool(Pool):
    """A pool whose clients are thread-mapped.
    """

    state = local()

    @contextmanager
    def reserve(self):
        client = getattr(self.state, "client", None)
        if client is None:
            self.state.client = client = self.client_factory(
                *self.client_args, **self.client_kwargs
            )

        yield client
