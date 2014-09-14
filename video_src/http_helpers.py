
import logging, json
from video_src import status_reporting

    
def set_http_response(response, status, error_status):
    
    response_content = {'errorStatus' : error_status}    
    response.headers['Content-Type'] = 'application/json'   
    response.write(json.dumps(response_content))
    response.set_status(status)


def set_response_and_write_log(response, status,  error_status, logging_function = logging.error):
    status_reporting.log_call_stack_and_traceback(logging_function, extra_info = error_status)
    set_http_response(response, status, error_status)


def handle_404(request, response, exception):
    status_reporting.log_call_stack_and_traceback(logging.error)
    set_response_and_write_log(response,  404, "handle_404 - Page not found: %s" % request.path)

def handle_500(request, response, exception):
    status_reporting.log_call_stack_and_traceback(logging.error)
    set_response_and_write_log(response, 500, 'handle_500 - Server error occured. Path: %s' % request.path)
        

