
"""
This file is intended for testing the code. It allows us to simulate memcache misses.
Use this file to import memcache instead of importing memcache directly from google.appengine.api.
When you wish to simulate missed memcache, then set SIMULATE_MISSED_MEMCACHE_QUERIES to True.

"""
SIMULATE_MISSED_MEMCACHE_QUERIES = False

import logging
from google.appengine.api import memcache


def miss_get(memcache_key):
    logging.warning('*** WARNING *** Forcing miss on memcache get %s ' % memcache_key)
    return None

if SIMULATE_MISSED_MEMCACHE_QUERIES:
    memcache.get = miss_get