#!/usr/bin/python
# -*- coding: utf-8 -*-
import argparse
import codecs
import os
import sys
import subprocess

sys.stdout = codecs.getwriter('utf8')(sys.stdout)
sys.stdin = codecs.getreader('utf8')(sys.stdin)
parser = argparse.ArgumentParser()
parser.add_argument('-f', '--file',  help='enter the file name that you wish to test')

pargs = parser.parse_args()

def run_subprocess(command):
    p = subprocess.Popen(command, stdout=subprocess.PIPE)
    output = p.communicate()[0]
    print output
    return p.returncode

exit_code = 0
if pargs.file:
    filename = pargs.file

    if (os.path.isfile(filename)):
        exit_code = run_subprocess(['py.test', filename])
    else:
        print "File %s does not exist - not running unittest" % filename

else:
   exit_code = run_subprocess(['py.test',])

print "Exit code: %d" % exit_code
exit(exit_code)