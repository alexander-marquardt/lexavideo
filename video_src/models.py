


from google.appengine.ext import db

# This database is to store the messages from the sender client when the
# receiver client is not ready to receive the messages.
# Use TextProperty instead of StringProperty for msg because
# the session description can be more than 500 characters.
class Message(db.Model):
    client_id = db.StringProperty()
    msg = db.TextProperty()


def get_saved_messages(client_id):
    return Message.gql("WHERE client_id = :id", id=client_id)