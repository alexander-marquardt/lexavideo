

import jinja2
import json
import build_config
import webapp2

from video_src import constants
from video_src.error_handling import handle_exceptions


# We "hack" the directory that jinja looks for the template files so that it is always pointing to
# the correct location, irregardless of if we are in the debug or production build. 
# StrictUndefined means that jinja will raise an error if a template variable is used but has 
# not been defined - this is important for us because we may accidentaly attempt to use an angular template
# variable inside of jinja code, and this will notify us of the error.
jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(build_config.BASE_STATIC_DIR),
    undefined=jinja2.StrictUndefined)


def write_jinja_response(response, target_page, params):

    template = jinja_environment.get_template(target_page)
    content = template.render(params)
    response.out.write(content)
    response.set_status(200)


class GetView(webapp2.RequestHandler):
    """ Render whatever template the client has requested """
    
    @handle_exceptions
    def get(self, current_template):

        target_page = current_template
        write_jinja_response(self.response, target_page, {})


class GetRegistrationView(webapp2.RequestHandler):
    """ Render whatever template the client has requested """

    @handle_exceptions
    def get(self, current_template):

        target_page = current_template
        write_jinja_response(self.response, target_page, {})


class LandingPageMain(webapp2.RequestHandler):
    """ Render whatever template the client has requested """
    
    @handle_exceptions
    def get(self, current_template):

        params = {
            # The following is an object that passes variables to the javascript code.
            'serverLandingPageParamsJson': json.dumps(
                {'minRoomChars': constants.room_min_chars,
                 'maxRoomChars': constants.room_max_chars,
                 'chatRoomNameInvalidCharsForRegex': constants.chat_room_name_invalid_chars_regex,
                 })
            }

        target_page = current_template
        write_jinja_response(self.response, target_page, params)


class MainPage(webapp2.RequestHandler):
    """The main UI page, renders the 'index.html' template."""
    
    @handle_exceptions
    def get(self):


        target_page = 'index.html'
        params = {
            # Note: pass jinja variables using snake_case, and javascript variables using camelCase
            'site_name_dot_com': constants.site_name_dot_com,
            'site_name_for_display': constants.site_name_for_display,
            'userInfoEmbeddedInHtmlJson': json.dumps(
                {
                    'debugBuildEnabled': build_config.DEBUG_BUILD,
                    'heartbeatIntervalMilliseconds': constants.heartbeat_interval_seconds * 1000,
                    'usernameMaxChars': constants.username_max_chars,
                    'usernameMinChars': constants.username_min_chars,
                    'usernameInvalidCharsForRegex': constants.username_invalid_chars_regex,
                }
            ),
            'enable_live_reload': build_config.ENABLE_LIVE_RELOAD,
            }

        write_jinja_response(self.response, target_page, params)        

