#!/usr/bin/python2.4
#
# Copyright 2011 Google Inc. All Rights Reserved.

"""WebRTC Demo

This module demonstrates the WebRTC API by implementing a simple video chat app.
"""

import os
import jinja2
import webapp2
import vidsetup


jinja_environment = jinja2.Environment(
    loader=jinja2.FileSystemLoader(os.path.dirname(__file__) + "/" + vidsetup.BASE_STATIC_DIR))



class MainPage(webapp2.RequestHandler):
  """The main UI page, renders the 'index.html' template."""
  def get(self):

    template_values = {'ENABLE_LIVE_RELOAD' : vidsetup.ENABLE_LIVE_RELOAD}
    target_page = 'index.html'
    template = jinja_environment.get_template(target_page)
    self.response.out.write(template.render(template_values))


app = webapp2.WSGIApplication([
  (r'/', MainPage),
  ], debug=True)
