


from google.appengine.ext import ndb

# This database is to store the messages from the sender client when the
# receiver client is not ready to receive the messages.
# Use TextProperty instead of StringProperty for msg because
# the session description can be more than 500 characters.

    
    
class UserModel(ndb.Model):
    
    userName = ndb.StringProperty(default=None)
    creationDate = ndb.DateTimeProperty(auto_now_add=True) 