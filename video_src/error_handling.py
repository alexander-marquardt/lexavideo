from video_src import http_helpers, status_reporting
import logging, functools, inspect



def handle_exceptions(func):
    # decorator for catching errors in functions.
    # Use by inserting @handle_function_exceptions before function definition
    
    # wrap a method inside a try/except block
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:
            message = "serverError"
            
            # If the first parameter has a response attribute, then this is likely a call to a method
            # on a webapp2.RequestHandler object where the first parameter (args[0]) is 'self' and where self.response
            # will be written with information that is returned to the client. (This is a hackey way of 
            # checking if this is a RequestHandler, and should be re-visited - ARM Sept 14 2014)
            if hasattr(args[0], 'response'):
                http_helpers.set_http_response(args[0].response, 500, message)  

            # Log the error to the server, along with stack trace and debugging information
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = message) 
            

    return wrapper
