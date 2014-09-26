
# This is essentially a "dummy" file that is used for trying out unit testing and unit testing features.

import logging

def check_if_logging_can_be_mocked():
    for x in range(0 , 3):
        logging.debug("Testing debug logs: %d" % x)
        logging.info("Testing info logs: %d" % x)
        logging.error("Testing error logs: %d" % x)
