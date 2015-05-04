
import webapp2, logging, json

from video_src import constants
from video_src import http_helpers

from video_src.error_handling import handle_exceptions


class LogClientError(webapp2.RequestHandler):
    
    
    
    def format_main_response(self):
        content = json.loads(self.request.body)       
        str_list = ['\n\n\n\n\n' + constants.long_star_separator]
        str_list.append('*** Javascript Browser Error ***')
        for key, value in content.iteritems():
            string = key + ': ' + str(value)
            string = string.replace('\\t', '\t')
            string = string.replace('\\n', '\n')
            str_list.extend(string.split('\n'))
                
        if 'errorMessage' in content:
            # Show the main error message at the very top so that it appears in the log summary on the server.
            str_list.insert(0, str(content['errorMessage']))
        elif 'errorUrl' in content:
            str_list.insert(0, str(content['errorUrl']))
        else:
            str_list.insert(0, '\n')
            
            
        str_list.append(constants.long_star_separator)
        return '\n'.join(str_list) + '\n\n\n\n\n'

     
    @handle_exceptions
    def post(self): 
        
        client_error_string = self.format_main_response()
        logging.error(client_error_string)
        http_helpers.set_http_ok_json_response(self.response, {})

