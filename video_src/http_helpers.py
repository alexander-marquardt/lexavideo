
import logging, json
from video_src import status_reporting

    
def set_http_response(response, status, message):
    
    response_content = {'errorMessage' : message}    
    response.headers['Content-Type'] = 'application/json'   
    response.write(json.dumps(response_content))
    response.set_status(status)


def set_response_and_write_log(response, status,  message, logging_function = logging.error):
    # If there is an unexpected/error condition or a problem with generating the http response, this file is a wrapper
    # that will set the response to a json object that contains the status and the message, as well as 
    # logging the stack and traceback. 
    status_reporting.log_call_stack_and_traceback(logging_function, extra_info = message)
    set_http_response(response, status, message)


def handle_404(request, response, exception):
    status_reporting.log_call_stack_and_traceback(logging.error)
    set_response_and_write_log(response,  404, "handle_404 - Page not found: %s" % request.path)

def handle_500(request, response, exception):
    status_reporting.log_call_stack_and_traceback(logging.error)
    set_response_and_write_log(response, 500, 'handle_500 - Server error occured. Path: %s' % request.path)
        

