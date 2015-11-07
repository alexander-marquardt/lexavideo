#!/usr/bin/python

# LexaVideo Copyright information - do not remove this copyright notice
# Copyright (C) 2015 - Alexander Marquardt
#
# LexaVideo -  a fully responsive web-app featuring real-time browser-based video conferencing and text chat.
#
# Original author: Alexander Marquardt
# Documentation and additional information: http://www.lexavideo.com
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


import sys, datetime, os, codecs, re, calendar, time, subprocess



# make sure that the build was recently created -- ie. less than 5 minutes ago.
# check the timestamp on the app.yaml file, since a new version is created each time that we
# run the build_app script. 
max_time = 5 * 60

app_file = "./app.yaml"


input_yaml_handle = codecs.open(app_file, encoding='utf_8')    
pattern = re.compile(r'version:\s*(.*)')
version_id = None
for line in input_yaml_handle:
    match_pattern = pattern.match(line)
    if match_pattern:
        version_id = match_pattern.group(1)

if not version_id:
    print "**********************************************************************"    
    print "Error: Could not find version declaration in app.yaml"
    print "**********************************************************************\n"    
    exit(1)
        

modified_time = os.path.getmtime(app_file)
now_in_seconds = calendar.timegm(time.gmtime())
time_passed = now_in_seconds - modified_time
if time_passed > max_time:
    minutes_passed = time_passed / 60
    print "Warning: %.2f minutes have passed since app.yaml has been updated." % minutes_passed
    print "Have you have run build_app.py from the mac environment?"
    print "Are you sure that you still want to upload version: %s [y/n]?" % version_id
    choice = raw_input().lower()
    if choice == 'n' or choice == 'no':
        exit(1)    

print "**********************************************************************"
print "Beginning upload with version: " + version_id
print "%s" % datetime.datetime.now()
print "**********************************************************************\n"


additional_args = sys.argv[1:]
if not additional_args:
    pargs = ['appcfg.py', '--oauth2', 'update'] + ['.']
else:
    pargs = ['appcfg.py', '--oauth2'] + additional_args + ['.']

print "Process args = %s" % pargs
process = subprocess.call(pargs,  stderr=subprocess.STDOUT)

print "**********************************************************************"
print "Finisehd upload of version: " + version_id
print "%s" % datetime.datetime.now()
print "**********************************************************************\n"