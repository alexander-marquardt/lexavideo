#!/usr/bin/python

import re, codecs
import build_config

def generate_app_yaml():
    # Goes through the "template" app.yaml file, and generates the "real" app.yaml by replacing certain build-specific
    # values 
    input_yaml_name = "app_template.yaml"
    output_yaml_name = "app.yaml"
    
    
    print "**********************************************************************"
    print "Generating app.yaml from app_template.yaml"

    
    if not build_config.DEBUG_BUILD:
        # if we are accessing the dist build (not debug), then do not upload un-necessary files
        SKIP_DOT_DIRS =  "- ^(.*/)?\..*$"
        SKIP_APP_DIRS = "- ^client/app/.*"
        SKIP_DIST_DIRS = ''
        
    else:
        # we are uploading a debug build, keep all of the app and .tmp files
        SKIP_DOT_DIRS = ''
        SKIP_APP_DIRS = ''
        SKIP_DIST_DIRS = '"- ^client/dist/.*"'

    
    replacement_patterns_array = [
                                  (re.compile(r'(.*)(BASE_STATIC_DIR)(.*)'), build_config.BASE_STATIC_DIR),
                                  (re.compile(r'(.*)(STYLES_STATIC_DIR)(.*)'), build_config.STYLES_STATIC_DIR),
                                  (re.compile(r'(.*)(SKIP_DOT_DIRS)(.*)'), SKIP_DOT_DIRS),
                                  (re.compile(r'(.*)(SKIP_APP_DIRS)(.*)'), SKIP_APP_DIRS),
                                  (re.compile(r'(.*)(SKIP_DIST_DIRS)(.*)'), SKIP_DIST_DIRS),
                                  ]
    
    input_yaml_handle = codecs.open(input_yaml_name, encoding='utf_8')    
    output_yaml_handle = codecs.open(output_yaml_name, 'w', encoding='utf_8')    
    
    output_yaml_handle.write("# ****** DO NOT EDIT THIS FILE *******\n")
    output_yaml_handle.write("# This file is generated from %s\n" % input_yaml_name)
    output_yaml_handle.write("# Make any changes in %s and then run gen_yaml.py to update this file.\n" % input_yaml_name)
    output_yaml_handle.write("# If you use the run_app.py wrapper to execute your application, \n")
    output_yaml_handle.write("# then this will happen automatically\n\n")
    
    for line in input_yaml_handle:
        
        for pattern_tuple in replacement_patterns_array:
            match_pattern = pattern_tuple[0].match(line)
            if match_pattern:
                line = match_pattern.group(1) + pattern_tuple[1] + match_pattern.group(3)
                print "Replacing line: %s" % line
                line = line + "\n"
      
        output_yaml_handle.write(line)
        
    input_yaml_handle.close()
    output_yaml_handle.close()
    
    print "Finished generating app.yaml from app_template.yaml"
    print "**********************************************************************"    

if __name__ == "__main__":
    generate_app_yaml();