


from google.appengine.ext import db

# This database is to store the messages from the sender client when the
# receiver client is not ready to receive the messages.
# Use TextProperty instead of StringProperty for msg because
# the session description can be more than 500 characters.
class Message(db.Model):
    client_id = db.StringProperty()
    msg = db.TextProperty()


# Room will contain data about which users are currently communicating with each other.
class Room(db.Model):
    """All the data we store for a room"""
    user1 = db.StringProperty()
    user2 = db.StringProperty()
    user1_connected = db.BooleanProperty(default=False)
    user2_connected = db.BooleanProperty(default=False)

    def __str__(self):
        result = '['
        if self.user1:
            result += "%s-%r" % (self.user1, self.user1_connected)
        if self.user2:
            result += ", %s-%r" % (self.user2, self.user2_connected)
        result += ']'
        return result

    def get_occupancy(self):
        occupancy = 0
        if self.user1:
            occupancy += 1
        if self.user2:
            occupancy += 1
        return occupancy

    def get_other_user(self, user):
        if user == self.user1:
            return self.user2
        elif user == self.user2:
            return self.user1
        else:
            return None

    def has_user(self, user):
        return (user and (user == self.user1 or user == self.user2))

    def add_user(self, user):
        if not self.user1:
            self.user1 = user
        elif not self.user2:
            self.user2 = user
        else:
            raise RuntimeError('room is full')
        self.put()

    def set_connected(self, user):
        if user == self.user1:
            self.user1_connected = True
        if user == self.user2:
            self.user2_connected = True
        self.put()

    def is_connected(self, user):
        if user == self.user1:
            return self.user1_connected
        if user == self.user2:
            return self.user2_connected