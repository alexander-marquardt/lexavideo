# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
# Documentation and additional information: http://www.lexavideo.com
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

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