#!/usr/bin/python

import build_config, sys
import prepare_build

if build_config.DEBUG_BUILD:
    print "************************************"
    print "Error - DEBUG_BUILD must be false to perpare this app for uploading"
    print "************************************"
    sys.exit(1)

version_id = prepare_build.get_version_identifier()

# Execute the code for generating css, compressing, minimizing, watching for modifications, etc.   
# This comes before the dev_appserver call because that call runs infinitely
prepare_build.customize_files(version_id)
