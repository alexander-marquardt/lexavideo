#!/usr/bin/python

# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
#
# A demo version of LexaVideo can be seen at http://www.chatsurfing.com
#
# Please consider contributing your enhancements and modifications to the LexaVideo community.
# Git source code repository: https://github.com/alexander-marquardt/lexavideo
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from build_support import prepare_build
import sys
import build_config

if build_config.DEBUG_BUILD:
    version_id = build_config.VERSION_ID
else:
    version_id = prepare_build.get_version_identifier()
prepare_build.customize_files(version_id)

if __name__ == "__main__":
    sys.path.append("/usr/local/google_appengine")    

    # Show debug logs when we are working on the local server
    sys.argv.append('--log_level')
    sys.argv.append('debug')

    # The following hack makes it appear that we are running the dev_appserver from the /usr/local/google_appengine directory,
    # which is required for the script to run properly.

    if '--use_old_dev_appserver' in sys.argv:
        # remove this option from sys.argv so that it doesn't cause problems in other parts of the code
        sys.argv = filter(lambda a: a != "--use_old_dev_appserver", sys.argv)
        
        import old_dev_appserver 
        old_dev_appserver.run_file("/usr/local/google_appengine/old_dev_appserver.py", globals())    
    else:
        import dev_appserver        
        sys.argv[0] = "/usr/local/google_appengine/dev_appserver.py"
        dev_appserver._run_file("/usr/local/google_appengine/dev_appserver.py", globals())        