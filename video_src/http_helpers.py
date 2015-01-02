
import logging, json
from video_src import status_reporting


def set_http_json_response(response,  response_dict, http_status_code):
    response.headers['Content-Type'] = 'application/json'
    response.clear()
    response.write(json.dumps(response_dict))
    response.set_status(http_status_code)    


def set_http_ok_json_response(response, response_dict, http_status_code = 200):
    set_http_json_response(response, response_dict , http_status_code)    
    
    
def set_http_error_json_response(response, status_string, http_status_code):
    response_content = {
        'statusString' : status_string
    }    
    set_http_json_response(response, response_content, http_status_code)
    

def set_error_json_response_and_write_log(response, status_string, logging_function, http_status_code):
    status_reporting.log_call_stack_and_traceback(logging_function, extra_info = status_string)
    set_http_error_json_response(response, status_string , http_status_code)


def handle_404(request, response, exception):
    status_reporting.log_call_stack_and_traceback(logging.error)
    set_error_json_response_and_write_log(response,  'handle_404 - Page not found: %s' % request.path, logging.error, 404)


def handle_500(request, response, exception):
    status_reporting.log_call_stack_and_traceback(logging.error)
    set_error_json_response_and_write_log(response, 'handle_500 - Server error occured. Path: %s' % request.path, logging.error, 500)
        

