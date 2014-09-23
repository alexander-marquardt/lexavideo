import pytest, sys, os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, '/usr/local/google_appengine/')
import dev_appserver

dev_appserver.fix_sys_path()