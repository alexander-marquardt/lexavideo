import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../video_src')))
sys.path.insert(0, '/usr/local/google_appengine/')
import dev_appserver
dev_appserver.fix_sys_path()

