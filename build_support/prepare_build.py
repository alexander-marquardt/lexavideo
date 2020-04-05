
import build_config
import os, datetime, subprocess
from build_support import gen_yaml
import build_config


def get_version_identifier():
    # use datetime as a version identifier/timestamp - but need to remove spaces and colons    
    datetime_str = str(datetime.datetime.now())
    datetime_str = datetime_str[:16]
    datetime_str = datetime_str.replace(' ', '-')
    datetime_str = datetime_str.replace(':', '')
    return datetime_str


def run_grunt(grunt_arg, subprocess_function):

    os.chdir("client")
    pargs = ['grunt', grunt_arg]
    process = subprocess_function(pargs,  stderr=subprocess.STDOUT)    
    os.chdir("..")
    print "Switched directory back to: %s" % os.getcwd()
    
    
def run_grunt_jobs():
    
    if build_config.RUN_GRUNT:
        if build_config.DEBUG_BUILD:
            # If we are accessing the non-compressed static files, we are probably developing and therefore want to see updates
            run_grunt('serve', subprocess.Popen)    
        else: 
            # only run the grunt build scripts if we are currently accessing the compressed static files (ie. client/dist instead of client/app). 
            # Otherwise, we are directly accessing/debugging the source static files, and minimizing would serve no purpose.
            run_grunt('build', subprocess.call)

        
def customize_files(version_id):
    
    print "**********************************************************************"
    print "Generating custom files: %s " % version_id
    print "Current path): %s" % os.getcwd()   
    print "%s" % datetime.datetime.now()
    print "**********************************************************************"
    
    gen_yaml.generate_app_yaml(version_id)
    run_grunt_jobs()


if __name__ == "__main__":
    if build_config.DEBUG_BUILD:
        version_id = build_config.VERSION_ID
    else:
        version_id = get_version_identifier()

    customize_files(version_id)