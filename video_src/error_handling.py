from video_src import http_helpers, status_reporting
import logging, functools, inspect

import webapp2


def handle_exceptions(func):
    # decorator for catching errors in functions.
    # Use by inserting @handle_exceptions before function or method definition
    
    # wrap a method inside a try/except block
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except:
            error_status = "serverError"
            
            # Check if this is a method on a RequestHandler object, and if so we also write
            # out an error to the http response. 
            # Note: this code is only executed if an error occurs, and therefore we don't worry
            # about the extra "cost" of executing the code below since it should be rarely executed. 
            arg_spec = inspect.getargspec(func)
            if arg_spec.args[0] == 'self':
                # if the first parameter is 'self' then it is likely that this is a method on an object
                self = args[0]
                if hasattr(self, '__class__'):
                    # if self has an attrute '__class__' this self is likely a parameter on a method object 
                    # as opposed to a parameter on a function
                    cls = self.__class__
                    if issubclass(cls, webapp2.RequestHandler):
                        # if cls is a subclass of RequestHander, then we are pretty sure that the user is generating http on the 
                        # self.response object
                        if hasattr(self, 'response'):
                            # If self has a 'response' attribute, then write out the error_status to self.response.
                            http_helpers.set_http_response(self.response, 500, error_status)  

            # Log the error to the server, along with stack trace and debugging information
            status_reporting.log_call_stack_and_traceback(logging.error, extra_info = error_status) 
            

    return wrapper
