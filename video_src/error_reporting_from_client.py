
import webapp2, logging, json

from video_src.error_handling import handle_exceptions


STAR_SEPERATOR = '********************************'

class LogClientError(webapp2.RequestHandler):
    
    
    
    def format_main_response(self):
        content = json.loads(self.request.body)       
        str_list = [STAR_SEPERATOR]
        str_list.append('*** Javascript Browser Error ***')
        for key, value in content.iteritems():
            string = key + ': ' + repr(value)
            str_list.extend(string.split('\\n'))
                
        if 'errorMessage' in content:
            # Show the main error message at the very top so that it appears in the log summary on the server.
            str_list.insert(0, content['errorMessage'])
        elif 'errorUrl' in content:
            str_list.insert(0, content['errorUrl'])
        else:
            str_list.insert(0, '\n')
            
            
        str_list.append(STAR_SEPERATOR)        
        return '\n'.join(str_list)

     
    @handle_exceptions
    def post(self): 
        
        client_error_string = self.format_main_response()
        logging.error(client_error_string)
        
        
