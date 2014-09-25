


from google.appengine.ext import ndb

# This database is to store the messages from the sender client when the
# receiver client is not ready to receive the messages.
# Use TextProperty instead of StringProperty for msg because
# the session description can be more than 500 characters.

    
    
class UserModel(ndb.Model):
    
    user_name = ndb.StringProperty(default=None)
    creation_date = ndb.DateTimeProperty(auto_now_add=True)




class Message(ndb.Model):
    client_id = ndb.StringProperty()
    msg = ndb.TextProperty()

    @classmethod
    def get_saved_messages(cls, client_id):
        return cls.gql("WHERE client_id = :id", id=client_id)
