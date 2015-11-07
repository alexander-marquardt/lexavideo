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

import re
from video_src import constants

# Solution for converting dictionaries between camelCase and snake_case taken from StackOverflow.
# See http://stackoverflow.com/questions/17156078/converting-identifier-naming-between-camelcase-and-underscores-during-json-seria
# For more background, see https://docs.python.org/2/howto/regex.html (look at the "Search and Replace" section).
camel_pat = re.compile(r'([A-Z])')
under_pat = re.compile(r'_([a-z])')

def underscore_to_camel(name):

    # Note:  The replacement function is called for every non-overlapping occurrence of pattern.
    # On each call, the function is passed a match object argument for the match and can use this information to
    # compute the desired replacement string and return it.
    return under_pat.sub(lambda match: match.group(1).upper(), name)

def camel_to_underscore(name):
    return camel_pat.sub(lambda x: '_' + x.group(1).lower(), name)

def convert_dict(input_dict, convert_fn):
    # pass in one of camel_to_underscore or underscore_to_camel as convert_fn.
    new_d = {}
    for k, v in input_dict.iteritems():
        new_d[convert_fn(k)] = convert_dict(v,convert_fn) if isinstance(v, dict) else v
    return new_d


def get_locale_from_accept_language_header(request):

    locale_header = request.headers.get('Accept-Language')
    if locale_header:
        locale_header = locale_header.replace(' ', '')
        # Extract all locales and their preference (q)
        locales = []  # e.g. [('es', 1.0), ('en-US', 0.8), ('en', 0.6)]
        for locale_str in locale_header.split(','):
            locale_parts = locale_str.split(';q=')
            locale = locale_parts[0]
            if len(locale_parts) > 1:
                locale_q = float(locale_parts[1])
            else:
                locale_q = 1.0
            locales.append((locale, locale_q))

        # Sort locales according to preference
        locales.sort(key=lambda locale_tuple: locale_tuple[1], reverse=True)
        # Find first match. Note: we don't find the first "exact" match, we find the
        # first "best" match. In other words, if the user has specified 'es-ES', 'es-AR', and 'en' as
        # languages, but we only support 'en' and 'es', then we will show them the 'es' version of the
        # website, even though this is not an exact match to the language headers that they sent.
        for locale in locales:
            for supported_locale in constants.supported_locales:

                # Check if there is an exact match of the locale
                if locale[0].replace('-', '_').lower() == supported_locale.lower():
                    return supported_locale

                # Check if there is an approximate match of the locale (e.g. 'en' for 'en-GB')
                if locale[0].split('-')[0].lower() == supported_locale.lower():
                    return supported_locale

    return None


def get_locale_from_request(request):

    locale = request.get('locale')
    if locale: return locale

    locale = get_locale_from_accept_language_header(request)
    if locale: return locale

    # Set the locale to the default language, which is the first language listed in available_locales
    return constants.supported_locales[0]
