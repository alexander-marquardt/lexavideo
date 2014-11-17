


from google.appengine.ext import ndb

# This database is to store the messages from the sender client when the
# receiver client is not ready to receive the messages.
# Use TextProperty instead of StringProperty for msg because
# the session description can be more than 500 characters.


    
class UserModel(ndb.Model):

    # This may look strange, but unless the user specifically enters in a user name, then
    # we will assign the entity key as the username. This guarantees that each user name is
    # unique, while being easy to implement.
    user_name = ndb.StringProperty(default=None)

    # We will assign new user entities to each person who visits the page, but only some of these users
    # will actually create a permanent account by registering and by creating their own user name.
    # Other users will be cleared out of the database periodically, and the following flag will allow
    # us to determine which users to remove.
    user_is_registered = ndb.BooleanProperty(default=False)

    creation_date = ndb.DateTimeProperty(auto_now_add=True)


#
# class Message(ndb.Model):
#     client_id = ndb.StringProperty()
#     msg = ndb.TextProperty()
#
#     @classmethod
#     def get_saved_messages(cls, client_id):
#         return cls.gql("WHERE client_id = :id", id=client_id)
