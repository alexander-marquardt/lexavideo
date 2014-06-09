#!/usr/bin/python

import os, datetime, re, codecs, subprocess


VERSION_ID = "2014-06-06-2145"

# The following must be set to False before uploading - this will combine and minimize javascript 
# and css files. This combining/minimizing is only done on upload or on  development server initialization, so this will
# mask any changes that are made to jss/css between server restarts -- therefore this value 
# should be set to True for developing/debugging js/css on the local development server (the original
# js/css files would be accessed instead of the combined/minimized js/css files).
DEBUGGING_ON_CLIENT = True

if  DEBUGGING_ON_CLIENT:
    BASE_STATIC_DIR = "client/app"
    STYLES_STATIC_DIR = "client/.tmp/styles"
else:    
    BASE_STATIC_DIR = "client/dist"
    STYLES_STATIC_DIR = "client/dist/styles"
    

ENABLE_LIVE_RELOAD = True    
if not DEBUGGING_ON_CLIENT:
    # We don't want to upload code to the server with live-reload enabled, so turn it off unless we 
    # are debugging code.
    ENABLE_LIVE_RELOAD = False

def generate_app_yaml():
    # Goes through the "template" app.yaml file, and generates the "real" app.yaml by replacing certain build-specific
    # values 
    input_yaml_name = "app_template.yaml"
    output_yaml_name = "app.yaml"
    
    
    replacement_patterns_array = [(re.compile(r'(.*)(VERSION_ID)(.*)'),  VERSION_ID),
                                  (re.compile(r'(.*)(BASE_STATIC_DIR)(.*)'), BASE_STATIC_DIR),
                                  (re.compile(r'(.*)(STYLES_STATIC_DIR)(.*)'), STYLES_STATIC_DIR),
                                  ]
    
    input_yaml_handle = codecs.open(input_yaml_name, encoding='utf_8')    
    output_yaml_handle = codecs.open(output_yaml_name, 'w', encoding='utf_8')    
    for line in input_yaml_handle:
        
        for pattern_tuple in replacement_patterns_array:
            match_pattern = pattern_tuple[0].match(line)
            if match_pattern:
                line = match_pattern.group(1) + pattern_tuple[1] + match_pattern.group(3) + "\n"
                
      
        output_yaml_handle.write(line)
        
    input_yaml_handle.close()
    output_yaml_handle.close()


def run_grunt(grunt_arg, subprocess_function):

    os.chdir("client")
    pargs = ['grunt', grunt_arg]
    process = subprocess_function(pargs,  stderr=subprocess.STDOUT)    
    os.chdir("..")
    print "Switched directory back to: %s" % os.getcwd()
    
    
def run_grunt_jobs():
    

    if DEBUGGING_ON_CLIENT:
        # If we are accessing the non-compressed static files, we are probably developing and therefore want to see updates
        run_grunt('serve', subprocess.Popen)    
    else: 
        # only run the grunt build scripts if we are currently accessing the compressed static files (ie. client/dist instead of client/app). 
        # Otherwise, we are directly accessing/debugging the source static files, and minimizing would serve no purpose.
        run_grunt('build', subprocess.call)

        
def customize_files():
    
    print "**********************************************************************"
    print "Generating custom files: %s " % VERSION_ID
    print "Current path): %s" % os.getcwd()   
    print "%s" % datetime.datetime.now()
    print "**********************************************************************"
    
    generate_app_yaml()
    run_grunt_jobs()

        

if __name__ == "__main__":
    # If build_helpers.py is called as an executable file, it is likely customizing build-specific files for
    # the prepare-lexalink.py script.
    customize_files()
    
