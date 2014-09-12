#!/usr/bin/python

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
    print "Warning: %.2f minutes have passed since you have run build_app.py." % minutes_passed
    print "Are you sure that you still want to upload version: %s [y/n]?" % version_id
    choice = raw_input().lower();
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