from video_src import http_helpers, status_reporting
import logging, functools



def handle_function_exceptions(func):
    # decorator for catching errors in functions.
    # Use by inserting @handle_function_exceptions before function definition
    
    # wrap a method inside a try/except block
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:
            message = "serverError"
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = message)    
            return None
            
    return wrapper


def handle_request_handler_function_exceptions(func):
    # This is a decorator that can be applied to any function inside a request handler so that errors will be 
    # caught and reported before they are propagated to outer functions.
    # Use as a decorator by inserting @handle_request_handler_exceptions before any function that
    # we wish to catch errors in. 
    
    # wrap a method inside a try/except block
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:
            self = args[0]
            http_helpers.set_response_and_write_log(self.response, 500, "serverError", logging.error) 
            return None
            
    return wrapper

