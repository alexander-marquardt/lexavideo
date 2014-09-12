#!/usr/bin/python

import vidsetup, sys, datetime
from build_support import prepare_build


if vidsetup.DEBUG_BUILD:
    print "************************************"
    print "Error - DEBUG_BUILD must be false to perpare this app for uploading"
    print "************************************"
    sys.exit(1)


def get_version_identifier():
    # use datetime as a version identifier/timestamp - but need to remove spaces and colons    
    datetime_str = str(datetime.datetime.now())
    datetime_str = datetime_str[:16]
    datetime_str = datetime_str.replace(' ', '-')
    datetime_str = datetime_str.replace(':', '')
    return datetime_str
    
version_id = get_version_identifier()

# Execute the code for generating css, compressing, minimizing, watching for modifications, etc.   
# This comes before the dev_appserver call because that call runs infinitely
prepare_build.customize_files(version_id)
