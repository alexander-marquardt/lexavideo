

import jinja2
import json
import vidsetup
import webapp2

from video_src import constants
from video_src import registration_and_login
from video_src import users

from video_src.error_handling import handle_exceptions


# We "hack" the directory that jinja looks for the template files so that it is always pointing to
# the correct location, irregardless of if we are in the debug or production build. 
# StrictUndefined means that jinja will raise an error if a template variable is used but has 
# not been defined - this is important for us because we may accidentaly attempt to use an angular template
# variable inside of jinja code, and this will notify us of the error.
jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(vidsetup.BASE_STATIC_DIR),
    undefined=jinja2.StrictUndefined)


def write_response(response, response_type, target_page, params):
    if response_type == 'json':
        content = json.dumps(params)
    else:
        template = jinja_environment.get_template(target_page)
        content = template.render(params)
    response.out.write(content)



class GetView(webapp2.RequestHandler):
    """ Render whatever template the client has requested """
    
    @handle_exceptions
    def get(self, current_template):   
        response_type = 'jinja'
        params = {}
        target_page = current_template
        write_response(self.response, response_type, target_page, params)


class ChatBox(webapp2.RequestHandler):
    
    @handle_exceptions
    def get(self, current_template, chat_room_name_from_url):
        user_agent = self.request.headers['User-Agent']


        # if 'user_id' in self.session:
        #     user_id = self.session['user_id']
        #     logging.debug('************* user_id is %s'  % user_id)
        # else:
        #     logging.debug('************* Not logged in!!! ')

        params = {
            'site_name_dot_com': constants.site_name_dot_com
        }
        
        # update the self.response with the current view
        template = jinja_environment.get_template(current_template)
        content = template.render(params)
        self.response.out.write(content)


class LandingPageMain(webapp2.RequestHandler):
    """ Render whatever template the client has requested """
    
    @handle_exceptions
    def get(self, current_template):
        response_type = 'jinja'

        params = {
            # The following is an object that passes variables to the javascript code.
            'serverLandingPageParamsJson': json.dumps(
                {'minRoomChars': constants.room_min_chars,
                 'maxRoomChars': constants.room_max_chars,
                 'chatRoomNameInvalidCharsForRegex': constants.chat_room_name_invalid_chars_regex,
                 })
            }

        target_page = current_template
        write_response(self.response, response_type, target_page, params)


class MainPage(registration_and_login.BaseHandler):
    """The main UI page, renders the 'index.html' template."""
    
    @handle_exceptions
    def get(self):



        # When a user first enters into our website, we will assign them a unique user id.
        user_obj = users.txn_create_new_user()

        target_page = 'index.html'
        response_type = 'jinja'
        params = {
            # Note: pass jinja variables using snake_case, and javascript variables using camelCase
            'site_name_dot_com': constants.site_name_dot_com,
            'site_name_for_display': constants.site_name_for_display,
            'userInfoEmbeddedInHtmlJson': json.dumps(
                {
                    'userName': user_obj.user_name,
                    'userId': user_obj.key.id(),
                    'debugBuildEnabled': vidsetup.DEBUG_BUILD,
                    'heartbeatIntervalMilliseconds': constants.heartbeatIntervalSeconds * 1000
                    }
            ),
            'enable_live_reload': vidsetup.ENABLE_LIVE_RELOAD,
            }

        write_response(self.response, response_type, target_page, params)        

